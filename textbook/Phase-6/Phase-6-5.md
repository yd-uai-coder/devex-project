# Phase-6-5: エラーハンドリング堅牢化・構造化ログ・監視

## この章の目的

ステージ2の3機能目、「エラーハンドリングの堅牢化・ログの構造化・監視強化」を実装する。`structlog`によるJSON構造化ログ、`SENTRY_DSN`設定時のみ有効化するSentryエラー追跡、既存`/health`への外部アップタイム監視という3本柱(仕様診断#28で確定済み)を導入する。既存のエラーレスポンス形式(`{"detail": ..., "code": ...}`)自体は変更しない。

自動実装モード: off([introduction](./Phase-6-introduction.md) 参照)。旧ルールの納期モード(旧 #21)で書いた章。ログレベル定義・プライバシー方針・監視方針はいずれも仕様診断#28で確定済みの判断のため、#14のSUT/ドライバ/スタブの言語化は省略しない。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): テストはまとめて表の末尾に置いている。

| ファイル(`devex-api/backend/`基準) | 新規/更新 | 写経レベル | 責務 |
|---|---|---|---|
| [`pyproject.toml`](../samples/backend/pyproject.toml) | 更新 | 定型 | `structlog`・`sentry-sdk`を直接依存に追加(`sentry-sdk`は既存の間接依存を格上げ) |
| [`app/core/config.py`](../samples/backend/app/core/config.py) | 更新 | 定型 | `SENTRY_DSN`(nullable)を追加 |
| [`app/core/logging.py`](../samples/backend/app/core/logging.py) | 新規 | 定型 | `configure_logging`(structlogのJSON構造化ログ設定。DEBUGログの出力可否は`settings.DEBUG`に従う) |
| [`app/services/llm_retry.py`](../samples/backend/app/services/llm_retry.py) | 更新 | **コア** | `prompt_char_count`ヘルパーの追加+`invoke_with_retry`へのログ集約(DEBUG成功時・WARNING一時失敗/クォータ超過・ERROR最終失敗) |
| [`app/services/chat_service.py`](../samples/backend/app/services/chat_service.py) | 更新 | 定型 | `check_completion`/`generate_opening_reply`が`invoke_with_retry`へ`messages`を渡す。`stream_reply`(`invoke_with_retry`を経由しない)はDEBUGログを個別に記録 |
| [`app/services/doc_generator_service.py`](../samples/backend/app/services/doc_generator_service.py) | 更新 | 定型 | `_generate_one`/`_self_diagnose`が`messages`を渡す。生成完了時にINFOログを追加 |
| [`app/services/project.py`](../samples/backend/app/services/project.py) | 更新 | 定型 | プロジェクト作成完了時にINFOログを追加(project_idのみ、本文は含めない) |
| [`app/api/error_handlers.py`](../samples/backend/app/api/error_handlers.py) | 更新 | 定型 | 標準`logging`→`structlog`への置き換え+`sentry_sdk.capture_exception`の呼び出しを追加 |
| [`app/main.py`](../samples/backend/app/main.py) | 更新 | 定型 | 起動時に`configure_logging()`を呼び、`SENTRY_DSN`設定時のみ`sentry_sdk.init` |
| ── ここからテスト(まとめて末尾) ── | | | |
| [`tests/conftest.py`](../samples/backend/tests/conftest.py) | 更新 | 定型 | `_reset_structlog_state`(autouse)を追加。`app.main`のimportがstructlogのグローバル設定を書き換える影響を各テスト前後でリセットする |
| [`tests/unit/test_logging_config.py`](../samples/backend/tests/unit/test_logging_config.py) | 新規 | 定型 | `configure_logging`のJSONRenderer設定・冪等性の確認 |
| [`tests/unit/test_llm_retry.py`](../samples/backend/tests/unit/test_llm_retry.py) | 更新 | 定型 | `prompt_char_count`+DEBUG/WARNING/ERRORログのテストを追加 |
| [`tests/unit/test_config_safety.py`](../samples/backend/tests/unit/test_config_safety.py) | 更新 | 定型 | `SENTRY_DSN`の既定値`None`を確認するテストを追加 |
| [`tests/unit/test_error_handlers.py`](../samples/backend/tests/unit/test_error_handlers.py) | 更新 | 定型 | ERRORログ+`sentry_sdk.capture_exception`呼び出しのテストを追加 |
| [`tests/unit/test_project_service.py`](../samples/backend/tests/unit/test_project_service.py) | 更新 | 定型 | プロジェクト作成時のINFOログ(本文非含有)のテストを追加 |
| [`tests/unit/test_chat_service.py`](../samples/backend/tests/unit/test_chat_service.py) | 更新 | 定型 | `stream_reply`のDEBUGログ(本文非含有)のテストを追加 |
| [`tests/unit/test_doc_generator_service.py`](../samples/backend/tests/unit/test_doc_generator_service.py) | 更新 | 定型 | 生成完了時のINFOログのテストを追加 |

インフラ系ファイル(samples対象外、実プロジェクトへ直接反映済み): [`devex-api/.env.example`](../../devex-api/.env.example)・[`devex-api/backend/.env.example`](../../devex-api/backend/.env.example)(`SENTRY_DSN`追加)、[`devex-api/OPERATIONS.md`](../../devex-api/OPERATIONS.md)(7.1節Sentry設定手順・7.2節UptimeRobot設定手順を追加)。

## 設計判断

### なぜ全てのLLM単発呼び出しのログを`invoke_with_retry`一箇所に集約したか

`check_completion`・`generate_opening_reply`(chat_service.py)、`_generate_one`・`_self_diagnose`(doc_generator_service.py)の4箇所は、いずれも「メッセージ列を組み立てて`invoke_with_retry(_call)`を呼ぶ」という同じ形をしている。ログ記録(DEBUG成功時のレイテンシ・プロンプト文字数、WARNING一時失敗・クォータ超過、ERROR最終失敗)を各呼び出し元に個別に書くと4箇所への重複になるため、`invoke_with_retry`が新たに受け取る`messages`引数(ログ専用、呼び出しには使わない)を使ってこの一箇所に集約した。ストリーミング(`stream_reply`)だけは元々`invoke_with_retry`を経由しない設計(既存docstring参照)のため、DEBUGログはそこだけ個別に記録している。

### なぜ`prompt_char_count`が文字列content以外を無視するか

`langchain_core.messages.BaseMessage.content`は、Geminiのthought signature付き応答等で`str`ではなく`list[dict]`になることがある(`app/ai/llm/gemini.py`の`extract_text_content`が既に対応済みの既知の形)。DEBUGログはプロンプトの「文字数」という概算メタデータのみを目的としており、非`str`のcontentを無理に文字列化して数えることに意味は無いため、`isinstance(m.content, str)`で素通しに絞った。

### なぜINFOログの対象を「プロジェクト作成」「ドキュメント生成完了」の2つに絞ったか

内部設計書3.4節はINFOの例として「APIリクエストの受付、プロジェクト作成、ドキュメント生成完了などの主要なライフサイクルイベント」を挙げるが、「APIリクエストの受付」は本章では実装していない。uvicornの標準アクセスログが既にリクエスト単位のログを出力しており、ここに独自のミドルウェアで重複するINFOログを追加する実益が薄いと判断した(rule #17: 今の実消費者・実益が無い先回りは見送る)。プロジェクト作成・ドキュメント生成完了の2つは、それぞれ`ProjectService.create`・`DocGeneratorService.generate`という単一の完了地点を持つ明確なライフサイクルイベントであり、実装コストと運用上の価値のバランスが良いと判断してこの2つに絞った。

### なぜWARNINGログの対象を「LLM呼び出しの一時的失敗」「クォータ超過」の2つに絞ったか

内部設計書3.4節はWARNINGの例として「外部APIの応答遅延、バリデーションエラー等の軽微な問題」を挙げるが、`AppError`系のバリデーションエラー(`TooManyFilesError`等)は既に`app/api/error_handlers.py`経由でHTTPレスポンスとして返る4xxであり、ユーザーの入力ミス相当のものを毎回WARNINGとしてログに残しても運用上のシグナルにならない(ノイズになる)と判断し、あえて実装しなかった。`invoke_with_retry`内の一時的失敗・クォータ超過の2つは、外部サービス(Gemini API)側の状態を反映する、実際に運用上ウォッチする価値のあるシグナルであるため実装した。

### なぜSentryへの送出を`sentry_sdk`の自動計装に任せず明示的に`capture_exception`を呼ぶか

`sentry_sdk.init()`はFastAPI/Starletteの自動計装(`FastApiIntegration`)を持ち、多くの場合は`init`を呼ぶだけで未処理例外を自動収集できる。しかし本プロジェクトは`@app.exception_handler(Exception)`で全ての未処理例外を自前でキャッチしJSONレスポンスに変換しているため、この一括ハンドラが例外を「処理済み」にしてしまい、自動計装が拾えるかはStarletteの内部実装(バージョン)に依存し確実ではない。挙動をフレームワークの内部詳細に依存させたくなかったため、`handle_unexpected_error`内で明示的に`sentry_sdk.capture_exception(exc)`を呼ぶ設計にした。`SENTRY_DSN`未設定時(=`sentry_sdk.init`を呼んでいない)でも`capture_exception`はクライアント未設定を検知して即座に何もせず戻るため、無条件に呼んでも完全にno-opのままである(動作確認で確認済み、下記参照)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `app.core.logging.configure_logging` | pytest(直接呼び出し) | スタブ不要 ── structlogのグローバル設定を変更するだけ | `test_logging_config.py` |
| `prompt_char_count` | pytest(直接呼び出し) | スタブ不要 ── 対象が純粋(メッセージ列を受け取り数値を返すだけ) | `test_llm_retry.py` |
| `invoke_with_retry`(ログ記録) | pytest(直接呼び出し) | スタブ不要。`structlog.testing.capture_logs()`でログ内容自体を検証する(DBアクセス・外部LLM呼び出しは含まない) | `test_llm_retry.py` |
| `ChatService.stream_reply`(DEBUGログ) | pytest(直接呼び出し) | `FakeLLM`(既存) | `test_chat_service.py` |
| `ProjectService.create`(INFOログ) | pytest(直接呼び出し) | スタブ不要 ── DBアクセスのみ | `test_project_service.py`。ログにsystem_overview本文が含まれないことも確認 |
| `DocGeneratorService.generate`(INFOログ) | pytest(直接呼び出し) | `FakeLLM`(既存) | `test_doc_generator_service.py` |
| `handle_unexpected_error`(ERRORログ+Sentry送出) | pytest+httpx `ASGITransport`(既存パターン) | `monkeypatch`で`sentry_sdk.capture_exception`を差し替え、呼び出し自体を確認 | `test_error_handlers.py` |

## 動作確認(実施済み)

samples反映後、devex-apiの実環境へ一時的に適用して以下を確認した(検証後は元の状態に復元済み、実プロジェクトへの反映は各自の写経による)。

```bash
cd backend
uv run pytest -m "not integration"
# 141 passed(既存分含む)
uv run ruff check .
# 本章が触れた範囲は全てAll checks passed
uvx pyright
# 本章の変更による新規エラー0件(既知の1件、app/ai/llm/gemini.pyのみ残存)
```

あわせて以下をスクリプトで直接動作確認した:

```bash
# structlogのJSON出力(DEBUG=trueで実行)
DEBUG=true uv run python3 -c "
from app.core.logging import configure_logging
import structlog
configure_logging()
structlog.get_logger('smoke').debug('smoke_debug_event', foo='bar')
"
# => {"foo": "bar", "event": "smoke_debug_event", "level": "debug", "timestamp": "..."}

# SENTRY_DSN未設定時、capture_exceptionが完全no-opであること
uv run python3 -c "
import sentry_sdk
print(sentry_sdk.get_client().is_active())  # False
sentry_sdk.capture_exception(ValueError('x'))  # 例外を起こさず戻る
"
```

### 検証時に見つけたテスト間の状態漏れ(修正済み)

`test_cors.py`が実アプリ(`app.main`)をimportし、`app/main.py`の起動時`configure_logging()`呼び出しがstructlogのグローバル設定を書き換える。この変更はプロセス全体・テストセッション全体に及ぶため、`structlog.testing.capture_logs()`でDEBUGログを検証する他のテスト(`test_llm_retry.py`・`test_chat_service.py`)が、テスト実行順序によっては「DEBUGログがしきい値でフィルタされ記録されない」という順序依存の失敗を起こすことが分かった(`capture_logs()`はprocessorsのみを差し替え、フィルタしきい値(`wrapper_class`)までは上書きしないため)。個別のテストファイルではなく`tests/conftest.py`に`_reset_structlog_state`(autouse、各テストの前後でstructlogをライブラリ既定値へリセット)を追加し、どのテストファイルが`app.main`をimportしても他のテストへ影響しないようにした。

## 既知の残課題

- uvicorn自身のアクセスログ・エラーログは、標準`logging`のフォーマットのまま(structlogのJSON形式には統一していない)。個人開発規模でこれらのログを構造化された形で解析する具体的な必要性が今のところ無いため見送った(rule #17)。
- Prometheus/Grafana等の自前メトリクス基盤、OpenTelemetryによる分散トレーシングは、仕様診断#28の決定どおり導入しない。
