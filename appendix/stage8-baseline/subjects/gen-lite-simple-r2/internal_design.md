# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針

フロントエンドはNext.js (App Router)を採用し、UIコンポーネントライブラリとしてTamaguiを利用してクロスプラットフォーム対応の画面を構築する。バックエンドはPython 3.13のFastAPIを採用し、LangChainおよびLangGraphを用いてチャットのヒアリング対話フローや4種設計書の一括生成・自己診断のロジックをオーケストレーションする。データベースにはPostgreSQLを採用してユーザー情報・プロジェクト・チャット履歴・生成された設計書データを永続化し、キャッシュおよびレート制限・トークン失効管理にはRedisを利用する。インフラストラクチャはVPS上にDocker Composeとnginx（リバースプロキシ）を配置した構成とし、GitHub Actionsによって自動デプロイを行う。

```text
[Client (Browser)]
       │ HTTPS
       ▼
[nginx (Reverse Proxy)]
       │
       ├─► [Next.js (App Router + Tamagui)]
       │         │ REST API / JWT
       │         ▼
       └─► [FastAPI (Python 3.13 + LangChain / LangGraph)]
                 │
                 ├─► [PostgreSQL (Data Store)]
                 ├─► [Redis (Cache / Rate Limit / Token Revocation)]
                 └─► [Gemini Flash-Lite (External LLM API)]
```

## 3.2 データモデル定義

主要エンティティとして、ユーザー情報を管理する `users` テーブル、ヒアリングや生成物のコンテキストとなるプロジェクト情報を管理する `projects` テーブル、チャットのやり取りを保持する `chat_messages` テーブル、アップロードされた参考資料を管理する `reference_files` テーブル、そして一括生成された4種設計書と自己診断結果を保持する `documents` テーブルを定義する。機密性保持のためプロジェクトやデータはユーザーIDに紐づき、他人のデータの閲覧ができない設計とする。

```text
[users] 1 -- * [projects]
[projects] 1 -- * [chat_messages]
[projects] 1 -- * [reference_files]
[projects] 1 -- * [documents]
```

### テーブル: users

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | ユーザーID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | パスワードハッシュ |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: projects

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | プロジェクトID |
| user_id | UUID | FK, NOT NULL | ユーザーID |
| title | VARCHAR(255) | NOT NULL | プロジェクト名 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: chat_messages

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | メッセージID |
| project_id | UUID | FK, NOT NULL | プロジェクトID |
| role | VARCHAR(50) | NOT NULL | 送信者ロール (user / assistant) |
| content | TEXT | NOT NULL | メッセージ内容 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: reference_files

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | ファイルID |
| project_id | UUID | FK, NOT NULL | プロジェクトID |
| file_name | VARCHAR(255) | NOT NULL | ファイル名 |
| file_path | VARCHAR(512) | NOT NULL | 保存パス |
| created_at | TIMESTAMP | NOT NULL | 登録日時 |

### テーブル: documents

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | ドキュメントID |
| project_id | UUID | FK, NOT NULL | プロジェクトID |
| doc_type | VARCHAR(50) | NOT NULL | 設計書種別 (requirements / external_design / internal_design / implementation_plan) |
| content | TEXT | NOT NULL | Markdown本文 |
| self_diagnosis | JSONB | — | 自己診断結果（最重要/中程度/軽微） |
| created_at | TIMESTAMP | NOT NULL | 生成日時 |

## 3.3 バックエンド処理・モジュール設計

FastAPIバックエンドはレイヤードアーキテクチャおよびドメイン駆動設計の考え方を一部取り入れ、ルーター層、サービス層、リポジトリ層、外部API連携層に分離する。ディレクトリ構成は以下の通りとする。

```text
backend/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── chat.py
│   │   │   └── documents.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── redis.py
│   ├── models/
│   │   └── orm.py
│   ├── schemas/
│   │   └── pydantic_schemas.py
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── chat_service.py
│   │   └── llm_service.py
│   └── main.py
├── Dockerfile
└── requirements.txt
```

### APIエンドポイント一覧

| メソッド | パス | 概要 |
|---|---|---|
| POST | /api/v1/auth/register | ユーザー登録処理のルーティングとバリデーション |
| POST | /api/v1/auth/login | ログイン認証およびJWT・HttpOnly Cookie発行 |
| POST | /api/v1/chat/messages | チャットメッセージ送信とGemini Flash-Liteによるヒアリング応答 |
| POST | /api/v1/documents/generate | LangGraph/LangChainを用いた4種設計書の一括生成と自己診断の実行 |
| GET | /api/v1/documents/{id} | 生成された設計書および自己診断結果の取得 |

### モジュール一覧

| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| app/api/v1/auth.py | ルート | 認証関連のHTTPリクエストを受け付け、サービス層を呼び出してレスポンスを返す。 | app/services/auth_service.py, fastapi |
| app/api/v1/chat.py | ルート | チャットメッセージ送信およびファイルアップロードを受け付け、チャットサービスを呼び出す。 | app/services/chat_service.py, fastapi |
| app/api/v1/documents.py | ルート | 設計書生成および取得のHTTPリクエストを受け付け、LLMサービスを呼び出す。 | app/services/llm_service.py, fastapi |
| app/services/auth_service.py | サービス | ユーザー登録およびログインのビジネスロジックを処理し、DB操作とJWT発行を行う。 | app/core/security.py, app/models/orm.py |
| app/services/chat_service.py | サービス | チャット履歴の管理とGemini Flash-Liteへのメッセージ送信・レート制限制御を行う。 | app/services/llm_service.py, app/core/redis.py |
| app/services/llm_service.py | サービス | LangChain/LangGraphを利用して4種設計書の一括生成と自己診断を実行する。 | langchain, langgraph, app/models/orm.py |
| app/core/security.py | 共通 | パスワードハッシュ化およびJWTの発行・検証を行う。 | passlib, pyjwt |
| app/core/redis.py | 共通 | Redis接続およびレート制限・トークン失効管理の処理を提供する。 | redis |
| app/models/orm.py | モデル | SQLAlchemyを用いたデータベースのORM定義を行う。 | sqlalchemy |

### 処理別データフロー

#### DF-1: POST /api/v1/auth/register

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | 入力値バリデーション | app/api/v1/auth.py |
| app/api/v1/auth.py | email, password | パスワードハッシュ化 | app/services/auth_service.py |
| app/services/auth_service.py | user record | — | users |

- データ項目: register_request(email, password)

#### DF-2: POST /api/v1/auth/login

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | 入力値バリデーション | app/api/v1/auth.py |
| app/api/v1/auth.py | email, password | — | app/services/auth_service.py |
| app/services/auth_service.py | credentials | ユーザー照合・パスワード検証 | users |
| app/services/auth_service.py | user data | JWT生成 | app/core/security.py |

- データ項目: login_request(email, password)

#### DF-3: POST /api/v1/chat/messages

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | message, files | 空送信チェック・文字数制限チェック | app/api/v1/chat.py |
| app/api/v1/chat.py | message, files | レート制限確認 | app/core/redis.py |
| app/api/v1/chat.py | message, files | — | app/services/chat_service.py |
| app/services/chat_service.py | chat history & files | LLM対話処理 | Gemini Flash-Lite |
| app/services/chat_service.py | message payload | — | chat_messages |

- データ項目: chat_message_payload(message, files)

#### DF-4: POST /api/v1/documents/generate

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | project_id | レート制限確認 | app/core/redis.py |
| app/api/v1/documents.py | project_id | — | app/services/llm_service.py |
| app/services/llm_service.py | project context | チャット履歴・参考資料読み込み | chat_messages |
| app/services/llm_service.py | project context | — | reference_files |
| app/services/llm_service.py | aggregated context | 4種設計書一括生成 & 自己診断実行 | Gemini Flash-Lite |
| app/services/llm_service.py | generated documents & diagnosis | — | documents |

- データ項目: document_generation_request(project_id)

#### DF-5: GET /api/v1/documents/{id}

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | id | 権限検証 | app/api/v1/documents.py |
| app/api/v1/documents.py | id | — | documents |

- データ項目: document_fetch_request(id)

## 3.4 例外処理・エラーハンドリング・ログ設計

例外処理およびエラーハンドリングはFastAPIの標準例外ハンドラを利用し、一律でJSON形式のエラーレスポンス（`{"detail": "エラーメッセージ"}`）を返却する。認証エラーは401、バリデーションエラーや空送信・文字数超過は400、レート制限超過は429、AI応答失敗やシステム内部エラーは500とする。セキュリティ要件（NFR-008）に基づき、機密情報や入力内容は一切ログに残さず、エラーの有無や日時、エラーコードのみをアプリケーションログに出力する。
