# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針

技術スタック:
- フロントエンド: Next.js (App Router) + Tamagui
- バックエンド: FastAPI + LangChain・LangGraph (Python 3.13)
- データベース: PostgreSQL, Redis
- インフラ: VPS, Docker Compose, nginx, GitHub Actions

構成方針:
クライアントからのリクエストはnginxを経由してFastAPIアプリケーションにルーティングされ、JWT認証およびCookie検証が行われます。チャットヒアリングおよび設計書生成処理ではLangGraphを用いてLLM (Gemini Flash-Lite) との対話状態および処理フローを管理し、成果物はPostgreSQLに永続化されます。セッション管理やレートリミットにはRedisを使用します。

## 3.2 データモデル定義

主要エンティティ:
- users: ユーザー情報を管理するエンティティ
- projects: プロジェクト情報およびアップロードされた参考資料を管理するエンティティ
- messages: チャットヒアリングのメッセージ履歴を管理するエンティティ
- documents: 生成された4種設計書のMarkdownテキストを管理するエンティティ
- diagnoses: AIによる自己診断結果を管理するエンティティ

### テーブル: users

ユーザーの認証情報を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ユーザーID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | ハッシュ化されたパスワード |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

### テーブル: projects

プロジェクト情報および参考資料を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | プロジェクトID |
| user_id | UUID | FK, NOT NULL | 所有ユーザーID |
| title | VARCHAR(255) | NOT NULL | プロジェクト名 |
| reference_files | JSONB | — | 参考資料のメタデータ一覧(最大3件) |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

### テーブル: messages

チャットヒアリングのメッセージ履歴を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | メッセージID |
| project_id | UUID | FK, NOT NULL | プロジェクトID |
| role | VARCHAR(50) | NOT NULL | 送信者ロール(user / assistant) |
| content | TEXT | NOT NULL | メッセージ本文 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

### テーブル: documents

生成された4種の設計書を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ドキュメントID |
| project_id | UUID | FK, NOT NULL | プロジェクトID |
| requirement_def | TEXT | NOT NULL | 要件定義書Markdown |
| external_design | TEXT | NOT NULL | 外部設計書Markdown |
| internal_design | TEXT | NOT NULL | 内部設計書Markdown |
| implementation_plan | TEXT | NOT NULL | 実装計画Markdown |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

### テーブル: diagnoses

AIによる設計書の自己診断結果を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | 診断ID |
| project_id | UUID | FK, NOT NULL | プロジェクトID |
| diagnosis_data | JSONB | NOT NULL | 3段階の自己診断結果データ |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

## 3.3 バックエンド処理・モジュール設計

ディレクトリ構成:
```text
backend/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   └── projects.py
│   │   └── deps.py
│   ├── core/
│   │   ├── config.py
│   │   └── security.py
│   ├── models/
│   │   └── *.py
│   ├── services/
│   │   ├── chat_service.py
│   │   └── generation_service.py
│   └── main.py
└── requirements.txt
```
主要な処理ロジックはFastAPIのルーター層、ビジネスロジックを担うサービス層、LangChain/LangGraphを利用したAI連携層に分離します。

### APIエンドポイント一覧

| メソッド | パス | 概要 |
|---|---|---|
| POST | /api/v1/auth/register | アカウント登録処理 |
| POST | /api/v1/auth/login | ログイン認証処理 |
| GET | /api/v1/projects | プロジェクト一覧取得処理 |
| POST | /api/v1/projects | プロジェクト作成処理 |
| POST | /api/v1/projects/{id}/messages | チャットメッセージ送信・LLM応答処理 |
| POST | /api/v1/projects/{id}/generate | 設計書一括生成および自己診断実行処理 |
| GET | /api/v1/projects/{id}/documents | 設計書および自己診断結果取得処理 |

### モジュール一覧

| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| app/api/v1/auth.py | ルート | 認証関連のエンドポイントルーティングとリクエストバリデーションを行う | app/services/auth_service.py, fastapi |
| app/api/v1/projects.py | ルート | プロジェクト、チャット、生成、ドキュメント取得のエンドポイントルーティングを行う | app/services/chat_service.py, app/services/generation_service.py, fastapi |
| app/services/chat_service.py | サービス | チャットの入力検証、履歴管理、LangGraphを通したGeminiとの対話制御を行う | app/models/messages.py, langchain |
| app/services/generation_service.py | サービス | 4種設計書の生成および自己診断の実行をLLMに依頼し結果を保存する | app/models/documents.py, app/models/diagnoses.py, langchain |

### 処理別データフロー

#### DF-1: POST /api/v1/auth/register

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | バリデーションおよびパスワードハッシュ化 | app/api/v1/auth.py |
| app/api/v1/auth.py | ユーザー登録データ | — | users |

- データ項目: 登録情報(email, password)

#### DF-2: POST /api/v1/auth/login

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | 認証確認 | app/api/v1/auth.py |
| app/api/v1/auth.py | ユーザー検索クエリ | — | users |

- データ項目: ログイン情報(email, password)

#### DF-3: GET /api/v1/projects

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | JWTトークン | 認証チェック | app/api/v1/projects.py |
| app/api/v1/projects.py | user_idによるプロジェクト検索 | — | projects |

- データ項目: プロジェクト一覧(id, title, updated_at)

#### DF-4: POST /api/v1/projects

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | title, reference_files | バリデーション | app/api/v1/projects.py |
| app/api/v1/projects.py | 新規プロジェクトデータ | — | projects |

- データ項目: プロジェクト作成データ(title, reference_files)

#### DF-5: POST /api/v1/projects/{id}/messages

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | message | 空送信チェック・文字数チェック | app/services/chat_service.py |
| app/services/chat_service.py | チャット履歴データ | — | messages |
| app/services/chat_service.py | プロンプト | LangChain経由でLLM呼び出し | Gemini Flash-Lite |

- データ項目: チャットメッセージ(message)

#### DF-6: POST /api/v1/projects/{id}/generate

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | project_id | プロジェクト存在確認 | app/services/generation_service.py |
| app/services/generation_service.py | ヒアリング履歴 | LangGraph/LangChainによる4種設計書・自己診断生成 | Gemini Flash-Lite |
| app/services/generation_service.py | 生成された設計書データ | — | documents |
| app/services/generation_service.py | 自己診断結果データ | — | diagnoses |

- データ項目: 生成対象データ(project_id)

#### DF-7: GET /api/v1/projects/{id}/documents

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | project_id | 認証チェック | app/api/v1/projects.py |
| app/api/v1/projects.py | project_idによるドキュメント検索 | — | documents |
| app/api/v1/projects.py | project_idによる自己診断検索 | — | diagnoses |

- データ項目: ドキュメント・診断取得クエリ(project_id)

## 3.4 例外処理・エラーハンドリング・ログ設計

共通エラーレスポンス形式:
すべてのエラー時は以下のJSON形式で返却します。
```json
{
  "detail": "エラーメッセージ"
}
```

例外検知・ログ出力方針:
- 機密情報や入力内容は一切ログに残さず、エラーの有無や日時、ステータスコードのみをログ出力します。
- バリデーションエラー時は400、認証失敗時は401、対象不存在は404、LLM応答失敗時などは500系エラーとして返却します。
