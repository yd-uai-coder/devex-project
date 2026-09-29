# Phase-8-5: ルーター層の設計統一(Repository直接参照の禁止)

## この章の目的

Phase 8完了後の相談([`textbook/q_a.md`](../q_a.md)参照)で、「routeから直接Repositoryを呼び出す場合とServiceを経由する場合の設計判断」についてユーザーと議論した。既存コードには「単純な読み取りはRepository直呼び、書き込み・複数Repository調整・外部LLM呼び出しはService経由」という暗黙の基準があったが、Phase 8の`app/uml/routes/uml.py`だけは全操作をService経由に統一しており、プロジェクト内に2つの流儀が混在していた。ユーザーの判断(「常にService経由、Repository直参照は層違反として禁止」で統一する。理由: 将来の処理追加に備えた拡張性、設計判断の余地を減らすこと)を受け、既存の`projects.py`・`prompt_templates.py`が持っていた直接参照6箇所をServiceメソッドへ移す。

Phase 6-6(動作確認後の修正)と同じ位置づけの追補章。

学習モード([introduction](./Phase-8-introduction.md)参照。既存コードの設計方針そのものを変更する判断のため、納期モードの条件を満たさない)。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30)。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/services/project.py`](../samples/backend/app/services/project.py) | 更新 | **コア** | `list_for_user`/`get_detail`を追加。`get_detail`は`IntakeFileRepository`の取得+`ProjectDetail`組み立てをルーターから引き取る |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py) | 更新 | 定型 | `list_history`を追加(`ChatHistoryRepository.list_for_project`の薄いラッパー) |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | **コア** | `list_current_documents`/`get_document`を追加。`get_document`は所有権チェック(404化)をルーターから引き取る |
| [`app/services/prompt_template.py`](../samples/backend/app/services/prompt_template.py) | 新規 | 定型 | `PromptTemplateService`(`PromptTemplateRepository`の薄いラッパー) |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py) | 更新 | 定型 | `list_projects`/`get_project`/`get_hearing_history`/`list_generated_documents`/`download_generated_document`の5ルートをService経由に置き換え。`Repository`系4種のimportを削除 |
| [`app/api/routes/prompt_templates.py`](../samples/backend/app/api/routes/prompt_templates.py) | 更新 | 定型 | `list_prompt_templates`を`PromptTemplateService`経由に置き換え |
| ── ここからテスト ── | | | |
| [`tests/unit/test_project_service.py`](../samples/backend/tests/unit/test_project_service.py) | 更新 | 定型 | `list_for_user`/`get_detail`のテストを追加 |
| [`tests/unit/test_chat_service.py`](../samples/backend/tests/unit/test_chat_service.py) | 更新 | 定型 | `list_history`のテストを追加 |
| [`tests/unit/test_doc_generator_service.py`](../samples/backend/tests/unit/test_doc_generator_service.py) | 更新 | 定型 | `list_current_documents`/`get_document`のテストを追加。`_create_project`のメールアドレスを呼び出しごとに一意化(後述) |
| [`tests/unit/test_prompt_template_service.py`](../samples/backend/tests/unit/test_prompt_template_service.py) | 新規 | 定型 | `PromptTemplateService.list_all`のテスト |

既存の`tests/unit/test_prompt_templates_routes.py`・`tests/unit/test_project_repository.py`等は変更不要(ルート関数のシグネチャは変わらず、Repositoryを直接使うテストも引き続き有効)。

## 設計判断

### なぜこの統一を行うか

前回の相談で、devex-apiの既存コードは「単純な読み取りはRepository直呼び、書き込み・複数Repo調整・外部呼び出しはService経由」というCQRS的な基準に暗黙に従っていることを確認した。これは実務でも一般的な立場(Ardalis: "Given that there is no business logic and all that's happening is basic CRUD, a service wouldn't really add much value.")だが、対抗する立場として「常にService経由、Repository直参照を層違反として禁止する」という慣習も、ArchUnit等のアーキテクチャテストで強制する実務現場やFastAPI公式`full-stack-fastapi-template`("The API layer contains only route handlers with no business logic, serving as a thin layer that calls services.")に見られる。ユーザーは後者を選び、理由として(1)将来の処理追加時にServiceを新設する手戻りを避けられる拡張性、(2)ルートごとに経路を判断する余地を減らしたい、という2点を挙げた。

### なぜ`list_for_user`/`list_history`/`list_current_documents`のような薄いラッパーもServiceに置くか

これらは`self._xxx.method(...)`を1行返すだけで、現時点では業務ロジックを一切持たない。CQRS的な立場からは「Serviceを挟む価値が薄い」典型例だが、今回確定した方針は「業務ロジックの有無で経路を分岐させない」ことそのものが目的のため、あえて薄いラッパーとして残す。将来これらのメソッドに認可・キャッシュ・監査ログ等の横断的関心事が必要になった場合も、呼び出し元(ルーター)を変更せずService内部だけを変更できる。

### なぜ`ProjectService.get_detail`はORMモデルではなく`ProjectDetail`スキーマを返すか

既存の`ChatService.check_completion`が`HearingCompletionCheck`(スキーマ)を直接返す前例があり、Serviceが`app.schemas`に依存すること自体はこのコードベースで既に許容されている。`get_detail`は単一のORMモデルではなく「Project本体+別Repository(IntakeFile)の取得結果」を組み合わせた集約ビューであり、`ChatService.check_completion`と同じ「計算・合成された結果を返す」ケースに当たる。単純な一覧取得(`list_for_user`等)はこれまでどおりORMモデルのリストを返し、ルーター側で`XRead.model_validate(...)`に変換する既存パターンを維持した(1ルートにつき1つの一貫した基準にするため、"薄いラッパーはORM、集約ビューはスキーマ"という使い分け自体はPhase 8以前から一貫している)。

### なぜ`app/api/deps.py`の`get_current_project`は対象外としたか

`get_current_project`(`CurrentProjectDep`)も内部で`ProjectRepository.get_by_id`を直接呼んでいるが、これは「ルート(`@router.*`ハンドラ)」ではなく、ほぼ全プロジェクトスコープルートが共有するFastAPI依存関数であり、`devex-api/CLAUDE.md`が既に`get_current_user`について「認証境界だけは生の`HTTPException`を使う、意図的な設計」と明記している既存の例外カテゴリに属すると判断した。今回のリファクタリング対象は「ルートハンドラの本体がRepositoryを直接参照している箇所」に限定し、`deps.py`は変更していない。この境界についてはユーザーへ報告済み。

## テスト観点(#14)

**SUT/ドライバ/スタブ**の用語定義は[Phase-8-1.md](./Phase-8-1.md)参照。

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `ProjectService.list_for_user`/`get_detail` | pytest(直接呼び出し、インメモリSQLite `db_session`) | スタブ不要 ── DBアクセスのみで外部呼び出しを含まないため | `test_project_service.py` |
| `ChatService.list_history` | pytest(直接呼び出し、インメモリSQLite `db_session`) | スタブ不要 ── 同上 | `test_chat_service.py` |
| `DocGeneratorService.list_current_documents`/`get_document` | pytest(直接呼び出し、インメモリSQLite `db_session`) | スタブ不要 ── 同上(生成自体は`FakeLLM`を使う既存の`_fake_llm_for_generation`フィクスチャを流用) | `test_doc_generator_service.py` |
| `PromptTemplateService.list_all` | pytest(直接呼び出し、インメモリSQLite `db_session`) | スタブ不要 ── 同上 | `test_prompt_template_service.py` |

## 動作確認(実施済み)

samples反映後、`devex-api`(`stage3`ブランチ)の実環境へ反映して以下を確認した。

```bash
cd backend
uv run pytest -m "not integration" -q
# 231 passed, 5 deselected(既存分・Phase 8分を含む全体。本章由来の破壊的変更なし)
uv run ruff check .
# All checks passed!
uvx pyright
# 1 error, 0 warnings(既知の1件、app/ai/llm/gemini.pyのみ残存。本章由来の新規エラー0件)
```

### 動作確認で見つけたバグ1件

新規テスト(`test_get_document_raises_not_found_for_other_project`等)を追加したところ、`tests/unit/test_doc_generator_service.py`の`_create_project`ヘルパーが固定メールアドレス(`owner@example.com`)を使っており、1テスト内で「自分のプロジェクト」「他人のプロジェクト」の両方を用意すると`users.email`一意制約に違反することが判明した(Phase 8-2の動作確認で見つけたものと同種のバグ)。呼び出しごとにメールアドレスを一意化して解消した(詳細は上表・samples当該ファイル参照)。

## 既知の残課題

`app/api/deps.py`の`get_current_project`は今回の対象外(理由は上記「設計判断」参照)。`devex-ui`側に同種の「読み取りはRepository直呼び」的な設計(APIクライアント層)があるかどうかは今回調査していない。必要であれば別途確認する。
