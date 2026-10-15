# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針

フロントエンドは Next.js (App Router) と Tamagui を用いて構築し、UI コンポーネントのスタイリングとサーバーサイド・クライアントサイドのルーティングを統合する。バックエンドは Python 3.13 と FastAPI をベースに、LangChain / LangGraph を用いて LLM（Gemini Flash-Lite）との対話およびワークフロー制御を行う。データベースには PostgreSQL を採用してユーザー情報やチャット履歴、生成文書を永続化し、Redis をセッション管理およびレート制限・トークン失効の制御に利用する。デプロイメントは Docker Compose を用い、VPS 環境上で nginx をリバースプロキシとして配置し、GitHub Actions による自動デプロイパイプラインを構築する。

```text
[利用者 (PC/スマホ)]
       │
       ▼
[Next.js (App Router) + Tamagui] (SCR-001 ~ SCR-004)
       │ (HTTPS / REST API)
       ▼
[FastAPI + LangChain / LangGraph] (Python 3.13)
       ├─► [PostgreSQL (Users, Chat Sessions, Messages, Documents)]
       ├─► [Redis (Rate Limit, Token Revocation)]
       └─► [Gemini Flash-Lite (External LLM API)]
```

## 3.2 データモデル定義

主要エンティティとして、システム利用者を管理する「users」、チャットのセッションを管理する「chat_sessions」、チャットの各メッセージを保持する「messages」、および生成された4種の設計書と自己診断結果を保持する「documents」を定義する。すべてのユーザーデータは自身のIDに紐づき、厳格なデータ分離を行う。

```text
[users] 1 ----- * [chat_sessions]
[chat_sessions] 1 ----- * [messages]
[users] 1 ----- * [documents]
[chat_sessions] 1 ----- * [documents]
```

### テーブル: users

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ユーザーID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | パスワードハッシュ |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: chat_sessions

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | チャットセッションID |
| user_id | UUID | FK (users.id), NOT NULL | ユーザーID |
| title | VARCHAR(255) | NOT NULL | セッションタイトル |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: messages

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | メッセージID |
| session_id | UUID | FK (chat_sessions.id), NOT NULL | セッションID |
| sender | VARCHAR(50) | NOT NULL | 送信者 (user / ai) |
| content | TEXT | NOT NULL | メッセージ本文 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: documents

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | 文書ID |
| user_id | UUID | FK (users.id), NOT NULL | ユーザーID |
| session_id | UUID | FK (chat_sessions.id), NOT NULL | チャットセッションID |
| requirements_doc | TEXT | NOT NULL | 要件定義書Markdown |
| external_doc | TEXT | NOT NULL | 外部設計書Markdown |
| internal_doc | TEXT | NOT NULL | 内部設計書Markdown |
| implementation_doc | TEXT | NOT NULL | 実装計画Markdown |
| self_diagnosis | JSON | NOT NULL | 自己診断結果（最重要/中程度/軽微） |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

## 3.3 バックエンド処理・モジュール設計

FastAPI バックエンドはレイヤードアーキテクチャを採用し、ルーター（エンドポイント定義）、サービス（ビジネスロジック・LangGraph連携）、リポジトリ（SQLAlchemyによるDBアクセス）に分離する。ディレクトリ構成は以下の通り。

```text
backend/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── chat.py
│   │   │   └── documents.py
│   │   └── deps.py
│   ├── core/
│   │   ├── config.py
│   │   └── security.py
│   ├── models/
│   │   └── db_models.py
│   ├── schemas/
│   │   └── pydantic_schemas.py
│   ├── services/
│   │   ├── ai_service.py
│   │   └── chat_service.py
│   └── repositories/
│       ├── user_repo.py
│       ├── chat_repo.py
│       └── document_repo.py
└── main.py
```

### APIエンドポイント一覧

| メソッド | パス | 概要 |
|---|---|---|
| POST | /api/v1/auth/login | ログイン認証エンドポイント |
| POST | /api/v1/chat/messages | チャットメッセージ送信とLLM応答処理エンドポイント |
| POST | /api/v1/documents/generate | 4種設計書一括生成および自己診断実行エンドポイント |
| GET | /api/v1/documents | 保存済み設計書および履歴一覧取得エンドポイント |

### モジュール一覧

| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| app/api/v1/auth.py | ルート | 認証関連のHTTPリクエストを受け取り、ログイン処理を実行する。 | app/services/ai_service.py, app/repositories/user_repo.py |
| app/api/v1/chat.py | ルート | チャットメッセージの送信とファイル入力を受け付け、バリデーションを行う。 | app/services/chat_service.py |
| app/api/v1/documents.py | ルート | 設計書生成および履歴取得のリクエストを処理する。 | app/services/ai_service.py, app/repositories/document_repo.py |
| app/services/chat_service.py | サービス | チャットの文字数・空送信バリデーション、履歴の保存制御を行う。 | app/repositories/chat_repo.py, app/services/ai_service.py |
| app/services/ai_service.py | サービス | LangChain/LangGraphおよびGemini Flash-Liteを呼び出し、対話応答や設計書生成・自己診断を実行する。 | langchain, langgraph |
| app/repositories/* | リポジトリ | SQLAlchemyを用いてPostgreSQLに対するCRUD操作カプセル化を提供する。 | sqlalchemy |

### 処理別データフロー

#### DF-1: POST /api/v1/auth/login

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | メールアドレス、パスワード | — | app/api/v1/auth.py |
| app/api/v1/auth.py | メールアドレス | ハッシュ照合 | users |
| users | ユーザーエンティティ | — | app/api/v1/auth.py |
| app/api/v1/auth.py | 認証成功トークン | — | 利用者 |

- データ項目: ログイン情報(email, password)

#### DF-2: POST /api/v1/chat/messages

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | メッセージ、参考資料ファイル | 文字数制限・空送信チェック | app/api/v1/chat.py |
| app/api/v1/chat.py | メッセージデータ | — | app/services/chat_service.py |
| app/services/chat_service.py | プロンプト・初期資料 | LangChain経由でLLM呼び出し | Gemini Flash-Lite |
| Gemini Flash-Lite | AI応答メッセージ | — | app/services/chat_service.py |
| app/services/chat_service.py | チャット履歴・AI応答 | — | messages |
| messages | 保存完了データ | — | 利用者 |

- データ項目: チャット入出力(message, files, response)

#### DF-3: POST /api/v1/documents/generate

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | チャットセッションID | — | app/api/v1/documents.py |
| app/api/v1/documents.py | セッション履歴 | — | messages |
| messages | 対話コンテキスト | LangGraphワークフロー実行 | app/services/ai_service.py |
| app/services/ai_service.py | 生成指示 | 4種設計書および自己診断生成 | Gemini Flash-Lite |
| Gemini Flash-Lite | 生成文書・自己診断結果 | — | app/services/ai_service.py |
| app/services/ai_service.py | 文書データ | — | documents |
| documents | 生成完了と設計書データ | — | 利用者 |

- データ項目: 設計書・自己診断データ(chat_session_id, requirements_doc, external_doc, internal_doc, implementation_doc, self_diagnosis)

#### DF-4: GET /api/v1/documents

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 認証トークン・ユーザーID | — | app/api/v1/documents.py |
| app/api/v1/documents.py | ユーザーID | — | documents |
| documents | 保存済み設計書・履歴一覧 | — | app/api/v1/documents.py |
| app/api/v1/documents.py | 一覧データレスポンス | — | 利用者 |

- データ項目: 履歴一覧(user_id, documents_list, chat_sessions_list)

## 3.4 例外処理・エラーハンドリング・ログ設計

FastAPI の例外ハンドラーを使用して、すべての API エンドポイントにおけるエラーを統一された JSON 形式で返却する。エラーレスポンスは `{"error": {"code": "ERROR_CODE", "message": "エラーメッセージ詳細"}}` の構造を持つ。AI 応答失敗や生成失敗（FR-007）の際はメッセージを DB に保存せず、HTTP 500 エラーとともに再送を促す理由をクライアントへ返却する。また、セキュリティ要件（NFR-007）に基づき、サーバーサイドのアプリケーションログにはプロンプトやチャットの本文を一切出力せず、リクエストのメタデータとエラーコードのみを記録する。
