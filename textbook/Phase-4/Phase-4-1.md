# Phase-4-1: バックエンド単体テスト監査・不足補完

## この章の目的

`docs/implementation_plan.md` 4.2節の統合テスト・QAタスクのうち「バックエンド単体テスト」を扱う。Phase 2の各章(2-1〜2-5)で作成済みの`tests/unit/`・`tests/integration/`を棚卸しし、過去に一度発覚した「サービスは実装済みだがルートが配線されていない」類の抜け漏れが無いかを実際のHTTPレイヤーで再確認する。棚卸しの過程で、[`Phase-1-1.md`](../Phase-1/Phase-1-1.md)で発見されPhase 2でも未解決のまま持ち越されていた統合テスト基盤の既知課題を根本修正し、加えて2件の実害あるバグ(エラーメッセージの英語残存、ルーティング統合の未検証)を見つけて修正・補完する。

自動実装モード: off([introduction](./Phase-4-introduction.md) 参照)。旧ルールの納期モード(旧 #21)で書いた章。#14のSUT/ドライバ/スタブの言語化は省略する。

サンプルは [`textbook/samples/backend/`](../samples/backend/) に追加・更新した。写経前提として Phase 1〜3(とくに[`Phase-2-1.md`](../Phase-2/Phase-2-1.md)〜[`Phase-2-5.md`](../Phase-2/Phase-2-5.md)、[`Phase-3-1.md`](../Phase-3/Phase-3-1.md)〜[`Phase-3-6.md`](../Phase-3/Phase-3-6.md))の写経が完了していること。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): テストはまとめて表の末尾に置いている。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`app/services/llm_retry.py`](../samples/backend/app/services/llm_retry.py) | 更新 | 定型 | `LLMQuotaExceededError`・`GenerationFailedError`のメッセージ文言を英語→日本語に修正 |
| ── ここからテスト(まとめて末尾) ── | | | |
| [`tests/integration/conftest.py`](../samples/backend/tests/integration/conftest.py) | 更新(初のsamples反映、CLAUDE.md #29) | コア | 統合テストの`client`フィクスチャに、DB engine・Redis接続プールの後片付けを追加(下記「主要な発見」参照) |
| `tests/unit/test_llm_retry.py` | 更新 | 定型 | 上記メッセージが日本語であることを固定する回帰テストを追加 |
| `tests/integration/test_projects_flow.py` | 新規 | コア | プロジェクト作成→チャット→完了判定→生成→ドキュメント一覧→ダウンロードの一連をHTTP経由で検証。`revising`遷移も検証 |

## 主要な発見: 統合テスト基盤の既知課題(Phase 1由来)の根本修正

[`Phase-1-1.md`](../Phase-1/Phase-1-1.md)は、`tests/integration/`を一括実行すると`test_auth_flow.py`の後に`test_health.py`を実行した場合に限りpytest-asyncioのイベントループ後片付けでエラーが出ることを発見していたが、「テストコード自体(Phase 2以降が触る領域)の問題」として本Phase以降での対応に持ち越していた。[`Phase-2-2.md`](../Phase-2/Phase-2-2.md)はこれを引き継いで2つの統合テストを個別実行する回避策に留め、根本原因の調査はしていなかった(「Phase 2から持ち越しの既知課題であり本章のCookie化とは無関係」と明記)。

本章で調査したところ、原因は`app/core/database.py`の`engine`・`app/infrastructure/redis.py`の`get_redis_pool()`がいずれもモジュールレベルのシングルトンであることだった。両者の内部コネクションプールは**生成時のイベントループに紐づく**が、pytest-asyncioは既定でテスト関数ごとに新しいイベントループを作るため、明示的に後片付けしないと、2つ目以降のテストが別のイベントループからこのプールのコネクションを再利用しようとして`RuntimeError: Event loop is closed`(PostgreSQL側)・`attached to a different loop`(Redis側)になる。1ファイルに複数の統合テストがある場合、2件目以降で必ず再現する。

`tests/integration/conftest.py`の`client`フィクスチャのteardownに、`await engine.dispose()`(PostgreSQL)・`await get_redis_pool().disconnect(); get_redis_pool.cache_clear()`(Redis)を追加し、各テスト終了時に現在のイベントループの中でプールを確実に閉じ、次のテスト(次のイベントループ)ではプールを作り直させるようにした。この修正により、[`Phase-4-3.md`](./Phase-4-3.md)・[`Phase-4-5.md`](./Phase-4-5.md)が新設する複数テストを含む統合テストファイルも、個別実行に頼らず`tests/integration`一括実行でgreenになることを確認した(下記「動作確認」参照)。Phase 1が遭遇した`test_auth_flow.py`→`test_health.py`の組み合わせも同時に解消している。

## 監査の実施内容と結論

CLAUDE.md #15(前方import禁止)の実importの監査と同じ機会に、Phase 2で作成した`tests/unit/`配下14ファイル・`tests/integration/test_auth_flow.py`を対象に、以下2点を確認した。

### 1. 「サービス実装済みだがルート未配線」の再点検

[`decision-digest.md`](../decision-digest.md)「Phase 3-5着手前」節に記録済みのとおり、`ChatService.check_completion`は実装済みなのに対応するルート(`GET /hearing-completion`)が配線されていなかった事例が過去に1度発覚している。この教訓を踏まえ、`app/api/routes/projects.py`の全エンドポイントと、対応するサービスメソッドの呼び出し関係を突き合わせた。

結論: 現時点で同種の配線漏れは無い(`create_project`/`list_projects`/`get_project`/`send_hearing_message`/`get_hearing_history`/`get_hearing_completion`/`trigger_generation`/`list_generated_documents`/`download_generated_document`の9エンドポイントすべてが対応するサービス・リポジトリメソッドへ到達することを確認済み)。ただし「ルートは存在するが実際にHTTP経由で最後まで通した統合テストが無い」箇所(生成トリガー→ドキュメント一覧→ダウンロードの一連)は残っていたため、`tests/integration/test_projects_flow.py`をこの章で新設した。

### 2. ユーザー向けエラーメッセージの日本語化漏れ

`app/services/llm_retry.py`の`invoke_with_retry`が送出する`LLMQuotaExceededError("AI provider quota exceeded, please try again later")`・`GenerationFailedError("Failed to generate a response after multiple attempts")`が英語のままだったことが判明した。

これらは`doc_generator_service.py`内(バックグラウンドタスク)では捕捉されて日本語の専用メッセージに置き換わるため表面化しないが、`ChatService.check_completion`・`generate_opening_reply`が同じ例外を送出した場合、`get_hearing_completion`ルートはこれを捕まえずそのまま`AppError`ハンドラへ伝播させる(`app/api/routes/projects.py`参照)ため、英語のメッセージがそのまま`{"detail": "...", "code": "..."}`としてHTTPレスポンスに現れ、日本語UIの中に英語のエラー文が表示されてしまう。他のユーザー向け文言(`doc_generator_service.py`の`"本日の利用上限に達しました。..."`等)とも表記が矛盾していた。

このメッセージ文字列を日本語に修正した(ロジック自体の変更は無い)。修正は`llm_retry.py`という1箇所のみで完結する(`_is_quota_error`の判定基準・リトライ回数等は変更なし)。

### `test_projects_flow.py`の設計判断: 2つ目のフェイクLLM機構との使い分け

`app/api/routes/projects.py`の各ルートは`llm`を注入する引数を持たない(`ChatService(session)`/`DocGeneratorService(session)`をそのまま呼ぶ)ため、`llm=FakeLLM(...)`をテストコードから直接渡すことができない。既存のPhase 2単体テストは`ChatService.stream_reply(project, user_message=..., llm=FakeLLM(...))`のように各サービスメソッドへ直接`llm=`を渡しているが、本テストはHTTPルート経由(`client.post(...)`)のため、この経路が使えない。

代わりに`app.services.chat_service.get_gemini_llm`・`app.services.doc_generator_service.get_gemini_llm`を`pytest`の`monkeypatch`で差し替える(Pythonのimportは各モジュールの名前空間に個別に束縛されるため、`app.ai.llm.gemini`側だけを差し替えても両サービスモジュールには反映されない点に注意)。

これは[`Phase-4-3.md`](./Phase-4-3.md)が導入する、環境変数`E2E_FAKE_LLM`経由の`E2eFakeLLM`(ブラウザ経由のE2Eテスト専用)とは別の仕組みである。Playwrightは`docker compose`で起動する独立したOSプロセスをHTTP越しに操作するだけであり、pytestプロセス内の関数を`monkeypatch`で差し替える経路がそもそも存在しない。逆にpytestの統合テストは同一プロセス内でFastAPIアプリを直接呼び出す(`httpx.AsyncClient`+`ASGITransport`)ため、`monkeypatch`が使える。「テストの実行形態(同一プロセス内 vs 外部プロセスをHTTP越しに操作)によって、必要なフェイク注入の手段が変わる」という対応関係がこの2つの章の関係である。

## テスト観点(旧ルールの納期モード: 「動くこと」の確認)

| ファイル | 確認内容 |
| --- | --- |
| `test_llm_retry.py` | `GenerationFailedError`・`LLMQuotaExceededError`のメッセージが日本語(`"時間をおいて再度お試しください"`・`"本日の利用上限に達しました"`)を含むこと |
| `test_projects_flow.py` | 登録→プロジェクト作成→チャット送信→履歴取得→完了判定→生成トリガー→ドキュメント一覧→ダウンロードが最後まで通ること(ハッピーパス)。completed状態のプロジェクトへ新規メッセージを送ると`revising`へ遷移すること |

## 動作確認(このセッション内で実施)

- `uv run pytest tests/unit`で、本章時点では**114件green**(Phase 2-1〜3-6相当のまま。本章の`llm_retry.py`修正は既存2テストへのアサーション追加のみで新規テスト関数は増えていない)、`uvx pyright`で0エラー。unit全体の最終件数(125件、[`Phase-4-3.md`](./Phase-4-3.md)・[`Phase-4-5.md`](./Phase-4-5.md)分を含む)はPhase 4完了時点の数値として[`Phase-4-introduction.md`](./Phase-4-introduction.md)にまとめている。
- `conftest.py`の修正後、実PostgreSQL/Redis(`docker compose up postgres redis`、既にPhase 1で構築済みの環境)に対して`uv run pytest -m integration tests/integration`(この時点で存在する`test_auth_flow.py`・`test_health.py`・本章の`test_projects_flow.py`の**計5件**)を一括実行し、個別実行に頼らず**5件全てgreen**になることを確認した(修正前は同じ組み合わせで`Event loop is closed`/`attached to a different loop`によるERRORが複数件発生することを再現確認済み)。[`Phase-4-5.md`](./Phase-4-5.md)が追加する`test_security_and_performance.py`を含めた最終的な計9件一括green(かつ再現性の確認)は同章の「動作確認」参照。
- **既知の運用上の注意**: 認証系エンドポイント(`register`/`login`)にはIP・メール単位のレート制限(`app/services/auth_rate_limit.py`、既存機能)がかかっている。統合テストを同じ1時間以内に何度も繰り返し実行すると、この制限に達して無関係なテストが429で失敗することがある(バグではなく、レート制限が意図どおりに機能した結果。検証中に実際に踏み抜き、Redisを`FLUSHDB`して切り分けたことで判明した)。CI等で頻繁に実行する場合は、環境ごとにRedisをリセットするか、レート制限の設定値を確認すること。
- このセッション内で一時的に`devex-api/backend`へ反映して検証し(`conftest.py`の修正により、テスト実行が実DB・実Redisのテーブルを都度作成・破棄する設計のため、開発用DBのスキーマが一時的に失われる場面があった。`uv run alembic upgrade head`で復元し、検証後は元の状態に戻してある)、`conftest.py`の修正・`llm_retry.py`のメッセージ日本語化のみを反映した状態にしてある(いずれもサンプルへ既に反映済みのため、写経すればそのまま反映される)。

## Phase 4-1全体としての既知の残課題

- ルート配線の突き合わせは今回`app/api/routes/projects.py`のみを対象にした(`auth.py`/`users.py`/`chat.py`は既存の汎用デモ・Phase 2-2改訂分であり、Devexドメインの範囲外のため対象外とした)。
- `test_projects_flow.py`は生成される4文書の内容がすべて同一文字列(`FakeLLM`固定応答)になる設計(監査目的が配線確認であり、生成内容の品質確認はPhase 2-4の責務であるため)。将来この点が紛らわしいと感じた場合は`content_sequence`(`tests/fixtures/fake_llm.py`)で4つの異なる文字列を渡す形に変更してもよい(現時点でこれを要求する具体的な消費者は無いため、CLAUDE.md #17によりこの章では見送る)。
- 認証系のレート制限が統合テストの繰り返し実行に干渉しうる点(上記「動作確認」)は、テスト環境向けの緩和策(`TESTING`フラグでの無効化等)を導入せず現状のまま許容した(具体的な支障が繰り返し発生するまではCLAUDE.md #17により見送り)。
