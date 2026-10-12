# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針

技術スタックとしてフロントエンドに Next.js (App Router) + Tamagui、バックエンドに FastAPI + LangChain・LangGraph (Python 3.13) を採用します。データベースには PostgreSQL および Redis を利用し、AI モデルとして Gemini Flash-Lite を呼び出します。これらは Docker Compose と nginx を用いた VPS 環境にデプロイし、GitHub Actions により CI/CD パイプラインを構築します。

```text
[Next.js (App Router)] ──HTTPS──► [Nginx / VPS] ──► [FastAPI (Python 3.13)]
                                                         │
            ┌────────────────────────────────────────────┴────────────────────────────────────────────┐
            ▼                                            ▼                                            ▼
[PostgreSQL (データ永続化)]                    [Redis (キャッシュ・セッション)]                [Gemini Flash-Lite API]
```

## 3.2 データモデル定義

主要エンティティとして、ユーザー、チャットセッション、チャットメッセージ、生成ドキュメント、自己診断結果を定義します。

```text
Users (1) ── (N) ChatSessions (1) ── (N) ChatMessages
Users (1) ── (N) GeneratedDocuments (1) ── (N) SelfDiagnostics
```

### テーブル: users

システムを利用するユーザーの情報を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ユーザーID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | ハッシュ化されたパスワード |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

### テーブル: chat_sessions

ユーザーの対話セッションを管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | セッションID |
| user_id | UUID | FK, NOT NULL | ユーザーID |
| title | VARCHAR(255) | NOT NULL | セッションタイトル |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

### テーブル: chat_messages

チャットセッション内のメッセージ履歴を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | メッセージID |
| session_id | UUID | FK, NOT NULL | セッションID |
| sender | VARCHAR(50) | NOT NULL | 送信者 (user / ai) |
| content | TEXT | NOT NULL | メッセージ内容 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: generated_documents

生成された4種のMarkdown設計書を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ドキュメントID |
| session_id | UUID | FK, NOT NULL | セッションID |
| doc_type | VARCHAR(50) | NOT NULL | 設計書種別 (requirements / external_design / internal_design / implementation_plan) |
| content | TEXT | NOT NULL | Markdown内容 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: self_diagnostics

生成された設計書のAI自己診断結果を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | 自己診断ID |
| document_id | UUID | FK, NOT NULL | ドキュメントID |
| severity | VARCHAR(50) | NOT NULL | 重要度 (critical / medium / minor) |
| comment | TEXT | NOT NULL | 診断コメント |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

## 3.3 バックエンド処理・モジュール設計

FastAPI のレイヤードアーキテクチャを採用し、ルーター層、サービス層、リポジトリ層、および LangChain / LangGraph を活用した AI エージェント層に分割します。

```text
backend/
├── app/
│   ├── api/          # ルーター層 (エンドポイント定義)
│   ├── services/     # サービス層 (ビジネスロジック・AI連携)
│   ├── repositories/ # リポジトリ層 (DBアクセス)
│   ├── models/       # モデル層 (DB定義・スキーマ)
│   └── main.py       # アプリケーションエントリーポイント
```

### APIエンドポイント一覧

| メソッド | パス | 概要 |
|---|---|---|
| POST | /api/v1/auth/register | アカウント登録処理 |
| POST | /api/v1/auth/login | ログイン認証処理 |
| POST | /api/v1/chat/messages | チャットメッセージ送信とAI応答生成処理 |
| POST | /api/v1/documents/generate | 設計書一括生成および自己診断処理 |

### モジュール一覧

| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| app/api/auth.py | ルート | 認証関連のHTTPリクエストを受け付け、サービス層へ処理を委譲する。 | app/services/auth_service.py |
| app/services/auth_service.py | サービス | アカウント登録やログインのビジネスロジックを実行する。 | app/repositories/user_repository.py |
| app/repositories/user_repository.py | リポジトリ | users テーブルへのデータ永続化操作を行う。 | PostgreSQL |
| app/api/chat.py | ルート | チャット関連のHTTPリクエストを受け付け、サービス層へ処理を委譲する。 | app/services/chat_service.py |
| app/services/chat_service.py | サービス | チャットの進行管理とAIエージェントの呼び出し制御を行う。 | app/repositories/chat_repository.py, app/services/ai_agent.py |
| app/repositories/chat_repository.py | リポジトリ | chat_sessions および chat_messages テーブルへのデータ操作を行う。 | PostgreSQL |
| app/api/documents.py | ルート | 設計書生成関連のHTTPリクエストを受け付け、サービス層へ処理を委譲する。 | app/services/document_service.py |
| app/services/document_service.py | サービス | 4種の設計書の一括生成と自己診断ロジックを実行する。 | app/repositories/document_repository.py, app/services/ai_agent.py |
| app/repositories/document_repository.py | リポジトリ | generated_documents および self_diagnostics テーブルへのデータ操作を行う。 | PostgreSQL |
| app/services/ai_agent.py | AIエージェント | LangChain と LangGraph を用いて Gemini Flash-Lite API と連携し、対話応答や設計書生成を行う。 | Gemini Flash-Lite API |

### 処理別データフロー

#### DF-1: POST /api/v1/auth/register

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | バリデーション | app/api/auth.py |
| app/api/auth.py | email, password_hash | — | app/services/auth_service.py |
| app/services/auth_service.py | email, password_hash | — | app/repositories/user_repository.py |
| app/repositories/user_repository.py | ユーザー情報 | — | users |

- データ項目: ユーザー登録情報(email, password)

#### DF-2: POST /api/v1/auth/login

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | バリデーション | app/api/auth.py |
| app/api/auth.py | email, password | — | app/services/auth_service.py |
| app/services/auth_service.py | email | パスワード照合 | app/repositories/user_repository.py |
| app/repositories/user_repository.py | ユーザーレコード | — | users |

- データ項目: ログイン情報(email, password)

#### DF-3: POST /api/v1/chat/messages

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | message, session_id | バリデーション | app/api/chat.py |
| app/api/chat.py | message, session_id | — | app/services/chat_service.py |
| app/services/chat_service.py | メッセージ履歴 | — | app/repositories/chat_repository.py |
| app/repositories/chat_repository.py | 取得データ | — | chat_messages |
| app/services/chat_service.py | プロンプト | — | app/services/ai_agent.py |
| app/services/ai_agent.py | AI応答生成依頼 | — | Gemini Flash-Lite API |

- データ項目: チャットメッセージ(message, session_id, sender, content)

#### DF-4: POST /api/v1/documents/generate

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | session_id, files | ファイル形式・件数バリデーション | app/api/documents.py |
| app/api/documents.py | session_id, files | — | app/services/document_service.py |
| app/services/document_service.py | 設計書生成・自己診断要求 | — | app/services/ai_agent.py |
| app/services/ai_agent.py | 一括生成処理 | — | Gemini Flash-Lite API |
| app/services/document_service.py | 4種設計書データ | — | app/repositories/document_repository.py |
| app/repositories/document_repository.py | 保存 | — | generated_documents |
| app/repositories/document_repository.py | 自己診断保存 | — | self_diagnostics |

- データ項目: 設計書生成データ(session_id, files, doc_type, content, severity, comment)

## 3.4 例外処理・エラーハンドリング・ログ設計

共通エラーレスポンスとして、HTTPステータスコードとエラーメッセージ、エラーコードを含むJSON形式を採用します。FastAPI の例外ハンドラーを用いて統一的なフォーマットで返却します。

```text
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "リクエストの内容が不正です。"
  }
}
```

AI API連携失敗や生成失敗などのエラー発生時は、メッセージをDBに保存せずにエラー理由を返却し、フロントエンド側で再送を促すUIを表示します。また、プライバシー保護の観点から、チャットや入力内容は一切ログに残しません。
