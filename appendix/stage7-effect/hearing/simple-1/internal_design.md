# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針

フロントエンドはNext.js(App Router)とTamaguiを採用し、SSR/SSGおよびレスポンシブなUIを構築する。バックエンドはFastAPIとLangChain・LangGraph(Python 3.13)を採用し、非同期処理とAIワークフローを効率的に制御する。データベースにはPostgreSQLを採用してユーザーデータやチャット履歴、生成文書を永続化し、Redisをセッション管理やレート制限・トークン失効の管理に利用する。インフラストラクチャはVPS上にDocker Composeとnginxを配置し、GitHub Actionsを用いてmainブランチへのプッシュ時に自動デプロイを行う構成とする。

```text
+-------------------------------------------------------+
|               Next.js + Tamagui (FE)                  |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|              nginx (Reverse Proxy)                    |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|         FastAPI + LangGraph (Python 3.13) (BE)        |
+-------------------------------------------------------+
              |                       |
              v                       v
+-----------------------+   +---------------------------+
| PostgreSQL (Database) |   | Redis (Rate Limit/Cache)  |
+-----------------------+   +---------------------------+
```

## 3.2 データモデル定義

本システムでは、ユーザー、プロジェクト・チャットセッション、チャットメッセージ、参考資料、生成された設計書を管理する。エンティティ間のリレーションとして、1人のユーザーは複数のプロジェクトを持ち、1つのプロジェクトに複数のチャットメッセージ、参考資料、生成文書が紐づく構造とする。

```text
+------------+ 1       N +---------------+
|   users    |-----------|   projects    |
+------------+           +---------------+
                               | 1
          +--------------------+--------------------+
          | N                  | N                  | N
+------------------+ +--------------------+ +--------------------+
|  chat_messages   | | reference_files    | | generated_documents|
+------------------+ +--------------------+ +--------------------+
```

### テーブル: users

システムを利用するユーザーの認証情報を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ユーザーID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | ハッシュ化されたパスワード |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

### テーブル: projects

ユーザーごとの要件定義プロジェクトを管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | プロジェクトID |
| user_id | UUID | FK, NOT NULL | ユーザーID |
| title | VARCHAR(255) | NOT NULL | プロジェクト名 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

### テーブル: chat_messages

チャットヒアリングのメッセージ履歴を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | メッセージID |
| project_id | UUID | FK, NOT NULL | プロジェクトID |
| role | VARCHAR(50) | NOT NULL | 送信者ロール(user/assistant) |
| content | TEXT | NOT NULL | メッセージ本文 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: reference_files

初期資料としてアップロードされたファイルを管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ファイルID |
| project_id | UUID | FK, NOT NULL | プロジェクトID |
| file_name | VARCHAR(255) | NOT NULL | ファイル名 |
| file_path | VARCHAR(512) | NOT NULL | 保存先パス |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: generated_documents

AIによって生成された4種のMarkdown設計書と診断結果を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ドキュメントID |
| project_id | UUID | FK, NOT NULL | プロジェクトID |
| doc_type | VARCHAR(50) | NOT NULL | 種別(requirements/external_design/internal_design/implementation_plan) |
| content | TEXT | NOT NULL | Markdown本文 |
| diagnosis_result | JSONB | — | 不足点の3段階自己診断結果 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

## 3.3 バックエンド処理・モジュール設計

FastAPIバックエンドでは、ルーティングを担当するルーター層、ビジネスロジックを担当するサービス層、LangChain/LangGraphによるAI処理を担当するエージェント層、データベースアクセスを担当するリポジトリ層に分離する。ディレクトリ構成は以下の通り。

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
│   │   └── security.py
│   ├── models/
│   │   └── *.py
│   ├── repositories/
│   │   └── *.py
│   ├── services/
│   │   └── *.py
│   └── agents/
│       └── *.py
└── main.py
```

### APIエンドポイント一覧

| メソッド | パス | 概要 |
|---|---|---|
| POST | /api/v1/auth/register | ユーザー登録処理のルーティングとサービス呼び出し |
| POST | /api/v1/auth/login | ログイン認証およびJWT Cookie設定のルーティングとサービス呼び出し |
| POST | /api/v1/chat/messages | チャットメッセージ送信とAI応答取得のルーティングとサービス呼び出し |
| POST | /api/v1/documents/generate | 4種設計書の一括生成と自己診断実行のルーティングとサービス呼び出し |
| POST | /api/v1/documents/upload-reference | 参考資料のアップロード処理のルーティングとサービス呼び出し |

### モジュール一覧

| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| app/api/v1/auth.py | ルート | 認証系APIのリクエストを受け付け、入力検証とレスポンス返却を行う。 | app/services/auth_service.py |
| app/api/v1/chat.py | ルート | チャット関連APIのリクエストを受け付け、サービスへ処理を委譲する。 | app/services/chat_service.py |
| app/api/v1/documents.py | ルート | 設計書生成および資料アップロードAPIのリクエストを受け付け、サービスへ処理を委譲する。 | app/services/document_service.py |
| app/services/auth_service.py | サービス | ユーザー登録や認証のビジネスロジックを制御する。 | app/repositories/user_repository.py, app/core/security.py |
| app/services/chat_service.py | サービス | チャットメッセージのバリデーション、メッセージ保存、AIエージェント呼び出しを制御する。 | app/repositories/chat_repository.py, app/agents/chat_agent.py |
| app/services/document_service.py | サービス | 4種設計書の一括生成、自己診断の実行、および参考資料アップロードを制御する。 | app/repositories/document_repository.py, app/agents/document_agent.py |
| app/agents/chat_agent.py | エージェント | Gemini Flash-LiteとLangChainを用いた対話応答処理を行う。 | langchain, google-genai |
| app/agents/document_agent.py | エージェント | Gemini Flash-Liteを用いた4種設計書の生成と3段階自己診断処理を行う。 | langchain, google-genai |
| app/repositories/user_repository.py | リポジトリ | usersテーブルに対するデータベース操作を行う。 | sqlalchemy |
| app/repositories/chat_repository.py | リポジトリ | chat_messagesテーブルに対するデータベース操作を行う。 | sqlalchemy |
| app/repositories/document_repository.py | リポジトリ | reference_filesおよびgenerated_documentsテーブルに対するデータベース操作を行う。 | sqlalchemy |

### 処理別データフロー

#### DF-1: POST /api/v1/auth/register

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | 入力検証 | app/api/v1/auth.py |
| app/api/v1/auth.py | email, password | パスワードハッシュ化 | app/services/auth_service.py |
| app/services/auth_service.py | email, password_hash | — | users |
| users | 登録完了データ | — | app/services/auth_service.py |
| app/services/auth_service.py | 201 ユーザー作成完了 | — | 利用者 |

- データ項目: 認証情報(email, password)

#### DF-2: POST /api/v1/auth/login

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | 入力検証 | app/api/v1/auth.py |
| app/api/v1/auth.py | email, password | — | app/services/auth_service.py |
| app/services/auth_service.py | email | — | users |
| users | ユーザーレコード | パスワード照合 | app/services/auth_service.py |
| app/services/auth_service.py | JWT生成 | HttpOnly Cookie設定 | 利用者 |

- データ項目: ログイン情報(email, password)

#### DF-3: POST /api/v1/chat/messages

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | message | 文字数および空文字検証 | app/api/v1/chat.py |
| app/api/v1/chat.py | message | — | app/services/chat_service.py |
| app/services/chat_service.py | message | — | app/agents/chat_agent.py |
| app/agents/chat_agent.py | プロンプト | Gemini Flash-Lite API呼び出し | Gemini Flash-Lite API |
| Gemini Flash-Lite API | AI応答メッセージ | — | app/agents/chat_agent.py |
| app/agents/chat_agent.py | AI応答 | — | app/services/chat_service.py |
| app/services/chat_service.py | メッセージ履歴 | — | chat_messages |
| app/services/chat_service.py | 200 AI応答データ | — | 利用者 |

- データ項目: チャットデータ(message, response)

#### DF-4: POST /api/v1/documents/generate

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 生成トリガー | — | app/api/v1/documents.py |
| app/api/v1/documents.py | 生成リクエスト | — | app/services/document_service.py |
| app/services/document_service.py | チャット履歴取得 | — | chat_messages |
| chat_messages | 履歴データ | — | app/services/document_service.py |
| app/services/document_service.py | ヒアリングデータ | — | app/agents/document_agent.py |
| app/agents/document_agent.py | 生成プロンプト | Gemini Flash-Lite API呼び出し | Gemini Flash-Lite API |
| Gemini Flash-Lite API | 4種設計書と診断結果 | — | app/agents/document_agent.py |
| app/agents/document_agent.py | 設計書・診断結果 | — | app/services/document_service.py |
| app/services/document_service.py | 設計書・診断結果データ | — | generated_documents |
| app/services/document_service.py | 201 生成された4種設計書および診断結果 | — | 利用者 |

- データ項目: 設計書データ(doc_type, content, diagnosis_result)

#### DF-5: POST /api/v1/documents/upload-reference

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | file | 拡張子および最大件数検証 | app/api/v1/documents.py |
| app/api/v1/documents.py | file | — | app/services/document_service.py |
| app/services/document_service.py | ファイル情報 | — | reference_files |
| reference_files | 保存完了 | — | app/services/document_service.py |
| app/services/document_service.py | 201 アップロード完了 | — | 利用者 |

- データ項目: ファイルデータ(file_name, file_path)

## 3.4 例外処理・エラーハンドリング・ログ設計

エラーハンドリングはFastAPIの例外ハンドラを利用し、共通のJSONレスポンス形式({ "error": { "code": エラーコード, "message": "エラーメッセージ" } })でクライアントに返す。バリデーションエラーは400、認証エラーは401、AI応答失敗や生成失敗などのサーバー内部エラーは500として処理する。AI応答の途中失敗時はメッセージを保存せずにエラー理由を返却して再送を促し、生成失敗時は再生成を行う仕組みとする。ログ出力においては、NFR-009に基づきユーザーが入力した内容やチャットの文面はログに残さない方針を徹底する。
