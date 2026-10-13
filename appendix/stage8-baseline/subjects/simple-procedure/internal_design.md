# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針

フロントエンドにはNext.js (App Router)を採用し、UIコンポーネントライブラリとしてTamaguiを使用してレスポンシブな画面を実現する。バックエンドにはPython 3.13環境上でFastAPIを採用し、LangChainおよびLangGraphを用いてチャットヒアリングの対話フローおよび4種設計書の一括生成・自己診断ロジックを構築する。データベースにはPostgreSQLを採用してユーザーデータやプロジェクト、チャット履歴、生成された設計書を永続化し、Redisを組み合わせてAPIのレート制限およびJWTアクセストークン・リフレッシュトークンの失効管理を行う。インフラ環境としてはVPS上にDocker Composeとnginxを配置し、HTTPS通信を終端させつつ各コンテナを連携させる。GitHub Actionsを利用してmainブランチへのプッシュ時に自動デプロイを行う構成とする。

```text
[User Browser]
     │ (HTTPS)
     ▼
[nginx / Docker Compose]
     ├─► [Next.js App Router (Frontend)]
     │         │ (REST API / JWT)
     │         ▼
     └─► [FastAPI / LangChain・LangGraph (Backend)]
               │
               ├─► [PostgreSQL (Data Store)]
               ├─► [Redis (Rate Limit / Token Revocation)]
               └─► [Gemini Flash-Lite (LLM)]
```

## 3.2 データモデル定義

主要なエンティティとして、システムを利用するユーザー情報を管理する「users」、ユーザーごとのプロジェクトと参考資料を管理する「projects」、プロジェクト内のチャットのやり取りを保持する「chat_messages」、生成された4種設計書のデータを保持する「documents」、および各設計書に対するAIの自己診断結果を保持する「diagnostics」を定義する。

```text
[users] 1 -- * [projects]
[projects] 1 -- * [chat_messages]
[projects] 1 -- * [documents]
[documents] 1 -- * [diagnostics]
```

### テーブル: users

ユーザーの認証情報およびアカウント管理を行うテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ユーザーID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | ハッシュ化されたパスワード |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: projects

プロジェクト情報およびアップロードされた参考資料のパスを管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | プロジェクトID |
| user_id | UUID | FK, NOT NULL | 所有するユーザーのID |
| reference_file_paths | TEXT[] | — | アップロードされた参考資料のファイルパス配列 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: chat_messages

プロジェクトにおけるチャットのメッセージ履歴を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | メッセージID |
| project_id | UUID | FK, NOT NULL | プロジェクトID |
| sender | VARCHAR(50) | NOT NULL | 送信者（user または ai） |
| content | TEXT | NOT NULL | メッセージ本文 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: documents

AIによって一括生成された4種設計書のデータを保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | 設計書ID |
| project_id | UUID | FK, NOT NULL | プロジェクトID |
| doc_type | VARCHAR(50) | NOT NULL | 設計書の種別（requirements, external_design, internal_design, implementation_plan） |
| content | TEXT | NOT NULL | Markdown形式の設計書本文 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: diagnostics

各設計書に対するAIの自己診断結果（不足点と重要度）を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | 自己診断ID |
| document_id | UUID | FK, NOT NULL | 対象の設計書ID |
| severity | VARCHAR(50) | NOT NULL | 重要度（最重要、中程度、軽微） |
| comment | TEXT | NOT NULL | 不足点に関する指摘内容 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

## 3.3 バックエンド処理・モジュール設計

FastAPIバックエンドはレイヤードアーキテクチャおよびルーター構成を採用し、APIのエンドポイントを受け付けるルーティング層、ビジネスロジックやLangGraphの対話・生成処理を行うサービス層、PostgreSQLとの接続を担うリポジトリ層、およびデータ構造を定義するモデル層に分割する。Redisによるレート制限およびトークン検証はミドルウェアとして共通化する。

```text
backend/
├── api/
│   └── v1/
│       ├── auth.py
│       ├── projects.py
│       ├── chat.py
│       └── documents.py
├── core/
│   ├── security.py
│   └── database.py
├── services/
│   ├── ai_service.py
│   └── chat_graph.py
├── models/
│   └── schemas.py
└── main.py
```

### APIエンドポイント一覧

| メソッド | パス | 概要 |
|---|---|---|
| POST | /api/v1/auth/register | ユーザー登録処理を行う |
| POST | /api/v1/auth/login | JWT認証ログインを行いCookieを設定する |
| POST | /api/v1/projects | プロジェクト作成と参考資料ファイルのアップロード処理を行う |
| POST | /api/v1/chat/messages | チャットメッセージを受信しAIヒアリング応答を返す |
| POST | /api/v1/documents/generate | 4種設計書の一括生成と自己診断の実行を行う |

### モジュール一覧

| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| backend/main.py | ルート | FastAPIアプリケーションの初期化とミドルウェア・ルーターの統合を行う | fastapi, backend/api/v1/* |
| backend/api/v1/auth.py | ルート | ユーザー登録およびログインのHTTPリクエストを処理する | fastapi, backend/services/ai_service.py |
| backend/api/v1/projects.py | ルート | プロジェクト作成とファイルアップロードのHTTPリクエストを処理する | fastapi |
| backend/api/v1/chat.py | ルート | チャットメッセージ送信のHTTPリクエストを受け付け応答を返す | fastapi, backend/services/chat_graph.py |
| backend/api/v1/documents.py | ルート | 設計書一括生成および自己診断のHTTPリクエストを処理する | fastapi, backend/services/ai_service.py |
| backend/services/ai_service.py | サービス | Gemini Flash-Lite APIを呼び出し、設計書の生成および自己診断を実行する | langchain, google-genai |
| backend/services/chat_graph.py | サービス | LangGraphを用いてチャットヒアリングの対話フローを制御する | langgraph, backend/services/ai_service.py |
| backend/core/security.py | モデル | JWTの発行・検証およびパスワードのハッシュ化を行う | PyJWT, passlib |
| backend/core/database.py | モデル | PostgreSQLおよびRedisとの接続セッションを管理する | sqlalchemy, redis |

### 処理別データフロー

#### DF-1: POST /api/v1/auth/register

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | — | backend/api/v1/auth.py |
| backend/api/v1/auth.py | email, password_hash | パスワードハッシュ化 | users |
| users | 登録成功データ | — | 利用者 |

- データ項目: 登録情報(email, password)

#### DF-2: POST /api/v1/auth/login

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | — | backend/api/v1/auth.py |
| backend/api/v1/auth.py | email | ユーザー照合・検証 | users |
| users | ユーザーレコード | — | backend/core/security.py |
| backend/core/security.py | アクセストークン・リフレッシュトークン | JWT発行 | 利用者 |

- データ項目: 認証情報(email, password)

#### DF-3: POST /api/v1/projects

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | files (txt/md/pdf, 最大3件) | — | backend/api/v1/projects.py |
| backend/api/v1/projects.py | user_id, reference_file_paths | ファイル保存・パス紐付け | projects |
| projects | プロジェクト作成成功データ | — | 利用者 |

- データ項目: 参考資料(files, reference_file_paths)

#### DF-4: POST /api/v1/chat/messages

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | message | — | backend/api/v1/chat.py |
| backend/api/v1/chat.py | message | 対話フロー制御 | backend/services/chat_graph.py |
| backend/services/chat_graph.py | プロンプトおよび履歴 | LLM呼び出し | Gemini Flash-Lite API |
| Gemini Flash-Lite API | AI応答メッセージ | — | backend/services/chat_graph.py |
| backend/services/chat_graph.py | project_id, sender, content | メッセージ保存 | chat_messages |
| chat_messages | AI応答データ | — | 利用者 |

- データ項目: チャットメッセージ(message, content)

#### DF-5: POST /api/v1/documents/generate

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | project_id | — | backend/api/v1/documents.py |
| backend/api/v1/documents.py | project_id | チャット履歴・参考資料取得 | chat_messages |
| chat_messages | プロジェクト関連データ | プロンプト構築 | backend/services/ai_service.py |
| backend/services/ai_service.py | 設計書生成プロンプト | LLM一括生成 | Gemini Flash-Lite API |
| Gemini Flash-Lite API | 4種設計書Markdown | 自己診断実行 | backend/services/ai_service.py |
| backend/services/ai_service.py | project_id, doc_type, content | 設計書データ保存 | documents |
| backend/services/ai_service.py | document_id, severity, comment | 自己診断データ保存 | diagnostics |
| diagnostics | 生成・自己診断完了データ | — | 利用者 |

- データ項目: 設計書生成データ(project_id, doc_type, content, severity, comment)

## 3.4 例外処理・エラーハンドリング・ログ設計

共通エラーレスポンス形式として、ステータスコードに加えてエラーコード、エラーメッセージ、詳細情報をJSONで返す設計とする。例外発生時はFastAPIの例外ハンドラーにより捕捉し、AI応答失敗時（FR-007）にはメッセージをデータベースに保存せずにクライアントへ再送を促すエラーを返す。セキュリティ要件（NFR-007）に基づき、機密情報やチャットの入力内容は一切ログに残さず、エラーの有無やタイムスタンプ、エラーコードのみをログ出力する方針とする。また、Redisを利用してログインの総当たりや登録の大量作成、チャット・生成回数に対するレート制限（NFR-008）を実装する。
