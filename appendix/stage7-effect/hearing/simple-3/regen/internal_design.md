# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針

技術スタック:
- フロントエンド: Next.js (App Router) + Tamagui
- バックエンド: FastAPI + LangChain・LangGraph (Python 3.13)
- データベース: PostgreSQL, Redis
- インフラ: VPS (Docker Compose + nginx)

アーキテクチャ方針:
- フロントエンドはSSR/CSRを適切に組み合わせ、Tamaguiを用いた一貫したUIコンポーネントを提供する。
- バックエンドはFastAPIによる非同期APIサーバーとして構築し、LangChainおよびLangGraphを用いてGemini Flash-Lite APIとの複雑な対話・生成ワークフローを管理する。
- データベースはPostgreSQLによりユーザー情報やチャット履歴、生成文書を永続化し、Redisをセッション管理やキャッシュ等に活用する。
- デプロイ環境はDocker Composeを用いてコンテナ化し、nginxをリバースプロキシとして配置する。

## 3.2 データモデル定義

主要エンティティ一覧:
- users: システムを利用するユーザー情報
- chat_sessions: ユーザーの対話セッション
- chat_messages: セッション内のメッセージ履歴
- generated_documents: 生成された4種のMarkdown設計書
- self_diagnostics: 設計書のAI自己診断結果

```text
+-------+       +---------------+       +---------------+
| users | 1---N | chat_sessions | 1---N | chat_messages |
+-------+       +---------------+       +---------------+
                        |
                        +---N +---------------------+
                              | generated_documents |
                              +---------------------+
                                         |
                                         +---1 +------------------+
                                               | self_diagnostics |
                                               +------------------+
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

ディレクトリ構成:
```text
app/
├── api/
│   ├── auth.py
│   ├── chat.py
│   └── documents.py
├── services/
│   ├── auth_service.py
│   ├── chat_service.py
│   ├── document_service.py
│   └── ai_agent.py
├── repositories/
│   ├── user_repository.py
│   ├── chat_repository.py
│   └── document_repository.py
└── main.py
```

分割方針:
- api層: FastAPIのルーター定義およびHTTPリクエストのバリデーション、レスポンス返却を担当する。
- services層: 各機能のビジネスロジックを実行し、AIエージェントやリポジトリを統合する。
- repositories層: PostgreSQLへのデータ永続化・CRUD操作を担当する。
- ai_agent層: LangChain・LangGraphを用いてGemini Flash-Lite APIとの連携を隠蔽する。

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
| app/services/chat_service.py | サービス | チャットの進行管理、初期参考資料の読み込み制御、AIエージェントの呼び出し制御を行う。 | app/repositories/chat_repository.py, app/services/ai_agent.py |
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
| 利用者 | message, session_id, files | バリデーション・ファイル形式件数チェック | app/api/chat.py |
| app/api/chat.py | message, session_id, files | — | app/services/chat_service.py |
| app/services/chat_service.py | メッセージ履歴・ファイルデータ | — | app/repositories/chat_repository.py |
| app/repositories/chat_repository.py | 取得データ | — | chat_messages |
| app/services/chat_service.py | プロンプト（資料含む） | — | app/services/ai_agent.py |
| app/services/ai_agent.py | AI応答生成依頼 | — | Gemini Flash-Lite API |

- データ項目: チャットメッセージ(message, session_id, sender, content, files)

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

共通エラーレスポンス形式:
- すべてのエラーレスポンスは以下のJSON形式で返却する。
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ"
  }
}
```

例外検知・ログ出力方針:
- FastAPIの例外ハンドラーにより、バリデーションエラー(400)、認証エラー(401)、リソース競合(409)、外部API連携失敗・サーバーエラー(500)をキャッチする。
- 機密保持(NFR-008)に基づき、チャットや入力の内容は一切ログに残さない方針を徹底し、システムエラーのスタックトレースや最小限のシステムステータスのみをログに出力する。
