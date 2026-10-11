# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針
- **フロントエンド**: Next.js (App Router) と Tamagui を採用。Server Components と Client Components を適切に分割し、表示速度と開発効率を両立する。
- **バックエンド**: FastAPI (Python 3.13) を採用。非同期処理による高パフォーマンス、Pydantic による堅牢なバリデーション、および LangChain・LangGraph による柔軟なAIエージェント構築を実現する。
- **データベース**: PostgreSQL を採用し、ユーザー、プロジェクト、チャット履歴、生成された設計書等のリレーショナルデータを安全に永続化する。
- **キャッシュ・インフラ**: Redis を採用し、APIレートリミットの制御やJWTリフレッシュトークンの失効管理を行う。インフラ構成としては、VPS上にDocker Compose環境を構築し、前段の nginx がリバースプロキシおよびTLS終端を担当する。

## 3.2 データモデル定義
- 主要エンティティ一覧:
  - ユーザー (`users`)
  - プロジェクト (`projects`)
  - 参考資料 (`reference_files`)
  - チャット履歴 (`chat_messages`)
  - 設計書 (`documents`)
  - 自己診断結果 (`document_diagnostics`)

### テーブル: users
| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ユーザーID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | ハッシュ化されたパスワード |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 更新日時 |

### テーブル: projects
| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | プロジェクトID |
| user_id | UUID | FK (users.id), NOT NULL | 所有者ユーザーID |
| project_name | VARCHAR(255) | NOT NULL | プロジェクト名 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 更新日時 |

### テーブル: reference_files
| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | 参考資料ID |
| project_id | UUID | FK (projects.id), NOT NULL | プロジェクトID |
| file_name | VARCHAR(255) | NOT NULL | 元のファイル名 |
| file_path | VARCHAR(512) | NOT NULL | 保存先のパスまたはストレージURI |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | アップロード日時 |

### テーブル: chat_messages
| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | メッセージID |
| project_id | UUID | FK (projects.id), NOT NULL | プロジェクトID |
| role | VARCHAR(50) | NOT NULL | 送信者ロール ('user' / 'assistant') |
| content | TEXT | NOT NULL | メッセージ本文 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 送信日時 |

### テーブル: documents
| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | 設計書ID |
| project_id | UUID | FK (projects.id), NOT NULL | プロジェクトID |
| doc_type | VARCHAR(50) | NOT NULL | 種別 ('requirement' / 'external_design' / 'internal_design' / 'implementation_plan') |
| content | TEXT | NOT NULL | 生成されたMarkdown本文 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 生成日時 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 更新日時 |

### テーブル: document_diagnostics
| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | 診断結果ID |
| document_id | UUID | FK (documents.id), NOT NULL | 対象設計書ID |
| severity | VARCHAR(50) | NOT NULL | 深刻度 ('critical' / 'moderate' / 'minor') |
| message | TEXT | NOT NULL | 診断コメント・不足点の内容 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 診断日時 |

## 3.3 バックエンド処理・モジュール設計
ビジネスロジックはレイヤードアーキテクチャに基づき、ルーター層、サービス層、データアクセス層（リポジトリ層）に分割する。ディレクトリ構成は以下の通り。

```text
backend/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── projects.py
│   │   │   ├── chats.py
│   │   │   └── documents.py
│   │   └── deps.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── database.py
│   ├── models/
│   │   └── orm.py
│   ├── schemas/
│   │   └── pydantic_schemas.py
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── chat_service.py
│   │   ├── ai_service.py
│   │   └── document_service.py
│   └── main.py
├── Dockerfile
└── requirements.txt
```

| メソッド | パス | 概要 |
|---|---|---|
| POST | /api/v1/auth/register | AuthRouter: ユーザー新規登録リクエストを受け取り、 AuthService を呼び出す。 |
| POST | /api/v1/auth/login | AuthRouter: ログイン情報を検証し、JWTを発行して返す。 |
| POST | /api/v1/auth/refresh | AuthRouter: HttpOnly Cookieのリフレッシュトークンを検証し、アクセストークンを再発行する。 |
| GET | /api/v1/projects | ProjectRouter: 認証ユーザーのプロジェクト一覧をデータベースから取得して返す。 |
| POST | /api/v1/projects | ProjectRouter: プロジェクト作成および参考資料ファイル群の保存処理を実行する。 |
| GET | /api/v1/projects/{id}/chats | ChatRouter: 指定プロジェクトのチャット履歴一覧を取得して返す。 |
| POST | /api/v1/projects/{id}/chats | ChatRouter: ユーザーメッセージのバリデーション・保存、および LangChain を用いたAI応答取得を実行する。 |
| POST | /api/v1/projects/{id}/generate | DocumentRouter: 蓄積されたチャット履歴と参考資料を元に、LangGraphで4種の設計書一括生成およびAI自己診断を実行する。 |
| GET | /api/v1/projects/{id}/documents | DocumentRouter: 生成済みの4種の設計書およびAI自己診断結果を取得して返す。 |

### モジュール一覧
| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| app/api/v1/*.py | ルーター層 | HTTPリクエストの受付、バリデーション、レスポンス返却 | app/services/*.py, app/api/deps.py |
| app/services/*.py | サービス層 | トランザクション制御を含むビジネスロジックの実行 | app/models/orm.py, app/services/ai_service.py |
| app/services/ai_service.py | AI連携層 | LangChain / LangGraph を用いたLLM (Gemini) との対話・文書生成制御 | app/core/config.py |
| app/models/orm.py | データ層 | SQLAlchemyによるORM定義・DBマッピング | app/core/database.py |
| app/schemas/pydantic_schemas.py | スキーマ層 | 入出力データのPydanticバリデーション定義 | FastAPI |

### 処理別データフロー

#### DF-001: POST /api/v1/auth/register
| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | Pydanticバリデーションおよびパスワードハッシュ化 | サービス (AuthService) |
| サービス (AuthService) | ユーザー情報 | INSERT実行 | データベース (users) |

- データ項目: ユーザー登録データ(email, password_hash)

#### DF-002: POST /api/v1/auth/login
| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | email, password | 認証情報照合・JWT生成 | サービス (AuthService) |
| サービス (AuthService) | アクセストークン / リフレッシュトークン | Cookie設定およびトークン返却 | 利用者 / Redis |

- データ項目: 認証データ(email, password, access_token, refresh_token)

#### DF-003: POST /api/v1/auth/refresh
| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | リフレッシュトークン (Cookie) | Redisを用いたトークン失効・有効性確認と新規アクセストークン発行 | サービス (AuthService) |
| サービス (AuthService) | 新アクセストークン | レスポンス返却 | 利用者 |

- データ項目: トークン更新データ(refresh_token, access_token)

#### DF-004: GET /api/v1/projects
| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | JWT (Authorization Header) | ユーザーID抽出とSELECT実行 | データベース (projects) |
| データベース (projects) | プロジェクト一覧レコード | JSONシリアライズ | 利用者 |

- データ項目: プロジェクト一覧データ(project_id, user_id, project_name, created_at, updated_at)

#### DF-005: POST /api/v1/projects
| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | project_name, reference_files (最大3件) | ファイル保存処理およびDB登録 | データベース (projects, reference_files) |
| データベース | 登録完了データ | レスポンス返却 | 利用者 |

- データ項目: プロジェクト作成データ(project_name, file_name, file_path)

#### DF-006: GET /api/v1/projects/{id}/chats
| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | project_id | 権限確認およびチャット履歴取得SELECT | データベース (chat_messages) |
| データベース | チャット履歴一覧 | JSONシリアライズ | 利用者 |

- データ項目: チャット履歴データ(message_id, project_id, role, content, created_at)

#### DF-007: POST /api/v1/projects/{id}/chats
| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | message (数千文字以内・非空) | メッセージのDB保存およびLangChainへのプロンプト入力・LLM呼び出し | 外部サービス (Gemini Flash-Lite) |
| 外部サービス | AI応答メッセージ | 応答テキストのDB保存 (`chat_messages`) | データベース (chat_messages) |
| データベース | 保存完了データ | レスポンス返却 | 利用者 |

- データ項目: チャットメッセージデータ(project_id, role, content)

#### DF-008: POST /api/v1/projects/{id}/generate
| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | project_id | チャット履歴・参考資料の収集、LangGraphによる4種設計書生成・自己診断の実行 | 外部サービス (Gemini Flash-Lite) |
| 外部サービス | 生成された4種Markdownおよび診断結果 | トランザクション内でのDB保存 | データベース (documents, document_diagnostics) |
| データベース | 保存完了データ | レスポンス返却 | 利用者 |

- Data項目: 設計書生成・診断データ(doc_type, content, severity, message)

#### DF-009: GET /api/v1/projects/{id}/documents
| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | project_id | 設計書および自己診断結果の取得SELECT | データベース (documents, document_diagnostics) |
| データベース | 設計書・診断データ | JSONシリアライズ | 利用者 |

- データ項目: 設計書取得データ(doc_type, content, severity, message)

## 3.4 例外処理・エラーハンドリング・ログ設計
- **共通エラーレスポンス形式**: FastAPI の `HTTPException` をラップし、すべてのエラーで一貫したJSON構造を返す。
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "入力値が不正です。",
      "details": []
    }
  }
  ```
- **例外検知・ログ出力方針**:
  - アプリケーション全体で構造化ロギング (JSON形式) を採用し、標準出力へ出力する（nginxおよびDocker側で収集）。
  - LLM呼び出し失敗や外部依存のエラー（502 Bad Gateway）が発生した場合は、送受信したメッセージやプロンプトのメタデータをログに記録しつつ、トランザクションをロールバックしてクライアントに適切なエラーメッセージを通知する。
  - 認証エラー（401）および権限エラー（403）はセキュリティ監査ログとして記録する。