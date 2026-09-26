# Phase-2-4: ドキュメント生成ロジック doc_generator_service.py

## この章の目的

ヒアリング完了後、チャット全履歴を入力に4種の設計書(要件定義/外部設計/内部設計/実装計画)をLLMで一括生成し、バージョン管理して保存する`DocGeneratorService`を実装する。生成後の自己診断、FastAPIの`BackgroundTasks`を使った非同期実行の設計もこの章で扱う。

**学習モード**(MVPコアループのためCLAUDE.md #21により固定。[`Phase-2-introduction.md`](./Phase-2-introduction.md)参照)。#14のとおりSUT/ドライバ/スタブを言語化する。

サンプルは [`textbook/samples/backend/`](../samples/backend/) に追加した。写経前提として [`Phase-2-1.md`](./Phase-2-1.md)〜[`Phase-2-3.md`](./Phase-2-3.md) の写経が完了していること。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): テストはまとめて表の末尾に置いている。

| ファイル(`devex-api/backend/`基準)                                                                              | 新規/更新       | 写経レベル  | 責務                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`app/repositories/project.py`](../samples/backend/app/repositories/project.py)                           | 更新(実装は変更なし) | 定型     | 所有者チェック無し専用メソッドの追加を検討したが見送り、Phase 2-1の既存`get_by_id`をそのまま使う結論に至った経緯をコメントで記録(下記理由参照)                                                                           |
| [`app/schemas/document.py`](../samples/backend/app/schemas/document.py)                                   | 新規          | 定型     | `GeneratedDocumentRead`                                                                                                                                      |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py)       | 新規          | **コア** | `generate_documents`(BackgroundTasksエントリポイント。`project_id`に加え`user_id`も受け取り、既存の所有者スコープ版`get_by_id`で取得する)・`DocGeneratorService`(**Phase 2-5でリトライ・エラー分岐の追記あり**) |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py)                             | 更新          | 定型     | `POST /{project_id}/generate`(`current_user.id`も`generate_documents`へ渡す)・`GET /{project_id}/documents`を追加(Phase 2-3の既存エンドポイントは変更なし。**Phase 2-5でも追記あり**)      |
| ── ここからテスト(まとめて末尾) ──                                                                                     |             |        |                                                                                                                                                              |
| [`tests/fixtures/fake_llm.py`](../samples/backend/tests/fixtures/fake_llm.py)                             | 更新          | 定型     | `content_sequence`(呼び出しごとに異なる応答を返す)を追加(Phase 2-3の`astream`部分は変更なし)。`test_doc_generator_service.py`が必要とする                                                     |
| [`tests/unit/test_doc_generator_service.py`](../samples/backend/tests/unit/test_doc_generator_service.py) | 新規          | 定型     | 下記テスト観点参照                                                                                                                                                    |

## 主要な設計判断

### 検討：`ProjectRepository`に`get_by_id_unscoped`を追加するか

`generate_documents`はFastAPIの`BackgroundTasks`から呼ばれる。**Context7で`langchain-google-genai`ではなくFastAPI自体のドキュメントを確認したところ**、FastAPI 0.106.0以降、`yield`を使うDI(本プロジェクトの`SessionDep`)の「exit code」(セッションのclose処理)はbackground task実行**前**に走るよう変更されている(公式ドキュメント "Background Tasks and Dependencies with yield" 参照)。つまりリクエストの`SessionDep`をそのままbackground taskに渡しても、実行時には既にクローズされたセッションになる。公式の推奨は「識別子(ID)だけを渡し、background task内で必要なオブジェクトを取得し直す」こと。

このため`generate_documents(project_id: uuid.UUID, ...)`はproject_idのみを受け取り、`app/core/database.py`の`AsyncSessionLocal`で自前のセッションを開始する設計にした。ここで問題になるのが、プロジェクトを取得する際の所有者チェックの扱いである。`ProjectRepository.get_by_id`は所有者スコープ(`user_id`必須、Phase 2-1でoverride済み)だが、background task内にはHTTPリクエストの`current_user`が存在しない。この取得方法について、以下の2案を比較検討した。

- **案A**: 所有者チェックを行わない専用メソッド`get_by_id_unscoped`をリポジトリに追加し、`generate_documents`はproject_idのみで取得する。「project_idは既にHTTPリクエスト時点(`CurrentProjectDep`)で認可済みの値である」ことを前提にする。
- **案B**: `generate_documents`にuser_idも(値として)渡し、既存の所有者スコープ版`get_by_id`をそのまま使う。

比較の結果:

- 技術的制約の観点では両案に優劣は無い。BackgroundTasksが制約するのは「セッションやORMオブジェクトのような、リクエストのライフサイクルに紐づくもの」であって、`project_id`/`user_id`のような値そのものではないため、user_idを追加で渡すこと自体に技術的な障害は無い(案Bも問題なく成立する)。
- 案Aは、リポジトリに「所有者チェックを行わない」専用メソッドを増やすことになる。これは将来、別の呼び出し元(たとえば認可チェックが未済みの経路)がこのメソッドを誤って使ってしまうリスクを常に内包する。
- 案Bは新しい"危険な"メソッドを増やさずに済み、既存の`get_by_id`(所有者スコープ)一本にリポジトリのAPI面を統一できる。

> **[Phase 2-4 で確定 ── `get_by_id_unscoped`を追加しない]** 当初〈BackgroundTasks向けに所有者チェック無しの専用メソッド`get_by_id_unscoped`を追加する予定〉→ 撤回。理由〈project_id・user_idはどちらも値でありセッションのようにライフサイクルに紐づかないため、BackgroundTasksへuser_idも渡し既存の所有者スコープ版`get_by_id`に統一する方が、リポジトリに誤用リスクのある専用メソッドを増やさずに済むため〉。

このため`get_by_id_unscoped`は追加せず、`generate_documents(project_id, user_id, ...)`が`user_id`も受け取り、`DocGeneratorService.generate`内で`self._projects.get_by_id(project_id, user_id=user_id)`(既存の所有者スコープ版)をそのまま使う設計にした。**この判断は技術的必然によるものではなく、「専用メソッドを増やすことによる将来の誤用リスク」と「取得ロジックの単純さ」を比較した、純粋に設計上の好みによる選択である**(案Aを選んでも動作上の問題は無い)。

### 実行時に見つかったバグ: 生成失敗時に`status`が`generating`のまま固定される

実装直後、Docker Compose環境(Phase 1で構築済み)に対して実際に`POST /{id}/generate`を呼び出したところ(`GOOGLE_API_KEY`未設定のため`ChatGoogleGenerativeAI`の初期化で`ValidationError`が発生)、`project.status`が`generating`のまま更新されず、ユーザーが再度生成をやり直せない状態になることが分かった。これを受けて`generate()`全体を`try/except`で囲み、失敗時は`status`を`interviewing`に戻し、失敗内容を`sender='others'`のchat_historiesに記録するよう修正した(再試行可能にする)。**実際に動かしてみて初めて見つかったバグ**であり、単体テスト(`FakeLLM`は例外を送出しない限り気づけない)だけでは発見できなかった典型例。`test_generate_reverts_status_and_records_failure_on_llm_error`として回帰テストも追加した。

> **後続の改訂**: 失敗時の差し戻し先を、固定の`"interviewing"`ではなく`generate()`開始時点の`project.status`(`"interviewing"`または`"revising"`)に変更した。`"revising"`(修正中、completed後に新規メッセージを送った状態)から再生成に失敗して`"interviewing"`に戻ってしまうと、「生成済みだった」という文脈を失うため。詳細は[`decision-digest.md`](../decision-digest.md)「プロジェクトステータス「修正中(revising)」の導入 + ドキュメントへの常設リンク + ドキュメントプレビュー画面の2件の修正」節参照。

エラーメッセージの文面(`f"...({exc})"`)は現時点では例外の`str()`をそのまま含む簡易実装。`LLM_QUOTA_EXCEEDED`等の分かりやすいユーザー向けメッセージへの差し替えはPhase 2-5(エラーハンドリング)で行う。

### 自己診断は構造化出力にしていない

`generated_documents`同様、自己診断結果も`chat_histories.message`(TEXT型)にそのまま格納するだけであり、後続処理がプログラム的にtier別集計を行う現状の消費者が無いため、`HearingCompletionCheck`のような構造化Pydanticスキーマは作らず、プロンプトで「最重要/中程度/軽微」の3段階を指示するフリーテキスト出力にした(CLAUDE.md #17: 今の実消費者が無い構造化は見送り)。

### バージョニングの再利用

`GeneratedDocumentRepository.create_version`(Phase 2-1で実装済み)をそのまま呼ぶだけで、「新バージョン追加・直近3件保持」のドメインルールは再利用できている。本章で新たに実装したのは「4種類の生成を順に回し、それぞれについて`create_version`を呼ぶ」というオーケストレーションのみ。

> **後続の改訂**: 本章時点の実装は、4種の文書を同じ生のチャット全履歴から独立に生成する設計だった(`_DOC_GENERATION_SYSTEM_PROMPT_TEMPLATE`という共通テンプレートを`{label}`だけ差し替えて使い回す)。`docs/internal_design.md` 3.3節が元々定めていた「それぞれに特化したプロンプト」を完全には実現できていなかったため、doc_typeごとの専用プロンプト(`_DOC_TYPE_PROMPTS`)+前段の確定済み文書を入力にする連鎖構成(`_DOC_TYPE_INPUTS`)に置き換えた。詳細は[`decision-digest.md`](../decision-digest.md)「ドキュメント生成: 4文書専用プロンプト + 連鎖生成への置き換え」節参照。

## テスト観点(#14)

### `DocGeneratorService.generate`

- SUT: `DocGeneratorService`
- ドライバ: `tests/unit/test_doc_generator_service.py`
- スタブ: `FakeLLM`(`content_sequence`で4文書+自己診断=5回分の応答を順に返す。今回`fake_llm.py`に`content_sequence`パラメータを追加した ── 既存の`structured_sequence`は`with_structured_output`専用で、素の`ainvoke`には対応していなかったため)。DBアクセスは`db_session`(SQLite)の実リポジトリをそのまま使う。
- 確認した振る舞い: 4種すべて生成される・自己診断が`others`行として記録される・`status`が`completed`に遷移する・存在しないproject_idでは何もしない(LLM呼び出しゼロ件で確認)・2回生成すると上書きでなく新バージョン(v2)になる・**LLM失敗時に`status`が`interviewing`に戻り失敗メッセージが記録される**(前述のバグ修正の回帰テスト)。

### `_render_transcript`

- SUT: `_render_transcript`関数(モジュール非公開だが同一モジュール内なのでテストから直接import)
- ドライバ: `test_render_transcript_excludes_others_sender`
- スタブ不要 ── 対象が純粋(`ChatHistory`のリストを受け取り文字列を返すだけ、外部依存を呼ばない)なため。

## 動作確認(このセッション内で実施)

- `uv run pytest tests/unit/test_doc_generator_service.py`で7件green、`uv run pytest tests/unit`で既存分含め80件green、`uvx pyright`で0エラー。
- 実Docker Compose環境で`POST /api/v1/projects/{id}/generate`(202)→`GET /api/v1/projects/{id}/documents`(生成前は空リスト)を確認。`GOOGLE_API_KEY`未設定のため実際の生成は失敗するが、その失敗によって上記バグを発見・修正し、修正後は`status`が`interviewing`に正しく戻り、失敗理由が`chat_histories`(`sender='others'`)に記録されることを確認した。検証後はテーブルを降格し、`devex-api`のコードは写経前の状態に戻してある。
- **後日の追記検証**: `get_by_id_unscoped`を追加しない設計へ変更した後、`devex-api`とは別の使い捨てコピー(実装コードには一切影響を与えない)に最新の`textbook/samples/backend/`一式を重ねて`uv run pytest tests/unit`(91件green)・`uvx pyright`(0エラー)を再確認済み。
