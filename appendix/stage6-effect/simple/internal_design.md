# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針
- **フロントエンド**: Next.js (App Router) + Tamagui
  - 選定理由: SSRによる初期表示の高速化、UIコンポーネントの一貫性とクロスプラットフォーム対応が容易なTamaguiを採用。
  - 構成方針: ページ単位のルーティングをApp Routerで構成し、状態管理はReact HooksおよびContext APIを利用する。
- **バックエンド**: FastAPI + LangChain・LangGraph (Python 3.13)
  - 選定理由: 非同期処理に強く、AIエージェントの構築・ステート管理に優れたLangGraphおよび高速なFastAPIを採用。
  - 構成方針: レイヤードアーキテクチャ（ルーター・サービス・リポジトリ層）を採用し、ビジネスロジックとデータアクセスを分離する。
- **データベース**: PostgreSQL
  - 選定理由: リレーショナルデータ（プロジェクト、チャット履歴、生成文書）の堅牢な管理とJSONB等による柔軟な拡張性のため。
- **インフラ**: VPS + Docker Compose + nginx
  - 選定理由: コストパフォーマンスが高く、コンテナ化により環境差異を排除したデプロイを実現するため。nginxをリバースプロキシとして前段に配置し、SSL終端および静的ファイル配信を担当する。

## 3.2 データモデル定義

### 主要エンティティ一覧
- `projects` (プロジェクト)
- `chat_messages` (チャットメッセージ履歴)
- `documents` (生成設計書)
- `diagnostics` (AI自己診断結果)

### テーブル: projects
| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | プロジェクトID |
| project_name | VARCHAR(255) | NOT NULL | プロジェクト名 |
| initial_prompt | TEXT | NOT NULL | 初期要望テキスト |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'hearing' | 進捗ステータス (hearing, generating, completed, error) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | レコード作成日時 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | レコード更新日時 |

### テーブル: chat_messages
| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | メッセージID |
| project_id | UUID | FK (projects.id), NOT NULL | プロジェクトID |
| sender | VARCHAR(20) | NOT NULL | 送信者 (user, ai) |
| message | TEXT | NOT NULL | メッセージ本文 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 送信日時 |

### テーブル: documents
| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | ドキュメントID |
| project_id | UUID | FK (projects.id), NOT NULL | プロジェクトID |
| doc_type | VARCHAR(50) | NOT NULL | 設計書種別 (requirements, external_design, internal_design, implementation_plan) |
| content | TEXT | NOT NULL | Markdown形式の設計書本文 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 生成日時 |

### テーブル: diagnostics
| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | 診断ID |
| project_id | UUID | FK (projects.id), NOT NULL | プロジェクトID |
| severity | VARCHAR(20) | NOT NULL | 重要度 (critical, moderate, minor) |
| description | TEXT | NOT NULL | 不足点・改善提案の指摘内容 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 診断日時 |

## 3.3 バックエンド処理・モジュール設計

### ディレクトリ構成
```text
backend/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── projects.py
│   │   │   │   ├── chat.py
│   │   │   │   └── documents.py
│   │   │   └── router.py
│   ├── core/
│   │   ├── config.py
│   │   └── database.py
│   ├── models/
│   │   └── orm.py
│   ├── schemas/
│   │   └── pydantic.py
│   ├── services/
│   │   ├── chat_service.py
│   │   ├── document_service.py
│   │   └── ai_agent.py
│   └── main.py
├── Dockerfile
└── requirements.txt
```

### APIエンドポイント一覧
| メソッド | パス | 概要 (ルート・サービス層の担当) |
|---|---|---|
| POST | /api/v1/projects | プロジェクト作成、参考資料解析、初期メッセージ保存処理の呼び出し |
| POST | /api/v1/projects/{id}/chat | チャットメッセージバリデーション、LangGraph対話処理、AI応答の保存処理の呼び出し |
| POST | /api/v1/projects/{id}/generate | 4種設計書および自己診断の一括生成AIパイプライン実行処理の呼び出し |
| GET | /api/v1/projects/{id}/documents | 指定プロジェクトの生成済み設計書および診断結果の取得処理の呼び出し |

### モジュール一覧
| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| `app/api/v1/endpoints/*.py` | ルート | HTTPリクエストの受付、バリデーション、レスポンス返却 | FastAPI, schemas |
| `app/services/*.py` | サービス | ビジネスロジックの実行、トランザクション制御、AIエージェントの呼び出し | models, ai_agent |
| `app/services/ai_agent.py` | AI基盤 | LangChain/LangGraphを用いたLLMとの対話・文書生成・診断の制御 | LangChain, Gemini API |
| `app/models/orm.py` | データ | SQLAlchemyによるDBモデル定義 | SQLAlchemy |
| `app/schemas/pydantic.py` | スキーマ | 入出力データのPydanticバリデーション定義 | Pydantic |

### 処理別データフロー

#### DF-001: POST /api/v1/projects
| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | プロジェクト名、初期要望、参考資料ファイル | パラメータ検証・ファイルテキスト抽出 | `projects` (テーブル) |
| `projects` (テーブル) | 作成されたproject_id | レスポンス整形 | 利用者 |

- データ項目: プロジェクト作成(`project_name`, `initial_prompt`, `files`)

#### DF-002: POST /api/v1/projects/{id}/chat
| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | チャットメッセージ | 文字数・空文字チェック、履歴ロード | `chat_messages` (テーブル) |
| `chat_messages` (テーブル) | 過去のチャット履歴 | LangGraphへ入力してAI応答を生成 | 外部サービス (Gemini API) |
| 外部サービス (Gemini API) | AIからの応答テキスト | 応答内容の保存処理 | `chat_messages` (テーブル) |
| `chat_messages` (テーブル) | 保存完了データ | レスポンス整形 | 利用者 |

- データ項目: チャット送信(`message`)

#### DF-003: POST /api/v1/projects/{id}/generate
| 元 | データ | 変換 | 先 |
|---|---|---|---|
| `chat_messages` (テーブル) | チャット履歴全件 | 設計書一括生成および自己診断プロンプトの実行 | 外部サービス (Gemini API) |
| 外部サービス (Gemini API) | 生成された4種Markdownおよび診断結果 | 解析・パース処理 | `documents`, `diagnostics` (テーブル) |
| `documents` / `diagnostics` | 保存完了ステータス | レスポンス整形 | 利用者 |

- データ項目: 文書生成・診断(`project_id`)

#### DF-004: GET /api/v1/projects/{id}/documents
| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | プロジェクトID | 権限確認・DBクエリ実行 | `documents`, `diagnostics` (テーブル) |
| `documents` / `diagnostics` | 設計書データおよび診断結果 | レスポンスJSON構築 | 利用者 |

- データ項目: 文書取得(`project_id`)

## 3.4 例外処理・エラーハンドリング・ログ設計

- **共通エラーレスポンス形式**:
  すべてのエラー応答は、以下のJSON構造で統一する。
  ```json
  {
    "error": {
      "code": "BAD_REQUEST",
      "message": "入力されたメッセージが空または文字数制限を超過しています。",
      "details": []
    }
  }
  ```
- **例外検知・ログ出力方針**:
  - FastAPIの例外ハンドラ (`HTTPException`, `RequestValidationError` 等) を用いてキャッチし、構造化ログ（JSON形式）として標準出力に出力する。
  - LLMの上限超過エラーやタイムアウト等の外部API起因のエラー発生時は、該当メッセージをDBに保存せず、クライアントへ適切なエラーコード（`429` または `500`）と理由を返し、再送・再生成を促す。