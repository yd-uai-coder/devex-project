# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針
- **フロントエンド**: Next.js (App Router)
  - **選定理由**: サーバーコンポーネントとクライアントコンポーネントの最適配置による高速なページ描画、SEOおよび初期ロードの最適化、優れたルーティング機能のため。
- **UIライブラリ**: Tamagui
  - **選定理由**: クロスプラットフォーム対応のコンポーネント設計が可能であり、一貫したデザインシステムを効率的に構築できるため。
- **バックエンド**: FastAPI (Python 3.13) + LangGraph
  - **選定理由**: 非同期処理に優れ高速なAPI構築が可能。LangGraphを活用して、ヒアリングから4種設計書の連続的・段階的な生成といったマルチステップのエージェント処理を堅牢に制御できるため。
- **データベース**: PostgreSQL
  - **選定理由**: ユーザー情報、チャットセッション、構造化された設計書データ、およびリレーショナルなバージョン管理データを安全かつ確実に永続化するため。
- **キャッシュ・制限管理**: Redis
  - **選定理由**: APIのレート制限（Rate Limiting）やJWTリフレッシュトークンの失効管理、高速なセッション・一時データキャッシュを低レイテンシで実現するため。
- **インフラ**: Docker Compose, VPS + Nginx
  - **選定理由**: コンテナ化による環境依存の排除、保守性の向上。NginxをリバースプロキシおよびSSL終端として配置し、セキュアで容易なデプロイ環境を構築するため。

---

## 3.2 データモデル定義

### 主要エンティティ一覧
- **User (ユーザー)**: 認証情報およびアカウント管理
- **Project (プロジェクト)**: アイデアの起票から設計書生成までの親単位
- **Document (設計書)**: 4種の設計書コンテンツとバージョン管理（直近3件保持）
- **ChatHistory (チャット履歴)**: ユーザーとAI間の対話ログ
- **ReferenceFile (参考資料)**: プロジェクトに紐づくアップロードファイル情報

### テーブル: users
| カラム名 | データ型 | 制約 | 説明 |
|:---|:---|:---|:---|
| id | UUID | PK, NOT NULL | ユーザーID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | ハッシュ化パスワード |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 更新日時 |

### テーブル: projects
| カラム名 | データ型 | 制約 | 説明 |
|:---|:---|:---|:---|
| id | UUID | PK, NOT NULL | プロジェクトID |
| user_id | UUID | FK (users.id), NOT NULL | 所有者ユーザーID |
| title | VARCHAR(255) | NOT NULL | プロジェクトタイトル・概要名 |
| initial_idea | TEXT | NOT NULL | 初期アイデア・実現したいこと |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'hearing' | ステータス (hearing, summarizing, generating, completed) |
| summary_data | JSONB | NULL | AIによる構造化サマリデータ |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 更新日時 |

### テーブル: reference_files
| カラム名 | データ型 | 制約 | 説明 |
|:---|:---|:---|:---|
| id | UUID | PK, NOT NULL | ファイルID |
| project_id | UUID | FK (projects.id), NOT NULL | 紐づくプロジェクトID |
| file_name | VARCHAR(255) | NOT NULL | アップロードされたファイル名 |
| file_path | VARCHAR(512) | NOT NULL | 保存先パス（ストレージ/ローカル） |
| file_size | INTEGER | NOT NULL | ファイルサイズ (bytes) |
| mime_type | VARCHAR(100) | NOT NULL | MIMEタイプ (txt, md, pdf) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | アップロード日時 |

### テーブル: chat_histories
| カラム名 | データ型 | 制約 | 説明 |
|:---|:---|:---|:---|
| id | UUID | PK, NOT NULL | チャットログID |
| project_id | UUID | FK (projects.id), NOT NULL | 紐づくプロジェクトID |
| role | VARCHAR(50) | NOT NULL | 送信者ロール (user, assistant, system) |
| content | TEXT | NOT NULL | メッセージ内容 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 送信日時 |

### テーブル: documents
| カラム名 | データ型 | 制約 | 説明 |
|:---|:---|:---|:---|
| id | UUID | PK, NOT NULL | 設計書ID |
| project_id | UUID | FK (projects.id), NOT NULL | 紐づくプロジェクトID |
| doc_type | VARCHAR(50) | NOT NULL | 種別 (requirement, external_design, internal_design, implementation_plan) |
| version | INTEGER | NOT NULL, DEFAULT 1 | バージョン番号 (直近3件管理) |
| content | TEXT | NOT NULL | Markdown形式の設計書本文 |
| diagnostics | JSONB | NULL | AI自己診断結果（最重要・中程度・軽微の評価） |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | 生成日時 |

---

## 3.3 バックエンド処理・モジュール設計

### 主要処理ロジックの分割方針
バックエンド（FastAPI）は、レイヤードアーキテクチャおよびルーター・サービス分離の原則に基づき責務を分割する。AIエージェントの制御にはLangGraphを用い、非同期バックグラウンドワーカーにより重い生成処理を分離する。

```text
backend/
├── app/
│   ├── api/             # ルーター層 (エンドポイント定義・リクエスト受け渡し)
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── projects.py
│   │   │   └── documents.py
│   ├── core/            # 共通設定・セキュリティ・DB接続
│   │   ├── config.py
│   │   ├── security.py
│   │   └── database.py
│   ├── models/          # ORMモデル (SQLAlchemy)
│   ├── schemas/         # Pydanticスキーマ (入出力バリデーション)
│   ├── services/        # ビジネスロジック層
│   │   ├── auth_service.py
│   │   ├── project_service.py
│   │   ├── chat_service.py
│   │   └── ai_service.py
│   └── agents/          # LangGraphエージェント・プロンプト定義
│       ├── hearing_graph.py
│       └── generator_graph.py
└── main.py
```

### APIエンドポイント一覧
| メソッド | パス | 概要 (内部担当: ルート・サービス) |
|:---|:---|:---|
| `POST` | `/api/v1/auth/register` | ユーザー登録ルート: リクエスト検証後、auth_serviceでパスワードハッシュ化とユーザー作成を実行 |
| `POST` | `/api/v1/auth/login` | ログインルート: auth_serviceで資格情報検証、JWT発行およびHttpOnly Cookie設定 |
| `POST` | `/api/v1/auth/logout` | ログランウトルート: auth_serviceでRedisを用いたトークン失効処理を実行 |
| `POST` | `/api/v1/auth/refresh` | トークン再発行ルート: リフレッシュトークン検証後、新規アクセストークンを発行 |
| `GET` | `/api/v1/projects` | プロジェクト一覧取得ルート: project_serviceで該当ユーザーのプロジェクト群を取得 |
| `POST` | `/api/v1/projects` | プロジェクト作成ルート: project_serviceで初期入力検証、ファイル保存、プロジェクト初期化を実行 |
| `GET` | `/api/v1/projects/{id}` | プロジェクト詳細取得ルート: project_serviceでプロジェクト詳細および関連情報を取得 |
| `DELETE` | `/api/v1/projects/{id}` | プロジェクト削除ルート: project_serviceでプロジェクトおよび紐づくリソースを削除 |
| `POST` | `/api/v1/projects/{id}/chat` | チャットメッセージ送信ルート: chat_service経由でLangGraphグラフを呼び出し、SSEストリーミング応答を返却 |
| `GET` | `/api/v1/projects/{id}/summary` | サマリ取得ルート: project_serviceで構造化サマリデータ (`summary_data`) を返却 |
| `POST` | `/api/v1/projects/{id}/generate` | 4種設計書生成トリガーピルート: ai_serviceのバックグラウンドワーカーを起動し非同期生成を開始 |
| `GET` | `/api/v1/projects/{id}/documents` | 設計書取得ルート: document_serviceで指定バージョンの4種設計書データを取得 |
| `GET` | `/api/v1/projects/{id}/diagnostics` | 自己診断結果取得ルート: document_serviceで設計書に対するAI自己診断結果を取得 |

### モジュール一覧
| パス | 層 | 責務 | 主な依存先 |
|:---|:---|:---|:---|
| `app/api/v1/projects.py` | API層 | プロジェクト関連のエンドポイントルーティングと入力検証 | project_service, chat_service |
| `app/services/project_service.py` | サービス層 | プロジェクト・ファイル・サマリのビジネスロジック統括 | models, schemas |
| `app/services/chat_service.py` | サービス層 | チャット対話の進行管理、SSEストリーミング制御 | agents/hearing_graph, redis |
| `app/services/ai_service.py` | サービス層 | 4種設計書の順次非同期生成およびAI自己診断の統括 | agents/generator_graph, gemini_api |
| `app/agents/hearing_graph.py` | エージェント層 | 5観点ヒアリングの対話状態遷移と判定ロジック (LangGraph) | langchain, gemini_api |
| `app/agents/generator_graph.py` | エージェント層 | 連鎖的な4種設計書生成と自己診断評価の生成処理 (LangGraph) | langchain, gemini_api |

### 処理別データフロー

#### DF-01: POST /api/v1/projects/{id}/chat
| 元 | データ | 変換 | 先 |
|:---|:---|:---|:---|
| 利用者 | ユーザー回答テキスト | パラメータ検証・セッション取得 | project_service |
| project_service | チャット履歴・ユーザー回答 | LangGraphプロンプト構築・Gemini API呼び出し | ai_service / Gemini API |
| Gemini API | AI回答ストリーム (SSE) | フォーマット整形のうえ転送 | 利用者 |
| chat_service | 会話ログ | 永続化 | chat_histories (テーブル) |

- データ項目: `ChatInput`(project_id, message), `ChatOutput`(chunk_data, is_completed)

#### DF-02: POST /api/v1/projects/{id}/generate
| 元 | データ | 変換 | 先 |
|:---|:---|:---|:---|
| 利用者 | サマリ承認トリガー | 非同期タスクキューへの登録 | project_service |
| project_service | 承認済みサマリ・チャット履歴 | 要件定義書生成プロンプト構築 | ai_service / generator_graph |
| generator_graph | 要件定義書データ | 次工程への入力に変換し外部設計書生成 | generator_graph |
| generator_graph | 4種設計書テキスト・診断結果 | バージョン管理を考慮した保存処理 | documents (テーブル) |

- データ項目: `GenerateTrigger`(project_id), `DocumentBundle`(requirement, external_design, internal_design, implementation_plan, diagnostics)

---

## 3.4 例外処理・エラーハンドリング・ログ設計

### 3.1 共通エラーレスポンス形式
APIでエラーが発生した場合、以下の共通JSON形式でレスポンスを返却する。
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "AIの利用制限に達しました。しばらく経ってから再度お試しください。",
    "details": null
  }
}
```

### 3.2 例外検知・ログ出力方針
- **例外検知**: FastAPIのグローバル例外ハンドラー（`ExceptionMiddleware`）を用いて、未処理の例外を捕捉し、一律で500 Internal Server Errorとして処理・記録する。
- **外部AIエラー**: Gemini APIの無料枠超過（Rate Limit / Quota Exceeded）やネットワークエラーを検知した場合は、専用の例外クラスをスローし、ユーザー向けにHTTP 503 (Service Unavailable) および適切なエラーメッセージを返却する。
- **ログ出力方針**: Python標準の `logging` ライブラリ（構造化JSON出力）を使用し、タイムスタンプ、ログレベル、リクエストID、エラーメッセージ、スタックトレースを標準出力に出力する。Docker/VPS環境ではコンテナログとして一元収集する。