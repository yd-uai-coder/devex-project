# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針

技術スタック:
- フロントエンド: Next.js (App Router), Tamagui
- バックエンド: FastAPI, Python 3.13, LangChain, LangGraph
- データベース: PostgreSQL (リレーショナルデータ保存), Redis (レート制限およびトークン失効管理)
- インフラ: VPS, Docker Compose, nginx, GitHub Actions (自動デプロイ)

アーキテクチャ方針:
フロントエンドはSSR/CSRを適切に組み合わせたNext.js App Router構成を採用し、Tamaguiによりクロスプラットフォーム対応のUIを構築する。バックエンドはFastAPIによる非同期REST APIサーバーを構築し、LangChainおよびLangGraphを用いてGemini Flash-Liteとの対話フローや設計書生成ワークフローを制御する。セキュリティ・不正利用対策としてRedisを用いたレート制限ミドルウェアを導入し、全APIへのアクセス制御を行う。

## 3.2 データモデル定義

主要エンティティ:
- users: ユーザー情報を管理するエンティティ
- chat_sessions: ユーザーごとのチャットセッションを管理するエンティティ
- messages: セッション内のメッセージ、送信者、参考資料データを保持するエンティティ
- documents: チャットセッションに紐づく4種の設計書および自己診断結果を保持するエンティティ（再生成時は同一セッション内の既存レコードを置換する方針とする）

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

チャットセッション内のメッセージおよび添付参考資料データを格納するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | メッセージID |
| session_id | UUID | FK (chat_sessions.id), NOT NULL | セッションID |
| sender | VARCHAR(50) | NOT NULL | 送信者 (user / ai) |
| content | TEXT | NOT NULL | メッセージ本文 |
| files | JSON | — | 参考資料ファイル情報（最大3件、抽出テキスト等） |
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

ディレクトリ構成:
```text
app/
├── api/v1/
│   ├── auth.py
│   ├── chat.py
│   └── documents.py
├── services/
│   ├── auth_service.py
│   ├── chat_service.py
│   └── ai_service.py
├── repositories/
│   ├── user_repo.py
│   ├── chat_repo.py
│   └── document_repo.py
├── core/
│   ├── security.py
│   ├── middleware.py
│   └── database.py
└── main.py
```
主要処理ロジックの分割方針:
FastAPIのルーター層（api/v1/）はリクエスト受け取りとバリデーション、認可チェックを担当し、ビジネスロジックはサービス層（services/）へ委譲する。データベース操作はリポジトリ層（repositories/）にカプセル化し、セキュリティや共通ミドルウェア（レート制限等）はcore/に集約する。

### APIエンドポイント一覧

| メソッド | パス | 概要 |
|---|---|---|
| POST | /api/v1/auth/register | 新規ユーザー登録エンドポイント |
| POST | /api/v1/auth/login | ログイン認証エンドポイント |
| POST | /api/v1/chat/sessions | チャットセッション作成エンドポイント |
| GET | /api/v1/chat/sessions | チャットセッション一覧取得エンドポイント |
| GET | /api/v1/chat/sessions/{id}/messages | チャットメッセージ履歴取得エンドポイント |
| POST | /api/v1/chat/messages | チャットメッセージ送信とLLM応答処理エンドポイント |
| POST | /api/v1/documents/generate | 4種設計書一括生成および自己診断実行エンドポイント |
| GET | /api/v1/documents | 保存済み設計書および履歴一覧取得エンドポイント |
| GET | /api/v1/documents/{id} | 保存済み設計書個別詳細取得エンドポイント |

### モジュール一覧

| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| app/api/v1/auth.py | ルート | 認証および登録関連のHTTPリクエストを受け取り、ログインおよびサインアップ処理を実行する。 | app/core/security.py, app/repositories/user_repo.py |
| app/api/v1/chat.py | ルート | チャットセッション管理、メッセージ送信、およびファイル入力を受け付け、認証・認可とバリデーションを行う。 | app/services/chat_service.py |
| app/api/v1/documents.py | ルート | 設計書の生成、履歴取得、個別詳細取得のリクエストを処理し、認証および所有者検証を行う。 | app/services/ai_service.py, app/repositories/document_repo.py |
| app/services/chat_service.py | サービス | チャットの文字数・空送信バリデーション、参考資料の制限検証・抽出、セッションおよびメッセージの保存制御を行う。 | app/repositories/chat_repo.py, app/services/ai_service.py |
| app/services/ai_service.py | サービス | LangChain/LangGraphおよびGemini Flash-Liteを呼び出し、対話応答や設計書生成・自己診断を実行する。 | langchain, langgraph |
| app/repositories/* | リポジトリ | SQLAlchemyを用いてPostgreSQLに対するCRUD操作カプセル化を提供する。 | sqlalchemy |

### 処理別データフロー

#### DF-5: POST /api/v1/auth/register

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | メールアドレス、パスワード | — | app/api/v1/auth.py |
| app/api/v1/auth.py | パスワード | ハッシュ化 | users |
| users | 新規ユーザーエンティティ | — | app/api/v1/auth.py |
| app/api/v1/auth.py | 登録成功トークン | — | 利用者 |

- データ項目: 登録情報(email, password)

#### DF-1: POST /api/v1/auth/login

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | メールアドレス、パスワード | Redisレート制限チェック | app/api/v1/auth.py |
| app/api/v1/auth.py | メールアドレス | core/security経由でハッシュ照合 | users |
| users | ユーザーエンティティ | — | app/api/v1/auth.py |
| app/api/v1/auth.py | 認証成功トークン | — | 利用者 |

- データ項目: ログイン情報(email, password)

#### DF-6: POST /api/v1/chat/sessions

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | タイトル、初期ファイル | Bearerトークン認証 | app/api/v1/chat.py |
| app/api/v1/chat.py | セッションデータ | — | chat_sessions |
| chat_sessions | 作成完了セッションID | — | 利用者 |

- データ項目: セッション作成データ(title, initial_files)

#### DF-7: GET /api/v1/chat/sessions

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 認証トークン | — | app/api/v1/chat.py |
| app/api/v1/chat.py | ユーザーID | — | chat_sessions |
| chat_sessions | セッション一覧データ | — | 利用者 |

- データ項目: セッション一覧(user_id, chat_sessions_list)

#### DF-8: GET /api/v1/chat/sessions/{id}/messages

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 認証トークン、セッションID | 所有者検証 | app/api/v1/chat.py |
| app/api/v1/chat.py | セッションID | — | messages |
| messages | メッセージ履歴一覧 | — | 利用者 |

- データ項目: メッセージ履歴(session_id, messages_list)

#### DF-2: POST /api/v1/chat/messages

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | セッションID、メッセージ、参考資料ファイル(最大3件) | Bearerトークン認証・所有者検証・文字数制限・空送信チェック・Redisレート制限 | app/api/v1/chat.py |
| app/api/v1/chat.py | メッセージデータ・ファイル情報 | — | app/services/chat_service.py |
| app/services/chat_service.py | プロンプト・抽出参考資料 | LangChain経由でLLM呼び出し | Gemini Flash-Lite |
| Gemini Flash-Lite | AI応答メッセージ | — | app/services/chat_service.py |
| app/services/chat_service.py | チャット履歴・AI応答・参考資料 | — | messages |
| messages | 保存完了AI応答データ | — | 利用者 |

- データ項目: チャット入出力(session_id, message, files, response)

#### DF-3: POST /api/v1/documents/generate

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | チャットセッションID | Bearerトークン認証・所有者検証・Redisレート制限 | app/api/v1/documents.py |
| app/api/v1/documents.py | セッション履歴 | — | messages |
| messages | 対話コンテキスト | LangGraphワークフロー実行 | app/services/ai_service.py |
| app/services/ai_service.py | 生成指示 | 4種設計書および自己診断生成 | Gemini Flash-Lite |
| Gemini Flash-Lite | 生成文書・自己診断結果 | — | app/services/ai_service.py |
| app/services/ai_service.py | 文書データ（既存セッションのレコード置換） | — | documents |
| documents | 生成完了と設計書データ | — | 利用者 |

- データ項目: 設計書・自己診断データ(chat_session_id, requirements_doc, external_doc, internal_doc, implementation_doc, self_diagnosis)

#### DF-4: GET /api/v1/documents

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 認証トークン | Bearerトークン認証 | app/api/v1/documents.py |
| app/api/v1/documents.py | ユーザーID | — | documents |
| documents | 保存済み設計書・履歴一覧 | — | app/api/v1/documents.py |
| app/api/v1/documents.py | 一覧データレスポンス | — | 利用者 |

- データ項目: 履歴一覧(user_id, documents_list, chat_sessions_list)

#### DF-9: GET /api/v1/documents/{id}

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 認証トークン、文書ID | Bearerトークン認証・所有者検証 | app/api/v1/documents.py |
| app/api/v1/documents.py | 文書ID | — | documents |
| documents | 保存済み設計書個別詳細 | — | app/api/v1/documents.py |
| app/api/v1/documents.py | 文書詳細データレスポンス | — | 利用者 |

- データ項目: 文書詳細(id, requirements_doc, external_doc, internal_doc, implementation_doc, self_diagnosis)

## 3.4 例外処理・エラーハンドリング・ログ設計

例外処理・エラーハンドリング方針:
- 共通エラーレスポンス形式として、HTTPステータスコードに応じたJSONオブジェクト（error, message, details）を返却する。
- 認証失敗は 401、権限・所有者違反は 403、リソース不存在は 404、入力不備は 400、レート制限超過は 429、AI応答失敗や生成失敗は 500 を返す。
- Redisを利用したレート制限ミドルウェアにより、不正な大量アクセスや無料枠の保護を行う。
- セキュリティ要件（NFR-007）に基づき、ログにはプロンプトやチャットの本文を残さず、メタデータとエラーコードのみを記録する。
