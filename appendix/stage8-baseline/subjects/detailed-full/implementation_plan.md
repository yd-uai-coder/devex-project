# 実装計画書: Devex

## 1 マイルストーン

| M-ID | 名前 | 優先度 | ゴール | 処理 |
|---|---|---|---|---|
| M-01 | 環境構築と認証・土台の実装 | Must | 開発環境が整い、ユーザー登録およびログイン機能が安全に動作する | F-01, F-02 |
| M-02 | プロジェクト管理と参考資料アップロードの実装 | Must | プロジェクトの作成・一覧取得、および参考資料のテキスト化と保持ができるようになる | F-03, F-04, F-06 |
| M-03 | チャットヒアリング機能の実装 | Must | AIとのチャットによるヒアリングおよび文字数・空送信のバリデーションが機能する | F-05 |
| M-04 | 構造化サマリ承認と文書生成・版管理の実装 | Must | 構造化サマリの承認から4種文書の順次生成・自己診断を行い、版履歴を取得・プレビューできるようになる | F-07, F-08 |

### M-01 環境構築と認証・土台の実装(Must)

ゴール: 開発環境が整い、ユーザー登録およびログイン機能が安全に動作する

| ID | 種別 | タスク | 処理 | 依存 | モジュール | 環境・設定のファイル(例) |
|---|---|---|---|---|---|---|
| M-01-T01 | 基盤 | Docker環境、データベース接続、共通例外ハンドラー、およびRedisキャッシュの土台を構築する | — | — | app/main.py, app/cache/token.py | Dockerfile, docker-compose.yml |
| M-01-T02 | 機能 | ユーザー登録機能の実装 | F-01 | M-01-T01 | app/api/routes/auth.py, app/services/auth.py, app/repositories/user.py | — |
| M-01-T03 | 機能 | ログイン機能の実装 | F-02 | M-01-T02 | app/api/routes/auth.py, app/services/auth.py, app/repositories/user.py, app/cache/token.py | — |

### M-02 プロジェクト管理と参考資料アップロードの実装(Must)

ゴール: プロジェクトの作成・一覧取得、および参考資料のテキスト化と保持ができるようになる

| ID | 種別 | タスク | 処理 | 依存 | モジュール | 環境・設定のファイル(例) |
|---|---|---|---|---|---|---|
| M-02-T01 | 機能 | プロジェクト一覧取得機能の実装 | F-03 | M-01-T03 | app/api/routes/projects.py, app/services/project.py, app/services/auth.py, app/repositories/project.py | — |
| M-02-T02 | 機能 | プロジェクト作成機能の実装 | F-04 | M-02-T01 | app/api/routes/projects.py, app/services/project.py, app/services/auth.py, app/repositories/project.py | — |
| M-02-T03 | 機能 | 参考資料アップロード機能の実装 | F-06 | M-02-T02 | app/api/routes/documents.py, app/services/auth.py, app/services/document.py, app/repositories/document.py | — |

### M-03 チャットヒアリング機能の実装(Must)

ゴール: AIとのチャットによるヒアリングおよび文字数・空送信のバリデーションが機能する

| ID | 種別 | タスク | 処理 | 依存 | モジュール | 環境・設定のファイル(例) |
|---|---|---|---|---|---|---|
| M-03-T01 | 機能 | チャットメッセージ送信とLLM連携機能の実装 | F-05 | M-02-T02 | app/api/routes/chat.py, app/services/chat.py, app/llm/client.py, app/repositories/chat.py | — |

### M-04 構造化サマリ承認と文書生成・版管理の実装(Must)

ゴール: 構造化サマリの承認から4種文書の順次生成・自己診断を行い、版履歴を取得・プレビューできるようになる

| ID | 種別 | タスク | 処理 | 依存 | モジュール | 環境・設定のファイル(例) |
|---|---|---|---|---|---|---|
| M-04-T01 | 機能 | 構造化サマリ承認と文書生成開始機能の実装 | F-07 | M-03-T01 | app/api/routes/summary.py, app/services/summary.py, app/services/auth.py, app/repositories/summary.py, app/repositories/document.py, app/llm/client.py | — |
| M-04-T02 | 機能 | 生成文書および版一覧取得機能の実装 | F-08 | M-04-T01 | app/api/routes/documents.py, app/services/auth.py, app/services/document.py, app/repositories/document.py | — |

## 2 処理の割り当て

| 処理ID | 名称 | 単位 |
|---|---|---|
| F-01 | ユーザー登録する | M-01-T02 |
| F-02 | ログインする | M-01-T03 |
| F-03 | プロジェクト一覧を取得する | M-02-T01 |
| F-04 | プロジェクトを作成する | M-02-T02 |
| F-05 | チャットメッセージを送信する | M-03-T01 |
| F-06 | 参考資料をアップロードする | M-02-T03 |
| F-07 | 構造化サマリを承認して文書生成を開始する | M-04-T01 |
| F-08 | 生成文書および版一覧を取得する | M-04-T02 |

## 3 開発環境・事前準備

開発環境としてPython 3.13、FastAPI、Next.js(App Router) + Tamaguiを使用し、データベースにはPostgreSQL、キャッシュ・レート制限用にRedisを利用する。コンテナ化にはDocker Composeを用い、GitHub ActionsによるmainブランチへのプッシュでVPSへの自動デプロイを行う構成とする。自動テストはpytestを用いてバックエンドの主要APIおよびサービスロジックの単体テスト・結合テストを実施する。

## 4 想定リスクと対策

| リスク | 対策 |
|---|---|
| Gemini Flash-Lite(無料枠)のレートリミットまたは利用上限超過によるチャット・文書生成の失敗 | エラーハンドリングを厳重に行い、上限超過時は適切なエラーメッセージをクライアントへ返却して再送を促す。納期が厳しい場合の代替手段として、一時的なモック応答モードへの切り替えを検討する。 |
| LLMによる4種文書の順次生成および自己診断の処理時間が長引き、タイムアウトが発生するリスク | 同期的なAPIリクエストの代わりにバックグラウンド非同期処理(BackgroundTasks)を用いて処理を受け付け、進捗や結果は別APIで取得する設計とする。 |
| PDFやマークダウンなどの参考資料のテキスト化におけるパースエラーや想定外のファイル形式による不具合 | 対応するファイル形式を明確に制限し、パース失敗時はValidationError(HTTP 400)を返却する。複雑なフォーマットの解析機能はMVPのスコープから外してプレーンテキストとマークダウンを優先する。 |
