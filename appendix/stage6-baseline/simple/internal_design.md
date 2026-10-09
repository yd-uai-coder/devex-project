# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針
- **フロントエンド**: 
  - **選定理由**: 開発スピードとインタラクティブなUI構築（マークダウンプレビューやチャットインターフェース）のしやすさを考慮し、React / Next.js（App Router）を採用する。
  - **構成方針**: コンポーネント指向に基づき、画面ごとのUIコンポーネントとAPIクライアント層を分離。状態管理にはReact Query (TanStack Query)を利用してサーバーサイドの状態を効率的にキャッシュ・同期する。
- **バックエンド**: 
  - **選定理由**: 型安全性、非同期処理の堅牢性、AI連携ライブラリの豊富さを考慮し、Node.js (TypeScript) + Express または NestJS を採用する。ここでは保守性とモジュール構造の明確さから NestJS を前提とする。
  - **構成方針**: クリーンアーキテクチャ（レイヤードアーキテクチャ）を採用し、Controller（プレゼンテーション層）、Service（ビジネスロジック層）、Repository（データアクセス層）に明確に分離する。
- **データベース**: 
  - **選定理由**: リレーショナルデータの整合性（ユーザー、プロジェクト、チャット履歴、設計書版管理）とPostgreSQLの堅牢性を評価。
  - **構成方針**: ORMには Prisma または TypeORM を利用し、スキーマ定義から型安全なクエリ操作を実現する。
- **インフラ**: 
  - **選定理由**: MVPの迅速なリリースと運用コスト削減のため、Vercel（フロントエンド）および Render / AWS (ECS/RDS) などのマネージドサービスを想定する。

## 3.2 データモデル定義
- 主要エンティティ一覧
  - `users`: ユーザー情報
  - `projects`: プロジェクト情報
  - `documents`: 参考資料
  - `chats`: チャットメッセージ履歴
  - `summaries`: 構造化サマリ
  - `specifications`: 生成された4種設計書（版管理対応）
  - `diagnostics`: AI自己診断結果

### テーブル: users
| カラム名 | データ型 | 制約 | 説明 |
|:---|:---|:---|:---|
| id | UUID | PK, DEFAULT gen_random_uuid() | ユーザーID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | ハッシュ化済みパスワード |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 更新日時 |

### テーブル: projects
| カラム名 | データ型 | 制約 | 説明 |
|:---|:---|:---|:---|
| id | UUID | PK, DEFAULT gen_random_uuid() | プロジェクトID |
| user_id | UUID | FK (users.id), NOT NULL | 所有者ユーザーID |
| title | VARCHAR(255) | NOT NULL | プロジェクト名 |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'chatting' | ステータス (chatting, generating, completed) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 更新日時 |

### テーブル: documents
| カラム名 | データ型 | 制約 | 説明 |
|:---|:---|:---|:---|
| id | UUID | PK, DEFAULT gen_random_uuid() | 資料ID |
| project_id | UUID | FK (projects.id), NOT NULL | プロジェクトID |
| file_name | VARCHAR(255) | NOT NULL | 元のファイル名 |
| file_path | VARCHAR(512) | NOT NULL | ストレージ保存パス |
| file_size | INT | NOT NULL | ファイルサイズ(バイト) |
| mime_type | VARCHAR(100) | NOT NULL | MIMEタイプ |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | アップロード日時 |

### テーブル: chats
| カラム名 | データ型 | 制約 | 説明 |
|:---|:---|:---|:---|
| id | UUID | PK, DEFAULT gen_random_uuid() | チャットメッセージID |
| project_id | UUID | FK (projects.id), NOT NULL | プロジェクトID |
| sender | VARCHAR(20) | NOT NULL | 送信者タイプ ('user' / 'ai') |
| message | TEXT | NOT NULL | メッセージ本文 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 送信日時 |

### テーブル: summaries
| カラム名 | データ型 | 制約 | 説明 |
|:---|:---|:---|:---|
| id | UUID | PK, DEFAULT gen_random_uuid() | サマリID |
| project_id | UUID | FK (projects.id), NOT NULL | プロジェクトID |
| content | TEXT | NOT NULL | 構造化サマリ内容(Markdown/JSON) |
| is_approved | BOOLEAN | NOT NULL, DEFAULT FALSE | 承認フラグ |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 作成日時 |

### テーブル: specifications
| カラム名 | データ型 | 制約 | 説明 |
|:---|:---|:---|:---|
| id | UUID | PK, DEFAULT gen_random_uuid() | 設計書ID |
| project_id | UUID | FK (projects.id), NOT NULL | プロジェクトID |
| doc_type | VARCHAR(50) | NOT NULL | 種別 ('requirement' / 'external' / 'internal' / 'plan') |
| version | INT | NOT NULL | 版番号 (直近3件を管理) |
| content | TEXT | NOT NULL | マークダウン内容 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 生成日時 |

### テーブル: diagnostics
| カラム名 | データ型 | 制約 | 説明 |
|:---|:---|:---|:---|
| id | UUID | PK, DEFAULT gen_random_uuid() | 診断ID |
| project_id | UUID | FK (projects.id), NOT NULL | プロジェクトID |
| level | VARCHAR(20) | NOT NULL | 重要度 ('critical' / 'moderate' / 'minor') |
| message | TEXT | NOT NULL | 不足点・指摘内容 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 診断日時 |

## 3.3 バックエンド処理・モジュール設計
- 主要処理ロジック（ビジネスロジック）の分割方針。ディレクトリ構成はコードブロックで示す
```text
src/
├── common/             # 共通ガード、例外フィルター、インターセプター
├── config/             # 環境変数・設定管理
├── modules/
│   ├── auth/           # 認証・認可モジュール
│   ├── projects/       # プロジェクト管理モジュール
│   ├── documents/      # 参考資料アップロードモジュール
│   ├── chats/          # チャット・ヒアリングモジュール
│   ├── summaries/      # 構造化サマリ管理モジュール
│   ├── specifications/ # 設計書一括生成・版管理モジュール
│   └── diagnostics/    # AI自己診断モジュール
└── main.ts
```

- APIエンドポイント一覧
| メソッド | パス | 内部担当 (ルート・サービス) |
|:---:|:---|:---|
| POST | `/api/v1/auth/register` | `AuthController` / `AuthService` (ユーザー登録・ハッシュ化) |
| POST | `/api/v1/auth/login` | `AuthController` / `AuthService` (検証・JWT/Cookie発行) |
| POST | `/api/v1/auth/logout` | `AuthController` / `AuthService` (セッション破棄) |
| POST | `/api/v1/projects` | `ProjectsController` / `ProjectsService` (プロジェクト作成) |
| GET | `/api/v1/projects` | `ProjectsController` / `ProjectsService` (プロジェクト一覧) |
| POST | `/api/v1/projects/{id}/documents` | `DocumentsController` / `DocumentsService` (ファイル保存・バリデーション) |
| GET | `/api/v1/projects/{id}/chats` | `ChatsController` / `ChatsService` (チャット履歴取得) |
| POST | `/api/v1/projects/{id}/chats` | `ChatsController` / `ChatsService` (LLM対話連携) |
| POST | `/api/v1/projects/{id}/summary/approve` | `SummariesController` / `SummariesService` (サマリ承認状態更新) |
| POST | `/api/v1/projects/{id}/specifications/generate` | `SpecificationsController` / `SpecificationsService` (LLM設計書一括生成・版管理) |
| GET | `/api/v1/projects/{id}/specifications` | `SpecificationsController` / `SpecificationsService` (生成済み設計書取得) |
| GET | `/api/v1/projects/{id}/diagnostics` | `DiagnosticsController` / `DiagnosticsService` (LLM自己診断結果取得) |

### モジュール一覧
| パス | 層 | 責務 | 主な依存先 |
|:---|:---|:---|:---|
| `src/modules/auth` | 認証 | ユーザー登録、ログイン、JWT発行・検証、Cookie操作 | `JwtService`, `UsersRepository` |
| `src/modules/projects` | ドメイン | プロジェクトのCRUDおよび所有権確認 | `ProjectsRepository` |
| `src/modules/documents` | インフラ/ドメイン | 参考資料のMIME/拡張子検証およびストレージ保存 | `DocumentsRepository` |
| `src/modules/chats` | ドメイン/外部 | ヒアリングの対話管理、Gemini API呼び出し | `GeminiService`, `ChatsRepository` |
| `src/modules/summaries` | ドメイン | 構造化サマリの生成・承認状態管理 | `GeminiService`, `SummariesRepository` |
| `src/modules/specifications` | ドメイン/外部 | 4種設計書の並行生成、版管理（保持数上限3） | `GeminiService`, `SpecificationsRepository` |
| `src/modules/diagnostics` | ドメイン/外部 | 設計書に対するAI自己診断実行 | `GeminiService`, `DiagnosticsRepository` |

### 処理別データフロー

#### DF-01: POST /api/v1/auth/login
| 元 | データ | 変換 | 先 |
|:---|:---|:---|:---|
| 利用者 | ログインリクエスト(Email, Password) | パスワード照合・JWT署名生成 | `users` (DB) |
| `AuthService` | アクセストークン・リフレッシュトークン | レスポンスおよびHttpOnly Cookie設定 | 利用者 |

- データ項目: 認証情報(email, password)

#### DF-02: POST /api/v1/projects/{id}/documents
| 元 | データ | 変換 | 先 |
|:---|:---|:---|:---|
| 利用者 | アップロードファイル(最大3件) | 拡張子・MimeTypeバリデーション | `documents` (DB) |

- データ項目: 資料データ(project_id, file_name, file_path, file_size, mime_type)

#### DF-03: POST /api/v1/projects/{id}/chats
| 元 | データ | 変換 | 先 |
|:---|:---|:---|:---|
| 利用者 | チャットメッセージ | プロジェクト履歴付与・Gemini APIプロンプト構築 | 外部サービス (Gemini API) |
| 外部サービス (Gemini API) | AI応答テキスト | DB保存およびクライアント返却 | `chats` (DB) |

- データ項目: チャットメッセージ(project_id, sender, message)

#### DF-04: POST /api/v1/projects/{id}/specifications/generate
| 元 | データ | 変換 | 先 |
|:---|:---|:---|:---|
| 利用者 | 生成トリガー | 過去のチャット履歴・サマリ統合プロンプト構築 | 外部サービス (Gemini API) |
| 外部サービス (Gemini API) | 4種設計書Markdown | 版管理ロジック適用(直近3件維持) | `specifications` (DB) |

- データ項目: 設計書データ(project_id, doc_type, version, content)

#### DF-05: GET /api/v1/projects/{id}/diagnostics
| 元 | データ | 変換 | 先 |
|:---|:---|:---|:---|
| `SpecificationsService` | 生成済み設計書データ | 3段階(Critical/Moderate/Minor)不足点分析 | 外部サービス (Gemini API) |
| 外部サービス (Gemini API) | 自己診断結果 | 永続化および返却 | `diagnostics` (DB) |

- データ項目: 診断データ(project_id, level, message)

## 3.4 例外処理・エラーハンドリング・ログ設計
- **共通エラーレスポンス形式**:
  - 全てのAPIエラー時は以下のJSON形式でレスポンスを返却する。
  ```json
  {
    "statusCode": 400,
    "error": "Bad Request",
    "message": "エラーの詳細説明",
    "timestamp": "202X-XX-XXTXX:XX:XX.XXXZ",
    "path": "/api/v1/..."
  }
  ```
- **例外検知・ログ出力方針**:
  - **構造化ロギング**: Winston または NestJS 標準 Logger を使用し、JSON形式で標準出力へログを出力する。
  - **LLMエラーハンドリング**: Gemini APIのレートリミット（429 Too Many Requests）や上限超過エラー発生時は、例外フィルターで検知し、クライアントへ専用のエラーコード（例: `LLM_RATE_LIMIT_EXCEEDED`）と再試行促しメッセージを返却する。
  - **セキュリティ監査ログ**: 認証失敗、不正なリフレッシュトークン利用試行、権限外リソースアクセス試行は、警告レベル（WARN）以上で記録する。