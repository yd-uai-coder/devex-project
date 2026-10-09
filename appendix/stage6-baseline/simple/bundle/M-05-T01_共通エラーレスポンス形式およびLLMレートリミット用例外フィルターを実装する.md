# M-05-T01 共通エラーレスポンス形式およびLLMレートリミット用例外フィルターを実装する

> 種別: 基盤 / マイルストーン: M-05 共通エラーハンドリングとフロントエンド統合 / 依存: M-04-T02

## 目的

共通エラーレスポンス形式およびLLMレートリミット用例外フィルター、構造化ログインターセプターを実装する。

## 対象の処理・参照する設計

- 内部設計書 3.2 データモデル

## 作成・変更するファイル(依存順)

| ファイル | 種類 | 責務 | 根拠 |
|---|---|---|---|
| `backend/src/common/filters/http-exception.filter.ts` | モジュール | 発生した例外をキャッチし、共通エラーレスポンス形式およびLLMレートリミット用エラーに変換して返却する。 | 対象の単位 |
| `backend/src/common/interceptors/logging.interceptor.ts` | モジュール | リクエストとレスポンスをインターセプトし、構造化ログを出力する。 | 対象の単位 |
| `backend/src/common/filters/http-exception.filter.spec.ts` | テスト | 例外フィルターの動作を検証する単体テストを実施する。 | 実装計画書 4.3 自動テスト・CI/CD方針 |
| `backend/src/common/interceptors/logging.interceptor.spec.ts` | テスト | ロギングインターセプターの動作を検証する単体テストを実施する。 | 実装計画書 4.3 自動テスト・CI/CD方針 |

## 実装の要点(設計に書いていないことだけ)

- NestJSのExceptionFilterインターフェースを実装してHttpExceptionFilterを作成する。
- NestJSのNestInterceptorインターフェースを実装してLoggingInterceptorを作成する。
- 依存関係の順序として、共通モジュール群を先に配置した後にテストを作成する。

## テスト観点

| # | 観点 | SUT | ドライバ | スタブ |
|---|---|---|---|---|
| TC-01 | HTTP例外発生時に指定された共通エラーレスポンス形式で返却されること | HttpExceptionFilter | Jestを用いた単体テスト | スタブ不要 ── 単体で完結するため |
| TC-02 | LLMレートリミットエラー発生時に専用のエラーコードが返却されること | HttpExceptionFilter | Jestを用いた単体テスト | スタブ不要 ── 単体で完結するため |
| TC-03 | リクエスト処理時に構造化ログが出力されること | LoggingInterceptor | Jestを用いた単体テスト | ExecutionContextおよびCallHandlerのモックを使用する |

- Given 不正なリクエストが発生したとき, When 例外フィルターが作動すると, Then 共通エラーレスポンス形式のJSONが返却されること
- Given LLMのレートリミット超過エラーが発生したとき, When 例外フィルターが作動すると, Then 専用のエラーコードと再試行促しメッセージが返却されること
- Given APIリクエストが送信されたとき, When ロギングインターセプターを経由すると, Then 標準出力に構造化ログが出力されること

## 確認方法

- backend ディレクトリにて npm test を実行し、新規追加した例外フィルターおよびロギングインターセプターのテストが全て成功することを確認する。

## 未定義・要決定

なし
