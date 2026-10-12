# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針

フロントエンドはNext.js(App Router)とTamaguiを採用し、UIの高速な描画とレスポンシブなデザインを実現する。バックエンドはFastAPI(Python 3.13)をベースに、LangChainおよびLangGraphを用いてAIとの対話フローや設計書生成ロジックを構築する。データベースにはPostgreSQLを採用してユーザー情報やチャット履歴、生成された文書を永続化し、Redisを併用してレート制限やJWTのトークン失効管理を行う。インフラ環境としてはVPS上にDocker Composeとnginxを配置し、静的ファイル配信とリバースプロキシを行いつつ、GitHub Actionsによる自動デプロイパイプラインを構成する。

```text
+-------------------------------------------------------------+
|                     Client (Browser)                        |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|               nginx (Reverse Proxy / SSL)                   |
+-------------------------------------------------------------+
                               |
       +-----------------------+-----------------------+
       |                                               |
       v                                               v
+-------------------------------+             +-------------------------------+
|    Next.js (App Router)       |             |        FastAPI                |
|       (Frontend Service)      | -- (API) -> |     (Backend Service)         |
+-------------------------------+             +-------------------------------+
                                                       |              |
                                                       v              v
                                              +---------------+ +------------+
                                              | LangGraph /   | | Redis      | 
                                              | Gemini API    | | (Rate/JWT) |
                                              +---------------+ +------------+
                                                       |
                                                       v
                                              +---------------+
                                              |  PostgreSQL   | 
                                              +---------------+
```

## 3.2 データモデル定義

本システムでは、ユーザー、プロジェクト、初期資料、チャットメッセージ、生成設計書の5つの主要エンティティを管理する。ユーザーは複数のプロジェクトを所有し、プロジェクトは複数の初期資料、チャットメッセージ、および4種の生成設計書を従属エンティティとして保持する構造とする。

```text
[User (1)] ----< [Project (N)]
                     |----> [InitialFile (N)]
                     |----> [ChatMessage (N)]
                     |----> [GeneratedDocument (N)]
```

### テーブル: users

システムを利用するユーザーの情報を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ユーザーID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | ハッシュ化されたパスワード |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: projects

ヒアリングおよび設計書生成の単位となるプロジェクトの情報を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | プロジェクトID |
| user_id | UUID | FK, NOT NULL | 所有するユーザーのID |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: initial_files

プロジェクト作成時にアップロードされた参考資料のメタデータを管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ファイルID |
| project_id | UUID | FK, NOT NULL | 紐づくプロジェクトID |
| file_name | VARCHAR(255) | NOT NULL | ファイル名 |
| file_path | VARCHAR(512) | NOT NULL | 保存先パス |
| created_at | TIMESTAMP | NOT NULL | アップロード日時 |

### テーブル: chat_messages

AIとのチャットヒアリングの履歴を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | メッセージID |
| project_id | UUID | FK, NOT NULL | 紐づくプロジェクトID |
| sender_type | VARCHAR(32) | NOT NULL | 送信者種別(user または ai) |
| message | TEXT | NOT NULL | メッセージ本文 |
| created_at | TIMESTAMP | NOT NULL | 送信日時 |

### テーブル: generated_documents

生成された4種のMarkdown設計書のデータを管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ドキュメントID |
| project_id | UUID | FK, NOT NULL | 紐づくプロジェクトID |
| doc_type | VARCHAR(64) | NOT NULL | 設計書種別(requirement, external_design, internal_design, implementation_plan) |
| content | TEXT | NOT NULL | Markdown内容 |
| created_at | TIMESTAMP | NOT NULL | 生成日時 |

## 3.3 バックエンド処理・モジュール設計

バックエンドのFastAPIアプリケーションは、関心の分離に基づき、ルーティングを担うルーター層、ビジネスロジックを担うサービス層、データベースアクセスを担うリポジトリ層に分割する。また、LangChain・LangGraphを利用したAIエージェントの制御ロジックは独立したモジュールとしてサービス層から呼び出す構成とする。

```text
backend/
├── main.py
├── routers/
│   ├── auth.py
│   └── projects.py
├── services/
│   ├── auth_service.py
│   ├── chat_service.py
│   └── generator_service.py
├── repositories/
│   ├── user_repository.py
│   ├── project_repository.py
│   └── document_repository.py
└── models/
    └── database_models.py
```

### APIエンドポイント一覧

| メソッド | パス | 概要 |
|---|---|---|
| POST | /api/v1/auth/register | ユーザー登録処理のルーティングとサービス呼び出し |
| POST | /api/v1/auth/login | ログイン認証とJWT Cookie設定の処理 |
| POST | /api/v1/projects | プロジェクト作成と初期資料読込・保存の処理 |
| POST | /api/v1/projects/{id}/chat | チャットメッセージ送信とGemini AI応答取得の処理 |
| POST | /api/v1/projects/{id}/generate | 4種設計書の一括生成と保存の処理 |
| GET | /api/v1/projects/{id}/documents | 生成済み設計書の取得処理 |

### モジュール一覧

| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| backend/routers/auth.py | ルート | 認証関連のHTTPリクエストを受け付け、サービス層へ処理を委譲する。 | backend/services/auth_service.py |
| backend/routers/projects.py | ルート | プロジェクト、チャット、設計書生成のHTTPリクエストを受け付け、サービス層へ処理を委譲する。 | backend/services/chat_service.py, backend/services/generator_service.py |
| backend/services/auth_service.py | サービス | ユーザー登録やパスワード検証、JWT生成のビジネスロジックを実行する。 | backend/repositories/user_repository.py |
| backend/services/chat_service.py | サービス | チャットメッセージの検証とGemini Flash-Lite APIを利用した対話処理を制御する。 | backend/repositories/project_repository.py, LangChain |
| backend/services/generator_service.py | サービス | LangGraphを用いて4種のMarkdown設計書を一括生成するロジックを制御する。 | backend/repositories/project_repository.py, LangGraph |
| backend/repositories/* | リポジトリ | PostgreSQLに対するデータ永続化および検索クエリを実行する。 | SQLAlchemy |

### 処理別データフロー

#### DF-1: POST /api/v1/auth/register

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | — | backend/routers/auth.py |
| backend/routers/auth.py | email, password | バリデーション | backend/services/auth_service.py |
| backend/services/auth_service.py | email, password_hash | パスワードハッシュ化 | backend/repositories/user_repository.py |
| backend/repositories/user_repository.py | ユーザーデータ | — | users |
| users | 登録完了データ | — | 利用者 |

- データ項目: ユーザー登録データ(email, password)

#### DF-2: POST /api/v1/auth/login

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | — | backend/routers/auth.py |
| backend/routers/auth.py | email, password | — | backend/services/auth_service.py |
| backend/services/auth_service.py | email | — | backend/repositories/user_repository.py |
| backend/repositories/user_repository.py | ユーザー情報 | — | users |
| users | ユーザー情報 | — | backend/services/auth_service.py |
| backend/services/auth_service.py | JWTアクセストークン | パスワード照合・JWT生成 | 利用者 |

- データ項目: ログイン資格情報(email, password)

#### DF-6: POST /api/v1/projects

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | files | — | backend/routers/projects.py |
| backend/routers/projects.py | files | — | backend/services/chat_service.py |
| backend/services/chat_service.py | project_id, file_data | — | backend/repositories/project_repository.py |
| backend/repositories/project_repository.py | プロジェクトおよび初期資料データ | — | projects |
| backend/repositories/project_repository.py | 初期資料ファイル情報 | — | initial_files |
| initial_files | 作成成功レスポンス | — | 利用者 |

- データ項目: 初期資料データ(files)

#### DF-7: POST /api/v1/projects/{id}/chat

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | message | — | backend/routers/projects.py |
| backend/routers/projects.py | message | 文字数・空チェック | backend/services/chat_service.py |
| backend/services/chat_service.py | チャット入力メッセージ | — | Gemini Flash-Lite API |
| Gemini Flash-Lite API | AI応答メッセージ | — | backend/services/chat_service.py |
| backend/services/chat_service.py | メッセージ履歴 | — | backend/repositories/project_repository.py |
| backend/repositories/project_repository.py | メッセージ保存 | — | chat_messages |
| chat_messages | AI応答結果 | — | 利用者 |

- データ項目: チャットメッセージ(message)

#### DF-8: POST /api/v1/projects/{id}/generate

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | — | — | backend/routers/projects.py |
| backend/routers/projects.py | project_id | — | backend/services/generator_service.py |
| backend/services/generator_service.py | 過去のチャット・資料データ | — | backend/repositories/project_repository.py |
| backend/repositories/project_repository.py | プロジェクト関連コンテキスト | — | chat_messages |
| backend/services/generator_service.py | コンテキストデータ | — | LangGraph / Gemini |
| LangGraph / Gemini | 4種のMarkdown設計書 | 一括生成処理 | backend/services/generator_service.py |
| backend/services/generator_service.py | 生成設計書データ | — | backend/repositories/project_repository.py |
| backend/repositories/project_repository.py | 設計書保存 | — | generated_documents |
| generated_documents | 生成成功レスポンス | — | 利用者 |

- データ項目: 設計書データ(doc_type, content)

#### DF-9: GET /api/v1/projects/{id}/documents

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | — | — | backend/routers/projects.py |
| backend/routers/projects.py | project_id | — | backend/services/generator_service.py |
| backend/services/generator_service.py | project_id | — | backend/repositories/project_repository.py |
| backend/repositories/project_repository.py | ドキュメント検索クエリ | — | generated_documents |
| generated_documents | 設計書一覧データ | — | backend/services/generator_service.py |
| backend/services/generator_service.py | 設計書一覧データ | — | 利用者 |

- データ項目: 設計書一覧データ(doc_type, content, created_at)

## 3.4 例外処理・エラーハンドリング・ログ設計

例外発生時はFastAPIの例外ハンドラを使用し、共通のJSON形式（エラーコード、メッセージ、詳細）でクライアントに返却する。入力値不正は400、認証失敗は401、権限なしは403、対象リソース不存在は404、外部AI呼び出し失敗や生成失敗は502として処理する。また、AI応答の途中失敗時はメッセージを保存せずにエラー理由を返却して再送を促す。ログ出力に関しては、機密情報およびユーザーが入力したチャット文面のログ出力を禁止するセキュリティ方針を遵守する。
