# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針

フロントエンドは Next.js (App Router) と Tamagui を用い、バックエンドは FastAPI と LangChain・LangGraph (Python 3.13) を採用します。データベースには PostgreSQL を用い、レート制限やトークン失効の管理には Redis を利用します。インフラとしては VPS 上に Docker Compose と nginx を配置し、GitHub Actions による自動デプロイを行います。

```text
+-------------------------------------------------------+
|                    Client (Browser)                   |
+---------------------------+---------------------------+
                            | HTTPS
+---------------------------v---------------------------+
|                     nginx (Reverse Proxy)             |
+---------------------------+---------------------------+
                            |
+---------------------------v---------------------------+
|            Next.js App Router (Frontend)              |
+---------------------------+---------------------------+
                            |
+---------------------------v---------------------------+
|           FastAPI + LangGraph (Backend)               |
+-------------+---------------------------+-------------+
              |                           |
+-------------v-------------+   +---------v-------------+
| PostgreSQL (Data Store)   |   | Redis (Rate Limit)    |
+---------------------------+   +-----------------------+
```

## 3.2 データモデル定義

主要なエンティティとして、ユーザー、プロジェクト、参考資料、チャットメッセージ、および生成された設計書・自己診断結果を保持します。

```text
[User] 1 ----- * [Project]
                  |-- * [ReferenceFile]
                  |-- * [ChatMessage]
                  |-- * [DesignDocument]
                  |-- * [SelfAssessment]
```

### テーブル: users

ユーザーアカウント情報を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | ユーザーID |
| email | VARCHAR(255) | NOT NULL, UNIQUE | メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | ハッシュ化されたパスワード |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: projects

ヒアリング対象のプロジェクト情報を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | プロジェクトID |
| user_id | UUID | NOT NULL, FK | 所有者ユーザーID |
| title | VARCHAR(255) | — | プロジェクト名 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: reference_files

プロジェクトに紐づく参考資料ファイルを保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | ファイルID |
| project_id | UUID | NOT NULL, FK | プロジェクトID |
| file_name | VARCHAR(255) | NOT NULL | ファイル名 |
| file_path | VARCHAR(512) | NOT NULL | 保存先パス |
| created_at | TIMESTAMP | NOT NULL | アップロード日時 |

### テーブル: chat_messages

チャットのやり取りの履歴を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | メッセージID |
| project_id | UUID | NOT NULL, FK | プロジェクトID |
| role | VARCHAR(50) | NOT NULL | 送信者ロール（user / assistant） |
| content | TEXT | NOT NULL | メッセージ内容 |
| created_at | TIMESTAMP | NOT NULL | 送信日時 |

### テーブル: design_documents

一括生成された4種の設計書を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | 設計書ID |
| project_id | UUID | NOT NULL, FK | プロジェクトID |
| doc_type | VARCHAR(50) | NOT NULL | 設計書種別 |
| content | TEXT | NOT NULL | Markdown本文 |
| created_at | TIMESTAMP | NOT NULL | 生成日時 |

### テーブル: self_assessments

設計書に対するAIの自己診断結果を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | 自己診断ID |
| project_id | UUID | NOT NULL, FK | プロジェクトID |
| severity | VARCHAR(50) | NOT NULL | 重要度（最重要/中程度/軽微） |
| content | TEXT | NOT NULL | 診断内容 |
| created_at | TIMESTAMP | NOT NULL | 診断日時 |

## 3.3 バックエンド処理・モジュール設計

FastAPIによるルーティング層、ビジネスロジック・LangGraph処理を行うサービス層、SQLAlchemyによるリポジトリ層に分離します。

```text
backend/
  ├── api/           # ルーター・エンドポイント定義
  ├── services/      # ビジネスロジック・LangGraph連携
  ├── repositories/  # データアクセス層
  └── models/        # DBモデル定義
```

### APIエンドポイント一覧

| メソッド | パス | 概要 |
|---|---|---|
| POST | /api/v1/auth/register | ユーザー登録処理 |
| POST | /api/v1/auth/login | ログイン認証処理 |
| POST | /api/v1/projects | プロジェクト作成と参考資料アップロード処理 |
| POST | /api/v1/projects/{id}/chat | チャットメッセージ送信とヒアリング応答処理 |
| POST | /api/v1/projects/{id}/generate | 設計書一括生成および自己診断処理 |

### モジュール一覧

| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| backend/api/auth.py | ルート | 認証関連のHTTPリクエストを受け付け、サービス層へ渡す | backend/services/auth_service.py, fastapi |
| backend/services/auth_service.py | サービス | ユーザー登録やログインの認証ロジックを実行する | backend/repositories/user_repository.py |
| backend/repositories/user_repository.py | リポジトリ | usersテーブルへのデータアクセスを行う | sqlalchemy |
| backend/api/projects.py | ルート | プロジェクト・参考資料・チャット・生成に関するHTTPリクエストを受け付ける | backend/services/project_service.py, fastapi |
| backend/services/project_service.py | サービス | 参考資料の処理、チャットのヒアリング、設計書生成・自己診断のロジックを実行する | backend/repositories/project_repository.py, langchain, langgraph |
| backend/repositories/project_repository.py | リポジトリ | プロジェクト、ファイル、チャット、設計書、自己診断テーブルへのデータアクセスを行う | sqlalchemy |

### 処理別データフロー

#### DF-1: POST /api/v1/auth/register

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | — | backend/api/auth.py |
| backend/api/auth.py | email, password | バリデーション検証 | backend/services/auth_service.py |
| backend/services/auth_service.py | email, password_hash | パスワードハッシュ化 | backend/repositories/user_repository.py |
| backend/repositories/user_repository.py | user record | — | users |

- データ項目: 登録情報(email, password)

#### DF-2: POST /api/v1/auth/login

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | — | backend/api/auth.py |
| backend/api/auth.py | email, password | — | backend/services/auth_service.py |
| backend/services/auth_service.py | email | ユーザー検索 | backend/repositories/user_repository.py |
| users | user record | — | backend/repositories/user_repository.py |
| backend/repositories/user_repository.py | user record | パスワード検証・JWT発行 | backend/services/auth_service.py |

- データ項目: ログイン情報(email, password)

#### DF-3: POST /api/v1/projects

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | files | — | backend/api/projects.py |
| backend/api/projects.py | files | ファイル形式・件数検証 | backend/services/project_service.py |
| backend/services/project_service.py | project data, file data | — | backend/repositories/project_repository.py |
| backend/repositories/project_repository.py | project record | — | projects |
| backend/repositories/project_repository.py | file record | — | reference_files |

- データ項目: 参考資料(files)

#### DF-4: POST /api/v1/projects/{id}/chat

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | message | — | backend/api/projects.py |
| backend/api/projects.py | message | 空送信・文字数検証 | backend/services/project_service.py |
| backend/services/project_service.py | message, prompt | LLM(Gemini Flash-Lite)による応答生成 | backend/services/project_service.py |
| backend/services/project_service.py | chat message records | — | backend/repositories/project_repository.py |
| backend/repositories/project_repository.py | chat message records | — | chat_messages |

- データ項目: チャットメッセージ(message)

#### DF-5: POST /api/v1/projects/{id}/generate

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | project_id | — | backend/api/projects.py |
| backend/api/projects.py | project_id | — | backend/services/project_service.py |
| backend/services/project_service.py | chat history & reference files | LangGraphによる4種設計書生成・自己診断 | backend/services/project_service.py |
| backend/services/project_service.py | documents and self assessments | — | backend/repositories/project_repository.py |
| backend/repositories/project_repository.py | design document records | — | design_documents |
| backend/repositories/project_repository.py | self assessment records | — | self_assessments |

- データ項目: 生成成果物(design_documents, self_assessments)

## 3.4 例外処理・エラーハンドリング・ログ設計

共通のエラーレスポンスとして、HTTPステータスコードと共にエラーコードとメッセージを返却します。機密情報や入力内容はログに残さず、エラーの有無や日時のみを記録します。レート制限やトークン失効の管理には Redis を用います。
