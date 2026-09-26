# Phase 2 導入: バックエンド開発

## 目的

[`docs/implementation_plan.md`](../../docs/implementation_plan.md) 4.2節 WBS区分2(バックエンド開発タスク)を実装する: DB移行・プロジェクト所有権チェック・チャットヒアリングフロー・ドキュメント生成・エクスポート/エラーハンドリングの5章構成で、Stage1 MVPのバックエンドAPI一式(`/api/v1/projects/...`)を完成させる。Phase 1(環境構築)の上に構築し、Phase 3(フロントエンド)がこのAPIを消費する。

直前のセッションで文書アップロード要件を`docs/*.md`に反映済み(`intake_files`テーブル、txt/md/pdf対応、PDFはGeminiのネイティブファイル理解でテキスト化)。本Phaseはこの拡張済み仕様を前提にしている。

## 実装フローの方針: 全章で写経統一

CLAUDE.md #21(納期モード)は教材の記述の厚さ(#14 SUT/ドライバ/スタブの言語化要否)の話であり、「誰が実装コードを書くか」には関与しない。当初「納期モード章はAIが`devex-api`を直接実装」という案を検討したが、2-1/2-2を自動実装した状態で2-3(写経待ち)を飛ばして2-4/2-5を自動実装すると、ユーザーの写経進捗と`devex-api`の実コード状態がずれ、後続章が前提にするコードの整合性が保証できなくなるという問題が判明し、**モードに関わらず全5章でCLAUDE.md #3の原則(AIはsamples+教材のみ作成し、`devex-api`の実ファイルには触れない。写経はユーザーが手で行う)に統一した**。サンプルコードはどの章も一時的に`devex-api`環境で`pytest`/`pyright`検証した後、実ファイルには反映せず元に戻している。

## 前提

- [`Phase-1/`](../Phase-1/Phase-1-introduction.md)の写経・動作確認が完了していること(Docker Compose環境、`.env`)。
- `docs/internal_design.md` 3.2節(データモデル)・3.3節(バックエンド処理・モジュール設計)・3.4節(エラーハンドリング)、`docs/external_design.md` 2.3節(SCR-004)・2.5節(データ入出力仕様)を一読していること。
- `devex-api/CLAUDE.md`のレイヤー構成(routes→services→repositories→models)・エラーハンドリング方針・LLM/LangGraph連携の既存パターンを把握していること(既存の`app/services/chat.py`・`app/repositories/conversation.py`が随所で参照パターンとして登場する)。

## 章一覧

| 章 | トピック | モード | 依存 |
|---|---|---|---|
| [`Phase-2-1.md`](./Phase-2-1.md) | DB移行(`projects`/`chat_histories`/`generated_documents`/`prompt_templates`/`intake_files`) | 納期 | Phase 1 |
| [`Phase-2-2.md`](./Phase-2-2.md) | 認証基盤・プロジェクト所有権チェック(`CurrentProjectDep`)+ JWTリフレッシュトークンのhttpOnly Cookie化 | 納期 | 2-1 |
| [`Phase-2-3.md`](./Phase-2-3.md) | チャットヒアリングフロー設計 + `chat_service.py`(SSEストリーミング、添付ファイル取り込み) | **学習**(MVPコア) | 2-1, 2-2 |
| [`Phase-2-4.md`](./Phase-2-4.md) | ドキュメント生成ロジック `doc_generator_service.py`(4文書一括生成+自己診断) | **学習**(MVPコア) | 2-1〜2-3 |
| [`Phase-2-5.md`](./Phase-2-5.md) | エクスポートAPI・エラーハンドリング(ダウンロード、エラーコード、リトライ) | 納期 | 2-1〜2-4 |

学習モード(2-3・2-4)はCLAUDE.md #21により、MVPコアループ(チャット↔4文書生成)に関わる章として常に学習モード固定。

## サンプルコード一覧

[`textbook/samples/backend/`](../samples/backend/)(構成は`devex-api/backend/`を鏡写し)に、本Phaseで作成・更新した全ファイルを置いた。各章の「この章で作成・更新したファイル」表を参照。主な新規ファイル:

- `app/models/{project,chat_history,generated_document,prompt_template,intake_file}.py`
- `app/repositories/{project,chat_history,generated_document,intake_file}.py`
- `app/services/{project,chat_service,doc_generator_service,intake_file_processor,llm_retry,errors}.py`
- `app/schemas/{project,hearing,document,generation}.py`、`app/schemas/auth.py`(更新)
- `app/api/routes/projects.py`、`app/api/deps.py`(追記)、`app/api/routes/auth.py`(更新)
- `alembic/versions/9c91eca2a657_devex_domain_tables.py`
- `tests/integration/test_auth_flow.py`(更新)

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | ファイル | 役割1行 | テスト観点 |
|---|---|---|---|
| 2-1 | `models/*.py`・`repositories/*.py`・migration | 5テーブルのORM定義+CRUD+バージョニング | `pytest tests/unit/test_{project,chat_history,generated_document,intake_file}_repository.py` |
| 2-2 | `api/deps.py`(`get_current_project`・`RefreshTokenCookieDep`)、`schemas/auth.py`、`api/routes/auth.py` | プロジェクト所有権チェックの共通依存関数 + JWTリフレッシュトークンのhttpOnly Cookie化 | `pytest tests/unit/test_deps_current_project.py`、`pytest -m integration tests/integration/test_auth_flow.py`(個別実行) |
| 2-3 | `services/{project,chat_service,intake_file_processor}.py`、`schemas/*.py`、`routes/projects.py` | プロジェクト作成+添付ファイル取り込み+ヒアリングSSE+完了判定 | `pytest tests/unit/test_{project_service,chat_service,intake_file_processor}.py` |
| 2-4 | `services/doc_generator_service.py` | 4文書生成+自己診断のオーケストレーション(BackgroundTasks) | `pytest tests/unit/test_doc_generator_service.py` |
| 2-5 | `services/llm_retry.py`、`core/errors.py`・`api/error_handlers.py`(追記)、`routes/projects.py`(download追記) | リトライ/クォータ処理共通化、エラーコード、ダウンロードAPI | `pytest tests/unit/test_{llm_retry,error_handlers,document_download}.py` |

## Phase完了チェック(#22)

1. なぜ`chat_service.py`はLangGraphを使わず素のLangChainメッセージで組み立てているか、既存の`app/ai/graph/`との違いを踏まえて説明できるか。
2. `intake_files`テーブルの`extracted_text`に格納される内容は、`file_type`によってどう変わるか(txt/md/pdf)説明できるか。
3. `DocGeneratorService.generate`がなぜ`SessionDep`をそのまま受け取らず`project_id`のみを受け取って自前でセッションを開始するか、FastAPI 0.106以降の`BackgroundTasks`とdependencies-with-yieldの関係を踏まえて説明できるか。
4. `GeneratedDocumentRepository.create_version`のバージョニング(直近3件保持)のロジックを、コードを見ずに説明できるか。
5. エラーレスポンスがなぜ`{"error": {...}}`ではなく`{"detail": ..., "code": ...}`という形になったか、その理由をCLAUDE.md #17と結びつけて説明できるか。
6. `ChatService.stream_reply`にリトライを適用していない理由を説明できるか。
7. リフレッシュトークンをJSONボディではなくhttpOnly Secure Cookieでやり取りするのはなぜか、`httponly`/`secure`/`samesite`/`path`各属性の役割とあわせて説明できるか。

## 写経順序(#23)

章番号順(2-1 → 2-2 → 2-3 → 2-4 → 2-5)。2-2は2-1のモデル/リポジトリに、2-3は2-1・2-2に、2-4は2-1・2-3に、2-5は2-1〜2-4すべてに依存する。写経後は各章末尾の「動作確認」節のコマンドで都度確認しながら進めること。

## Phase 2全体としての既知の残課題

[`Phase-2-5.md`](./Phase-2-5.md)末尾「Phase 2全体としての既知の残課題」参照(SSE切断時の非永続化、PDF抽出のノーリトライ、実Gemini API未検証)。

## 次のフェーズ

**Phase 3**: フロントエンド開発(3-1 認証画面・ダッシュボード、3-2 チャットヒアリングUI、3-3 ドキュメントプレビューUI)。詳細は [`Phase-0-2.md`](../Phase-0/Phase-0-2.md) のロードマップを参照。ユーザーが「Phase 3を開始する」と発話するまでは着手しない(#5)。
