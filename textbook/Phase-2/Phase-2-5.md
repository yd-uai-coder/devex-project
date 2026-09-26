# Phase-2-5: エクスポートAPI・エラーハンドリング

## この章の目的

生成済み設計書をMarkdownファイルとしてダウンロードするAPIを追加し、エラーレスポンスに`code`フィールドを付与する形へ拡張する。LLM呼び出しのリトライ・クォータ判定を共通化(`llm_retry.py`)し、未処理例外のcatch-allハンドラを整備して、Phase 2全体のエラーハンドリングを仕上げる。

納期モード([`Phase-2-introduction.md`](./Phase-2-introduction.md)参照)。#14のSUT/ドライバ/スタブの言語化は省略する。

サンプルは [`textbook/samples/backend/`](../samples/backend/) に追加した。写経前提として [`Phase-2-1.md`](./Phase-2-1.md)〜[`Phase-2-4.md`](./Phase-2-4.md) の写経が完了していること。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): テストはまとめて表の末尾に置いている。

| ファイル(`devex-api/backend/`基準)                                                                        | 新規/更新 | 写経レベル  | 責務                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`app/core/errors.py`](../samples/backend/app/core/errors.py)                                       | 更新    | 定型     | `AppError`に`code: ClassVar[str \| None]`を追加(既存の`status_code`定義・サブクラス群は変更なし)。**以下がすべてこれに依存するため先頭に置く**                                |
| [`app/api/error_handlers.py`](../samples/backend/app/api/error_handlers.py)                         | 更新    | 定型     | `code`が設定されている場合のみレスポンスに含める分岐+未処理例外のcatch-allハンドラを追加                                                                                |
| [`app/services/errors.py`](../samples/backend/app/services/errors.py)                               | 更新    | 定型     | 既存/Phase 2-2・2-3のエラーに`code`を付与、`DocumentNotFoundError`・`LLMQuotaExceededError`を追加、`GenerationFailedError`に`code="LLM_API_ERROR"`を追加 |
| [`app/services/llm_retry.py`](../samples/backend/app/services/llm_retry.py)                         | 新規    | **コア** | `invoke_with_retry`(リトライ+クォータ判定の共通化)                                                                                                |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py)                   | 更新    | 定型     | `check_completion`を`invoke_with_retry`でラップ(`stream_reply`・`_build_messages`は変更なし)                                                   |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新    | 定型     | 生成呼び出しを`invoke_with_retry`でラップ、`LLMQuotaExceededError`専用メッセージ                                                                       |
| [`app/api/routes/projects.py`](../samples/backend/app/api/routes/projects.py)                       | 更新    | 定型     | `GET /{project_id}/documents/{doc_id}/download`を追加(Phase 2-3・2-4の既存エンドポイントは変更なし)                                                    |
| ── ここからテスト(まとめて末尾) ──                                                                               |       |        |                                                                                                                                     |
| `tests/unit/test_error_handlers.py`・`test_llm_retry.py`・`test_document_download.py`                 | 新規    | 定型     | 下記参照                                                                                                                                |

## 主要な設計判断

### エラーレスポンスの形式を拡張(壊さない形で)

`docs/internal_design.md` 3.4節は`{"error": {"code","message","details"}}`という形を定義していたが、既存の`AppError`/`register_error_handlers`は`{"detail": "..."}`のみを返し、**devex-uiの`client.ts`もこの形を前提に実装済み**(既に動いている契約)。ゼロから作り直す理由がないため(CLAUDE.md #17)、`AppError`に`code: ClassVar[str | None] = None`を追加し、`code`が設定されている場合のみ`{"detail": "...", "code": "..."}`とする方式にした。既存の`ConversationNotFoundError`等、Devex以外の既存エラーは`code`を設定しておらず、レスポンス形は従来どおり`{"detail": ...}`のまま変わらない(後方互換)。`docs/internal_design.md` 3.4節のenvelope説明もこの実際の形に合わせて修正した。

### 未処理例外のcatch-allハンドラ(`INTERNAL_SERVER_ERROR`)

`docs/internal_design.md` 3.4節のエラーコード一覧を`AppError`ベースの例外に付与しただけでは、`AppError`ではない予期しない例外(バグ等)発生時に`INTERNAL_SERVER_ERROR`という契約どおりのレスポンスにならない(FastAPI既定の素の500になる)ことに気づき、`register_error_handlers`に`@app.exception_handler(Exception)`を追加した。詳細(スタックトレース等)はレスポンスに含めずサーバーログにのみ記録する(クライアントへの情報漏洩防止)。**既知の簡略化**: ログ出力は標準`logging`のみで、3.4節が言及するJSON構造化ログ(`structlog`)への統一は未実施(今後のPhaseでの課題)。

テスト時の注意点: httpxの`ASGITransport`は既定(`raise_app_exceptions=True`)でStarletteが再送出する未処理例外をテストコードへそのまま伝播させる(サーバー側のバグを握りつぶさないための意図的な既定動作)。catch-allハンドラが返すJSONレスポンス自体を検証したい場合は`ASGITransport(app=app, raise_app_exceptions=False)`にする必要がある(`test_error_handlers.py`参照)。

`AppError.code`の追加・この節のcatch-allハンドラは、`devex-api`自体がテンプレートリポジトリでもあることを踏まえ、Devexプロジェクト完了後にテンプレート側へ反映すべきかを判定・記録した。詳細は[`retrospective-memo.md`](../retrospective-memo.md)「`[テンプレート反映候補]` AppError.code / catch-allハンドラ」参照。

### リトライ・クォータ処理の共通化(`llm_retry.py`)

`docs/implementation_plan.md` 4.4節リスク1は「バックエンド側でリトライ処理(指数バックオフ)を実装する」ことをMVPの必須対策として挙げているが、Phase 2-3・2-4で実装した時点ではこれが漏れていた(既存の汎用デモ`app/services/chat.py`の`_invoke_with_retry`/`_is_quota_error`と同じロジックが必要)。`chat_service.py`(完了判定)・`doc_generator_service.py`(4文書生成+自己診断)の両方が同じリトライ・クォータ判定を必要とするため、複製せず`app/services/llm_retry.py`に共通化した(既存の`app/services/chat.py`自体は今回変更していない ── 動作している既存コードに手を入れる理由がないため、CLAUDE.md #17)。

**ストリーミング応答(`ChatService.stream_reply`)には適用していない**: SSEで途中までクライアントへ送信済みの可能性があり、最初からやり直すのは安全でないため。失敗時はストリームの中断をそのまま伝播させ、クライアント側の再送に委ねる設計とした。

> **後続の改訂**: Phase 2完了後の実機検証で、`stream_reply`がGeminiのthought signature付き応答(`content`が辞書のリスト)を無条件に`str()`していたため、AI返信がPythonのrepr文字列としてそのまま表示・保存される不具合が見つかった。`_extract_text()`ヘルパー(その後`app/ai/llm/gemini.py`の`extract_text_content`へ移設・共有化)で`text`フィールドのみを抽出するよう修正し、あわせて`_HEARING_SYSTEM_PROMPT`にユーザー提示内容の反復禁止を追記した。詳細は[`decision-digest.md`](../decision-digest.md)「Phase 2完了後 ── チャット応答のrepr化バグ修正とヒアリングプロンプト調整」節参照。

### LLMクォータ超過時の専用メッセージ

`LLMQuotaExceededError`(code: `LLM_QUOTA_EXCEEDED`)を新設し、`doc_generator_service.py`の失敗ハンドリングで他の失敗と区別する。`docs/internal_design.md` 3.4節が指定する「本日の利用上限に達しました」というユーザー向けメッセージをここで初めて実装した([`Phase-2-4.md`](./Phase-2-4.md)時点では汎用的な失敗メッセージのみだった)。

> **後続の改訂**: `_generate_one`・`_self_diagnose`の`str(response.content)`にも、上記と全く同じrepr化バグが見つかった(3箇所目)。`extract_text_content`(`app/ai/llm/gemini.py`)に置き換えて修正した。詳細は[`decision-digest.md`](../decision-digest.md)「添付ファイル抽出結果の表示非表示化 + repr化バグの横展開修正(3箇所目)」節参照。

### ダウンロードファイル名の非ASCII対応

`docs/external_design.md` 2.5節4項の命名規則(`{project_name}_{document_type}_{YYYYMMDD}.md`)はプロジェクト名に日本語が入る前提だが、HTTPヘッダは本来ASCII/Latin-1しか許容しない。RFC 5987に従い、`Content-Disposition`に`filename="..."`(ASCII置換フォールバック)と`filename*=UTF-8''...`(パーセントエンコード済みUTF-8)の両方を含める`_content_disposition`ヘルパーを実装した。日付は生成日時(`GeneratedDocument.created_at`)を使う(ダウンロード日ではない ── 同じバージョンは常に同じファイル名になるようにするため)。

## テスト観点(納期モード: 「動くこと」の確認)

| ファイル                        | 確認内容                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `test_llm_retry.py`         | 初回成功/一時的失敗からの回復/規定回数失敗後の`GenerationFailedError`/クォータエラー時は即座に`LLMQuotaExceededError`(リトライなし、呼び出し回数1回を確認)                                         |
| `test_error_handlers.py`    | `code`未設定エラーは`{"detail":...}`のみ、`code`設定エラーは`{"detail":..., "code":...}`、**未処理例外は500+`INTERNAL_SERVER_ERROR`**(`raise_app_exceptions=False`で検証) |
| `test_document_download.py` | 正しいMarkdown本文・ファイル名(doc_type・生成日を含む)・他プロジェクトのdoc_idでは`DocumentNotFoundError`・`_content_disposition`のASCII/UTF-8両対応                              |

## 動作確認(このセッション内で実施)

- `uv run pytest tests/unit/test_llm_retry.py tests/unit/test_error_handlers.py tests/unit/test_document_download.py`で11件green(catch-allハンドラのテストを含む)、`uv run pytest tests/unit`で既存分含め**91件green**、`uvx pyright`で0エラー。
- 実Docker Compose環境で、存在しないプロジェクトID(`ProjectNotFoundError`)と非対応ファイル形式(`UnsupportedFileTypeError`)の両方について、実際のHTTPレスポンスに`{"detail": "...", "code": "RESOURCE_NOT_FOUND"}` / `{"detail": "...", "code": "UNSUPPORTED_FILE_TYPE"}`が返ることを確認した。ダウンロードエンドポイントは、`generated_documents`に手動でテスト行を1件挿入したうえで実際にHTTPリクエストし、`Content-Disposition`が`filename="?????????_requirements_20260922.md"; filename*=UTF-8''%E3%83%80%E3%82%A6...`のように日本語ファイル名を正しくエンコードして返し、本文(Markdown)も正しく取得できることを確認した。検証後はテーブルを降格し、`devex-api`のコードは写経前の状態に戻してある。

## Phase 2全体としての既知の残課題(Phase 3以降への申し送り)

- `ChatService.stream_reply`はSSE接続が途中で切断された場合、AI応答が`chat_histories`に保存されない(ユーザー発話のみ保存された状態になる)。再送・部分永続化の復旧機構は未実装([`Phase-2-3.md`](./Phase-2-3.md)参照)。
- `intake_file_processor.extract_text`のPDF抽出はリトライを行わない(1回失敗したら`status='failed'`として記録するのみ)。添付ファイルは補助情報でありヒアリング自体をブロックしないため、現時点では許容している。
- 実際のGemini API呼び出しは`GOOGLE_API_KEY`未設定の環境のため、このPhase全体を通じて実LLMでは検証できていない(`FakeLLM`による単体テストのみ)。APIキー設定後の手動確認を推奨する。
