# M-03-T01 チャットヒアリングとLangGraph対話処理・エラーハンドリングを実装する

> 種別: 機能 / マイルストーン: M-03 チャットヒアリングと例外処理機能 / 要件: FR-001, FR-006, FR-012, FR-013 / 依存: M-02-T01

## 目的

チャットメッセージの送信受付、LangGraphを活用したAIエージェントによる対話処理、およびチャット履歴の永続化とエラーハンドリングを実装する。

## 対象の処理・参照する設計

- 内部設計書 DF-002 POST /api/v1/projects/{id}/chat
- 内部設計書 3.3 `backend/app/services/ai_agent.py`
- 内部設計書 3.3 `backend/app/services/chat_service.py`
- 内部設計書 3.3 `backend/app/api/v1/endpoints/chat.py`

## 作成・変更するファイル(依存順)

| ファイル | 種類 | 責務 | 根拠 |
|---|---|---|---|
| `backend/app/services/ai_agent.py` | モジュール | LangGraphを利用した対話処理とGemini API呼び出しを行う | 段階4のモジュール |
| `backend/app/services/chat_service.py` | モジュール | メッセージのバリデーション、履歴のロード、DB保存のビジネスロジックを制御する | 段階4のモジュール |
| `backend/app/api/v1/endpoints/chat.py` | モジュール | POST /api/v1/projects/{id}/chat のリクエストを受け付け、サービス層を呼び出してレスポンスを返す | 段階4のモジュール |

## 実装の要点(設計に書いていないことだけ)

- 依存関係に従い、ai_agent.py、chat_service.py、chat.pyの順に実装する。
- 共通エラーレスポンス形式に従い、例外発生時は指定されたJSON構造でレスポンスを返却する。

## テスト観点

| # | 観点 | SUT | ドライバ | スタブ |
|---|---|---|---|---|
| TC-01 | 正常なメッセージ送信によりAI応答が取得でき、DBに保存されること | POST /api/v1/projects/{id}/chat | API手動テスト (curl / Postman) | 外部サービス (Gemini API) はダウングレードまたはモック化して検証可能とする |
| TC-02 | 空文字や制限超過のメッセージ送信時に適切なエラーレスポンスが返ること | POST /api/v1/projects/{id}/chat | API手動テスト (curl / Postman) | スタブ不要 ── バリデーション層の検証 |

- Given 有効なプロジェクトIDとチャットメッセージがある When APIにPOSTリクエストを送る Then AI応答が返りメッセージが保存される
- Given 空のメッセージがある When APIにPOSTリクエストを送る Then 400エラーが返る

## 確認方法

- curlまたはPostmanを使用して POST /api/v1/projects/{id}/chat にリクエストを送り、期待されるレスポンスとDBへの保存状態を確認する。

## 未定義・要決定

なし
