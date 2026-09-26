# Phase-2-3: チャットヒアリングフロー設計 + chat_service.py

## この章の目的

初期ヒアリング入力(添付ファイル最大3件を含む)を受け付けるプロジェクト作成APIと、LLMとのヒアリング対話をSSEでストリーミング返却する`ChatService`を実装する。添付ファイル(txt/md/pdf)のテキスト化と、ヒアリング完了判定の基礎(構造化出力での5条件判定)までをこの章で対象とする。

**学習モード**(MVPコアループのためCLAUDE.md #21により固定。[`Phase-2-introduction.md`](./Phase-2-introduction.md)参照)。#14のとおりSUT/ドライバ/スタブを言語化する。用語(初出): **SUT**(テスト対象、System Under Test)/ **ドライバ**(テストを実行するテストコード自身)/ **スタブ**(外部依存の代替物、テストダブルの一種)。

サンプルは [`textbook/samples/backend/`](../samples/backend/) に追加した。写経前提として [`Phase-2-1.md`](./Phase-2-1.md)・[`Phase-2-2.md`](./Phase-2-2.md) の写経が完了していること。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): テストはまとめて表の末尾に置いている。

| ファイル(`devex-api/backend/`基準)                                                                        | 新規/更新 | 写経レベル        | 責務                                                                                                                         |
| --------------------------------------------------------------------------------------------------- | ----- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| [`app/schemas/project.py`](../samples/backend/app/schemas/project.py)                               | 新規    | 定型           | `IntakeFileRead`/`ProjectRead`/`ProjectDetail`                                                                             |
| [`app/schemas/hearing.py`](../samples/backend/app/schemas/hearing.py)                               | 新規    | 定型           | `HearingMessageRequest`/`ChatHistoryRead`                                                                                  |
| [`app/schemas/generation.py`](../samples/backend/app/schemas/generation.py)                         | 更新    | **コア**(追記部分) | 既存`FinalAnswer`に`HearingCompletionCheck`(完了判定5条件の構造化出力スキーマ)を追加(`FinalAnswer`自体は変更なし)                                       |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py)                               | 更新    | 定型           | `TooManyFilesError`/`UnsupportedFileTypeError`/`FileTooLargeError`を追加(既存の`ProjectNotFoundError`等は変更なし。**Phase 2-5でも追記あり**) |
| [`app/services/intake_file_processor.py`](../samples/backend/app/services/intake_file_processor.py) | 新規    | **コア**       | 添付ファイルのテキスト化(`extract_text`)                                                                                               |
| [`app/services/project.py`](../samples/backend/app/services/project.py)                             | 新規    | **コア**       | `ProjectService.create`(プロジェクト作成+添付ファイル取り込み)                                                                               |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py)                   | 新規    | **コア**       | `ChatService`(ヒアリング対話のストリーミング生成・完了判定。**Phase 2-5で`check_completion`に追記あり**)                                                |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py)                       | 新規    | 定型           | `POST /api/v1/projects`(multipart)ほか6エンドポイント(`GET .../hearing-completion`含む。**Phase 2-4・2-5でエンドポイント追記あり**)                                                |
| [`app/api/routes/__init__.py`](../samples/backend/app/api/routes/__init__.py)                       | 更新    | 定型           | `projects_router`の登録追加(既存3ルーターは変更なし)                                                                                       |
| ── ここからテスト(まとめて末尾) ──                                                                               |       |              |                                                                                                                            |
| [`tests/fixtures/fake_llm.py`](../samples/backend/tests/fixtures/fake_llm.py)                       | 更新    | 定型           | `FakeLLM`に`astream()`対応を追加(既存のinvoke系はそのまま。**Phase 2-4でも追記あり**)。`test_chat_service.py`が必要とする                               |
| `tests/unit/test_intake_file_processor.py`・`test_project_service.py`・`test_chat_service.py`         | 新規    | 定型           | 下記テスト観点参照                                                                                                                  |

## 主要な設計判断

### なぜLangGraphを使わないか

既存の汎用デモ(`app/ai/graph/`)はWeb検索を行うか否かという真の条件分岐を持ち、LangGraphの`StateGraph`が適している。ヒアリングフローは「ユーザー発話→LLM応答生成→(必要なら)完了判定」という一本道の処理であり、状態遷移グラフを持ち込むのは過剰と判断した。`ChatService`は素のLangChainメッセージ(`HumanMessage`/`AIMessage`/`SystemMessage`)と`get_gemini_llm()`(既存の`app/ai/llm/gemini.py`)だけで組み立てている。

### 添付ファイルのテキスト化(`intake_file_processor.py`)

`txt`/`md`はUTF-8デコードのみ(LLM呼び出し不要)。`pdf`はGemini(`get_gemini_llm()`が返す`ChatGoogleGenerativeAI`)へ`HumanMessage(content=[{"type": "text", ...}, {"type": "image_url", "image_url": {"url": f"data:application/pdf;base64,{b64}"}}])`という形でPDFのバイト列をbase64データURIとして直接渡す(Context7で`langchain-google-genai`の現行APIを確認済み)。LLMのネイティブなマルチモーダル理解により、図・レイアウトを含めた内容がテキスト化される。新規のPDF解析ライブラリは追加していない。

抽出に失敗しても例外は送出せず`(None, エラー理由)`を返す設計にした。`ProjectService._ingest_file`はこれを`IntakeFile.status='failed'`として記録するだけで、プロジェクト作成自体は成功させる(`docs/external_design.md` 2.5節5項「テキスト化に失敗した場合はヒアリング自体はブロックしない」)。

> **後続の改訂**: 実機検証で、`_extract_pdf_text`の`str(response.content)`がGeminiのthought signature付き応答をrepr化してしまい、抽出結果がチャット画面にそのまま表示される不具合が見つかった(`chat_service.py`の同種バグに続き2件目、`doc_generator_service.py`と合わせて3件目)。`extract_text_content`(`app/ai/llm/gemini.py`に共通化)で修正し、あわせて`chat_histories`の添付ファイルecho行の`sender`を`"intake"`から`"attachment"`に変更してチャット画面への表示を止めた(ヒアリング対話・ドキュメント生成のLLMコンテキストとしては引き続き使う)。詳細は[`decision-digest.md`](../decision-digest.md)「添付ファイル抽出結果の表示非表示化 + repr化バグの横展開修正(3箇所目)」節参照。

### `ChatService.stream_reply`のストリーミング設計

`llm.astream(messages)`が返すチャンクを1つずつ`yield`しながら文字列として蓄積し、ストリーム完了後にAI応答全体を1件の`chat_histories`行として保存する。ルート層(`api/routes/projects.py`)は`StreamingResponse`でSSE形式(`data: {"delta": "..."}\n\n`、終端は`data: [DONE]\n\n`)に変換する。

既知の簡略化: SSE接続がストリーム完了前に切断された場合、AI応答が`chat_histories`に保存されない(ユーザー発話のみ保存された状態になる)。再送・チャンクの部分永続化などの復旧機構はMVPスコープでは実装していない(#17: 現時点で実消費者のいない頑健性は見送り)。

> `llm = llm or get_gemini_llm()`の「or」の理由：
> テスト時に本物のGemini APIを叩かせないための差し替え(DI)
> 
> - 本番コード(ルート層など)はllmを渡さず呼ぶ → llmはNone(falsy)のまま → get_gemini_llm()(app/ai/llm/gemini.pyのlru_cache済み実クライアント)が使われる。
> - 単体テストはChatService().stream_reply(project, user_message=..., llm=FakeLLM(content="..."))のようにFakeLLMを明示的に渡す → FakeLLMインスタンスはtruthyなのでorの右辺(get_gemini_llm())は評価されず、実APIは一切呼ばれない。

> **後続の改訂**: `stream_reply`の冒頭に、`project.status == "completed"`のとき新規メッセージ永続化前に`project.status`を`"revising"`(修正中)へ変更する処理を追加した。生成済みプロジェクトのチャット画面を開いただけでは遷移させず、実際にメッセージを送信した時点でのみ遷移させる(「チャットに戻る」が常に修正指示を意味するとは限らないため)。詳細は[`decision-digest.md`](../decision-digest.md)「プロジェクトステータス「修正中(revising)」の導入 + ドキュメントへの常設リンク + ドキュメントプレビュー画面の2件の修正」節参照。

### ヒアリング完了判定(`check_completion`)

`docs/external_design.md` 2.3節の5条件をプロンプト化し、`HearingCompletionCheck`(`is_sufficient`/`summary`/`missing_points`)への構造化出力として判定させる。`is_sufficient=True`でも即座に生成へは進まない ── `summary`をユーザーに提示し明示的な承認を得るフローはPhase 3(フロントエンド)側の責務とし、本章では判定結果を返すところまでを実装した。`ChatService.check_completion`をルート層から呼び出す`GET /api/v1/projects/{project_id}/hearing-completion`もあわせて用意する(サービスメソッドだけを実装してルートを配線し忘れないよう、本節で明記する)。

> **[Phase 2-3 で確定 ── ルート配線の追記]** 当初`check_completion`をサービスメソッドとして実装した際、対応するAPIルート(`GET .../hearing-completion`)を配線し忘れていた → 追記。理由: Phase 3-5(チャットヒアリングUI)の準備中、フロントエンドが完了判定を取得する手段が無いことが判明した。Phase 3の教材・サンプルがこの時点でまだ本エンドポイントに依存していなかったため、rule #12の例外としてPhase 2-3を直接修正した([`decision-digest.md`](../decision-digest.md)参照。Phase 2-2のCookie化と同じ扱い)。

### `chat_histories.sender`とLangChainメッセージの対応

`_build_messages`が変換規則を持つ: `sender='ai'` → `AIMessage`、`sender in ('user', 'intake')` → `HumanMessage`(初期ヒアリング入力・添付ファイル抽出結果はユーザー側の文脈として扱う)、`sender='others'`(生成後の自己診断結果)はヒアリング中の対話には含めない。

> **後続の改訂**: 実機検証で、`ProjectService.create`がintakeを生JSONのまま`chat_histories`に保存し、チャット画面にそのまま表示されてしまう不具合が見つかった。`_format_intake_summary()`で整形済みテキストに置き換え、`environment`は表示から除外しつつ`_build_messages`(`project`引数を追加)経由でLLMコンテキストには渡すよう変更した。あわせて`ChatService.generate_opening_reply()`を新設し、プロジェクト作成直後にAIの最初の発話(理解の要約+確認したい事リスト+質問)を同期生成するようにした(`docs/external_design.md` SCR-004 §2.3の仕様を満たす)。詳細は[`decision-digest.md`](../decision-digest.md)「初回ヒアリング表示の整形 + AIの最初の発話の自動生成」節参照。

## テスト観点(#14)

### `intake_file_processor.extract_text`

- SUT: `extract_text`関数
- ドライバ: `tests/unit/test_intake_file_processor.py`の各テスト関数
- スタブ: **txt/mdの分岐はスタブ不要**(対象が純粋 ── 外部依存を呼ばないため)。**pdfの分岐は`FakeLLM`(`tests/fixtures/fake_llm.py`)をスタブとして使う**(`llm`パラメータで注入可能にしてあるため)。抽出失敗(LLM例外送出)もその場で定義した`_RaisingLLM`スタブで検証。

### `ChatService.stream_reply` / `check_completion`

- SUT: `ChatService`
- ドライバ: `tests/unit/test_chat_service.py`
- スタブ: `FakeLLM`(`stream_chunks`でストリーミング応答を、`structured`で完了判定の構造化出力を差し替える)。DBアクセスは`db_session`フィクスチャ(SQLite)の実リポジトリ呼び出しをそのまま使う(スタブ化しない ── 永続化ロジック自体を検証したいため)。
- `_build_messages`は非公開関数だが同一モジュール内なので直接importしてテストしている(sender→LangChainメッセージ種別の変換規則そのものを検証するため、`stream_reply`経由の間接テストより精度が高い)。
- `GET /{project_id}/hearing-completion`ルート自体は`llm`を注入する引数を持たない(他のLLM依存ルートと同じ設計)ため、`app.services.chat_service.get_gemini_llm`を`monkeypatch`で`FakeLLM`に差し替えてルート関数を直接呼ぶ(`test_ai_graph_nodes.py`と同じ手法)。ルートが`ChatService.check_completion`へ正しく委譲することだけを確認する薄いテストであり、判定ロジック自体は上記の`check_completion`テストで検証済み。

### `ProjectService.create`

- SUT: `ProjectService`
- ドライバ: `tests/unit/test_project_service.py`
- スタブ: **不要**(添付ファイルはtxt/mdのみでテストしており、`intake_file_processor.extract_text`のtxt分岐は純粋関数のため、実装をそのまま呼んでいる)。バリデーション(3件超過・非対応形式・サイズ超過)・テキスト化失敗時の非ブロッキング動作(例外を送出せず`status='failed'`で記録)を検証。

## 動作確認(このセッション内で実施)

- `uv run pytest tests/unit/test_intake_file_processor.py tests/unit/test_chat_service.py tests/unit/test_project_service.py`で19件green、`uv run pytest tests/unit`で既存分含め73件green、`uvx pyright`で0エラー。
- (Phase 3-5準備中に発覚した`GET .../hearing-completion`ルート追記後の再検証)`uv run pytest tests/unit/test_chat_service.py`で6件green、`uv run pytest tests/unit`で既存分含め92件green(Phase 2-1〜2-5相当)、`uvx pyright`で0エラーを確認済み(このセッション内で一時的に`devex-api/backend`へ反映して検証し、検証後は元の状態に戻した)。
- 実際にDocker Compose環境(Phase 1で構築済みの実Postgres/Redis)に対して `docker compose exec backend uv run alembic upgrade head` でテーブルを作成し、`POST /api/v1/auth/register`→`login`→`POST /api/v1/projects`(txtファイル添付、`multipart/form-data`)→`GET /api/v1/projects/{id}`→`GET /api/v1/projects/{id}/chat`を実際にcurlで呼び出し、`intake`のJSONB往復・`intake_files`のテキスト抽出・`chat_histories`への記録(`intake`行×2: 入力本体+添付ファイル)・存在しないプロジェクトIDでの404を確認した。`TooManyFilesError`(4ファイル添付)・`UnsupportedFileTypeError`(`.docx`)もHTTP 400で正しく返ることを確認した。検証後はテーブルを降格(`DROP TABLE`)し、`devex-api`のコードは写経前の状態に戻してある。
- 実際のGemini API呼び出し(PDFテキスト化・ヒアリング応答生成)は`GOOGLE_API_KEY`未設定のため実LLMでは未検証。`FakeLLM`による単体テストでロジックの正しさは検証済み(既存プロジェクトの方針どおり、単体テストで実LLMは呼ばない)。写経後、実際のAPIキーを設定した状態で一度は手動確認することを推奨する。
