# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針

技術スタック選定およびアーキテクチャ方針

1. フロントエンド構成方針
Next.js (App Router) を採用し、サーバーコンポーネントによる初期レンダリング最適化とクライアントコンポーネントによる対話的UIを分離します。UIフレームワークにはTamaguiを採用し、マルチプラットフォームを見据えた軽量かつスタイル統合性の高いコンポーネント構成を実現します。

2. バックエンド構成方針
Python 3.13とFastAPIを採用し、非同期I/O処理による高速なレスポンスと自動OpenAPIドキュメント生成を活用します。AIエージェントおよび対話・文書生成ロジックにはLangChainおよびLangGraphを導入し、ヒアリング文脈の管理と4種設計書の直列・並列プロンプト生成ワークフローを状態遷移モデルとして制御します。

3. データストア・キャッシュ構成方針
永続化層にはPostgreSQLを採用し、ユーザー、プロジェクト、参考資料、メッセージ履歴、生成ドキュメント、診断結果を正規化して格納します。インメモリデータストアとしてRedisを導入し、JWTリフレッシュトークンの失効ブラックリスト管理、ログイン試行のブルートフォース保護、チャットおよび一括生成APIのレート制限（Sliding WindowまたはToken Bucketアルゴリズム）を担当させます。

4. インフラ・配置方針
VPS上にnginxをリバースプロキシとして配置し、SSL/TLS終端および静的ファイル配信・APIルーティングを行います。フロントエンド、バックエンド、PostgreSQL、RedisはDocker Composeにより独立したコンテナとして同一仮想ネットワーク内で管理し、GitHub Actions経由でmainブランチpush時にCI/CD自動デプロイを行います。

```text
+----------------------------------------------------------------------+
|                         Client (Browser)                             |
+-----------------------------------+----------------------------------+
                                    | HTTPS
+-----------------------------------v----------------------------------+
|                      Reverse Proxy (nginx:443)                       |
+-----------------+-----------------------------------+----------------+
                  | /                                 | /api/v1
+-----------------v-----------------+ +---------------v----------------+
| Frontend Container                | | Backend Container              |
| - Next.js 14+ (App Router)        | | - FastAPI (Python 3.13)        |
| - Tamagui                         | | - LangChain / LangGraph        |
+-----------------------------------+ +-------+--------------+---------+
                                              |              |   ^ (Gemini API)
                                 SQLAlchemy / |              |   | Google API
                                    asyncpg   v              v   v
                                      +-------+----+   +-----+---+
                                      | PostgreSQL |   |  Redis  |
                                      |    16+     |   |   7+    |
                                      +------------+   +---------+
```

## 3.2 データモデル定義

主要エンティティ一覧および関連構造

本システムでは、ユーザー単位でプロジェクトを完全に分離・隔離し、他ユーザーによるデータアクセスを厳格に遮断します。1つのプロジェクトは最大3件の参考資料（files）、チャット対話メッセージ履歴（messages）、および生成された4種のMarkdown設計書（documents）とそれぞれの自己診断結果（document_diagnoses）を従属エンティティとして保持します。

```text
+---------------+        1:N        +------------------+
|     users     |-------------------|     projects     |
+---------------+                   +------------------+
                                      | 1:N
       +--------------------+---------+---------+---------------------+
       |                    |                   |                     |
+------v-------+    +-------v------+    +-------v-------+     +-------v------------+
| project_files|    |   messages   |    |   documents   |1:N  | document_diagnoses |
+--------------+    +--------------+    +---------------+---->+--------------------+
```

### テーブル: users

システム利用者のアカウント情報および認証資格情報を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ユーザーID |
| email | VARCHAR(255) | NOT NULL, UNIQUE | ログイン用メールアドレス |
| hashed_password | VARCHAR(255) | NOT NULL | ハッシュ化パスワード (bcrypt等) |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | アカウント作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL | アカウント更新日時 |

### テーブル: projects

ユーザーが作成したヒアリングおよび設計書生成案件のメタデータを保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | プロジェクトID |
| user_id | UUID | NOT NULL, FK(users.id) | 所有ユーザーID |
| name | VARCHAR(100) | NOT NULL | プロジェクト名 |
| status | VARCHAR(20) | NOT NULL | 進行ステータス (hearing / generating / completed / failed) |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | プロジェクト作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL | プロジェクト更新日時 |

### テーブル: project_files

プロジェクトにアップロードされた参考資料のメタデータと抽出テキストを保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ファイルID |
| project_id | UUID | NOT NULL, FK(projects.id) | 紐付くプロジェクトID |
| file_name | VARCHAR(255) | NOT NULL | 元ファイル名 |
| file_type | VARCHAR(10) | NOT NULL | 拡張子・種別 (txt / md / pdf) |
| file_size | INTEGER | NOT NULL | ファイルサイズ (バイト) |
| extracted_text | TEXT | NOT NULL | 解析・抽出されたプレーンテキスト本文 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | ファイル登録日時 |

### テーブル: messages

プロジェクト内のヒアリング対話チャットの全発言履歴を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | メッセージID |
| project_id | UUID | NOT NULL, FK(projects.id) | 紐付くプロジェクトID |
| sender_type | VARCHAR(10) | NOT NULL | 発信者種別 (user / ai) |
| content | TEXT | NOT NULL | 対話メッセージ本文 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | メッセージ送信日時 |

### テーブル: documents

AIにより生成された4種のMarkdown設計書本文を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | ドキュメントID |
| project_id | UUID | NOT NULL, FK(projects.id) | 紐付くプロジェクトID |
| doc_type | VARCHAR(30) | NOT NULL | 設計書種別 (requirements / external_design / internal_design / implementation_plan) |
| content | TEXT | NOT NULL | 生成されたMarkdown本文 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | 設計書作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL | 設計書更新日時 |

### テーブル: document_diagnoses

生成された各設計書に対してAIが診断した3段階の不足点・改善提案を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK, NOT NULL | 診断結果ID |
| document_id | UUID | NOT NULL, FK(documents.id) | 対象ドキュメントID |
| project_id | UUID | NOT NULL, FK(projects.id) | 紐付くプロジェクトID |
| severity | VARCHAR(20) | NOT NULL | 重要度区分 (critical:最重要 / moderate:中程度 / minor:軽微) |
| content | TEXT | NOT NULL | 不足点および改善提案の指摘内容 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL | 診断結果作成日時 |

## 3.3 バックエンド処理・モジュール設計

主要処理ロジックの分割方針とディレクトリ構成

バックエンドはレイヤードアーキテクチャを採用し、プレゼンテーション層（API Routes）、ビジネスロジック層（Services / LLM Graph）、データアクセス層（Repositories / Models）、インフラ・共通処理（Core）に責務を分離します。
- ルーティング層 (app/api/): HTTPリクエストの受け付け、パラメータ検証、認証コンテキストの注入、レスポンス構築に限定。
- サービス層 (app/services/): 認可チェック、トランザクション制御、ビジネスユースケースの実装。
- AIワークフロー層 (app/llm/): LangChainおよびLangGraphを用いた状態グラフの定義、プロンプト構築、Gemini API呼び出し。
- データアクセス層 (app/repositories/): SQLAlchemyを用いたPostgreSQLとのクエリ発行。
- コア共通層 (app/core/): JWT生成・検証、Redisレートリミッター、共通例外ハンドラー、ログ定義。

```text
backend/
├── app/
│   ├── main.py                     # FastAPIアプリケーション初期化・ミドルウェア登録
│   ├── core/
│   │   ├── config.py               # 環境変数・設定管理
│   │   ├── security.py             # パスワードハッシュ・JWTトークン生成検証
│   │   ├── limiter.py              # Redisレート制限モジュール
│   │   ├── exceptions.py          # 共通例外定義
│   │   └── logger.py               # セキュアログ出力設定
│   ├── db/
│   │   ├── session.py              # 非同期DBセッション管理
│   │   └── models.py               # SQLAlchemy ORMモデル定義
│   ├── schemas/                    # Pydanticリクエスト/レスポンスモデル
│   ├── api/
│   │   ├── deps.py                 # 認証依存注入
│   │   ├── auth.py                 # 認証・認可エンドポイント
│   │   ├── projects.py             # プロジェクト管理エンドポイント
│   │   ├── files.py                # 参考資料アップロードエンドポイント
│   │   ├── messages.py             # チャット対話エンドポイント
│   │   └── documents.py            # 設計書生成・参照・DLエンドポイント
│   ├── services/
│   │   ├── auth_service.py         # 認証・登録・失効ロジック
│   │   ├── project_service.py      # プロジェクトCRUD制御
│   │   ├── file_service.py         # ファイル受取・テキスト抽出ロジック
│   │   ├── chat_service.py         # 対話履歴管理・AI応答呼び出し制御
│   │   └── document_service.py     # 4種設計書生成・診断オーケストレーション
│   └── llm/
│       ├── client.py               # Gemini Flash-Lite クライアント設定
│       ├── hearing_graph.py        # 対話ヒアリング用LangGraphステートグラフ
│       └── generator_graph.py      # 4種設計書一括生成・診断LangGraphパイプライン
```

### APIエンドポイント一覧

| メソッド | パス | 概要 |
|---|---|---|
| POST | /api/v1/auth/signup | 新規ユーザーのアカウント登録および初期トークン発行 |
| POST | /api/v1/auth/login | 資格情報検証によるログインおよびアクセストークン・Cookie発行 |
| POST | /api/v1/auth/refresh | Cookie内リフレッシュトークン検証によるアクセストークン再発行 |
| POST | /api/v1/auth/logout | リフレッシュトークン無効化とRedis失効登録によるログアウト |
| GET | /api/v1/projects | ログイン中ユーザーが所有するプロジェクト一覧の取得 |
| POST | /api/v1/projects | 新規プロジェクトの作成と初期状態の設定 |
| GET | /api/v1/projects/{id} | 指定プロジェクトのメタデータおよび詳細情報の取得 |
| POST | /api/v1/projects/{id}/files | 参考資料ファイル(txt/md/pdf)のアップロードとテキスト抽出・保存 |
| GET | /api/v1/projects/{id}/messages | プロジェクト内の対話チャット履歴一覧の取得 |
| POST | /api/v1/projects/{id}/messages | ユーザー発言の保存とGemini APIによるヒアリングAI応答の取得 |
| POST | /api/v1/projects/{id}/documents/generate | ヒアリング内容に基づく4種設計書の一括生成と3段階自己診断の実行 |
| GET | /api/v1/projects/{id}/documents | 生成済みの4種設計書Markdown本文および自己診断結果の取得 |
| GET | /api/v1/projects/{id}/documents/{doc_type}/download | 指定された設計書Markdownのファイルストリームダウンロード |

### モジュール一覧

| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| app/main.py | エントリーポイント | FastAPIアプリの構成、CORS設定、共通例外ハンドラーおよびルーターの登録を行う。 | app/api/*, app/core/exceptions.py, app/core/logger.py |
| app/core/security.py | コア/セキュリティ | bcryptによるパスワードのハッシュ化・照合およびJWTの生成・検証を行う。 | app/core/config.py |
| app/core/limiter.py | コア/セキュリティ | Redisと連携してログイン試行・チャット・設計書生成のレート制限判定とトークン失効管理を行う。 | app/core/config.py |
| app/api/auth.py | ルート | 認証関連HTTPリクエストの検証を行い、AuthServiceへ委譲してトークンを返却する。 | app/services/auth_service.py, app/core/limiter.py |
| app/services/auth_service.py | サービス | ユーザー登録、認証検証、JWT発行およびログアウト時のトークン無効化処理を行う。 | app/core/security.py, app/core/limiter.py, app/db/models.py |
| app/api/projects.py | ルート | プロジェクト一覧・作成・詳細取得のHTTPエンドポイントを公開する。 | app/services/project_service.py, app/api/deps.py |
| app/services/project_service.py | サービス | プロジェクトの作成・取得およびユーザー所有権限チェックを行う。 | app/db/models.py |
| app/api/files.py | ルート | マルチパート形式のファイルアップロードリクエストを受け付ける。 | app/services/file_service.py, app/api/deps.py |
| app/services/file_service.py | サービス | ファイル件数チェック(最大3件)、形式検証、テキスト抽出を行いDBに保存する。 | app/db/models.py, app/services/project_service.py |
| app/api/messages.py | ルート | チャット履歴取得およびメッセージ送信リクエストを受け付ける。 | app/services/chat_service.py, app/core/limiter.py, app/api/deps.py |
| app/services/chat_service.py | サービス | 入力バリデーション、ユーザー発言の保存、AI応答生成の呼び出し、応答保存を制御する。 | app/db/models.py, app/llm/hearing_graph.py, app/services/project_service.py |
| app/api/documents.py | ルート | 設計書一括生成、生成結果参照、ファイルダウンロードのリクエストを受け付ける。 | app/services/document_service.py, app/core/limiter.py, app/api/deps.py |
| app/services/document_service.py | サービス | 設計書一括生成ワークフローの実行、生成結果・自己診断の永続化、Markdownエクスポートを行う。 | app/db/models.py, app/llm/generator_graph.py, app/services/project_service.py |
| app/llm/hearing_graph.py | AIワークフロー | 参考資料と過去対話履歴を組み込んだプロンプトを構築しGemini APIを呼び出す。 | app/llm/client.py |
| app/llm/generator_graph.py | AIワークフロー | 要件定義・外部設計・内部設計・実装計画の4書面を順次/並列生成し不足点診断を実施する。 | app/llm/client.py |
| app/llm/client.py | 外部連携クライアント | Gemini Flash-Lite APIとの通信をLangChain ChatGoogleGenerativeAIを用いて確立する。 | app/core/config.py |
| app/db/models.py | モデル | PostgreSQLの全テーブルに対応するSQLAlchemy ORMエンティティを定義する。 | app/db/session.py |

### 処理別データフロー

#### DF-1: POST /api/v1/auth/signup

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | サインアップ入力情報 | リクエストボディ形式チェック | app/api/auth.py |
| app/api/auth.py | サインアップ入力情報 | 認証サービス呼び出し | app/services/auth_service.py |
| app/services/auth_service.py | ユーザーエンティティ | パスワードハッシュ化・重複検証 | users |
| app/services/auth_service.py | 認証トークン情報 | JWT・Cookie生成 | app/api/auth.py |
| app/api/auth.py | 認証トークン情報 | 201 Created レスポンス | 利用者 |

- データ項目: サインアップ入力情報(email, password)
- データ項目: ユーザーエンティティ(id, email, hashed_password, created_at, updated_at)
- データ項目: 認証トークン情報(access_token, token_type, refresh_token)

#### DF-2: POST /api/v1/auth/login

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | ログイン入力情報 | レート制限・試行回数確認 | app/api/auth.py |
| app/api/auth.py | ログイン入力情報 | 認証処理委譲 | app/services/auth_service.py |
| app/services/auth_service.py | ログイン入力情報 | メールアドレス検索 | users |
| users | ユーザーエンティティ | ハッシュ照合・トークン発行 | app/services/auth_service.py |
| app/services/auth_service.py | 認証トークン情報 | Cookie/JSONレスポンス構築 | app/api/auth.py |
| app/api/auth.py | 認証トークン情報 | 200 OK レスポンス | 利用者 |

- データ項目: ログイン入力情報(email, password)
- データ項目: ユーザーエンティティ(id, email, hashed_password, created_at, updated_at)
- データ項目: 認証トークン情報(access_token, token_type, refresh_token)

#### DF-3: POST /api/v1/auth/refresh

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | リフレッシュリクエスト | HttpOnly Cookie抽出 | app/api/auth.py |
| app/api/auth.py | リフレッシュリクエスト | トークン検証委譲 | app/services/auth_service.py |
| app/services/auth_service.py | 認証トークン情報 | 署名検証・新規アクセストークン生成 | app/api/auth.py |
| app/api/auth.py | 認証トークン情報 | 200 OK レスポンス | 利用者 |

- データ項目: リフレッシュリクエスト(refresh_token)
- データ項目: 認証トークン情報(access_token, token_type)

#### DF-4: POST /api/v1/auth/logout

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | ログアウトリクエスト | 認証情報抽出 | app/api/auth.py |
| app/api/auth.py | ログアウトリクエスト | 失効処理委譲 | app/services/auth_service.py |
| app/services/auth_service.py | ログアウトリクエスト | Cookie消去レスポンス | app/api/auth.py |
| app/api/auth.py | 共通成功メッセージ | 200 OK レスポンス | 利用者 |

- データ項目: ログアウトリクエスト(refresh_token, user_id)
- データ項目: 共通成功メッセージ(message)

#### DF-5: GET /api/v1/projects

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 認証ヘッダー | JWT検証・ユーザーID抽出 | app/api/projects.py |
| app/api/projects.py | ユーザー識別子 | 一覧取得指示 | app/services/project_service.py |
| app/services/project_service.py | ユーザー識別子 | ユーザー所有プロジェクト検索 | projects |
| projects | プロジェクトエンティティ一覧 | 検索結果返却 | app/services/project_service.py |
| app/services/project_service.py | プロジェクトエンティティ一覧 | レスポンスDTO変換 | app/api/projects.py |
| app/api/projects.py | プロジェクトエンティティ一覧 | 200 OK レスポンス | 利用者 |

- データ項目: 認証ヘッダー(Authorization)
- データ項目: ユーザー識別子(user_id)
- データ項目: プロジェクトエンティティ一覧(id, name, status, created_at, updated_at)

#### DF-6: POST /api/v1/projects

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | プロジェクト作成入力 | 認証検証・バリデーション | app/api/projects.py |
| app/api/projects.py | プロジェクト作成入力 | 作成処理委譲 | app/services/project_service.py |
| app/services/project_service.py | プロジェクトエンティティ | 新規レコード作成 | projects |
| projects | プロジェクトエンティティ | 作成レコード返却 | app/services/project_service.py |
| app/services/project_service.py | プロジェクトエンティティ | DTO変換 | app/api/projects.py |
| app/api/projects.py | プロジェクトエンティティ | 201 Created レスポンス | 利用者 |

- データ項目: プロジェクト作成入力(user_id, name)
- データ項目: プロジェクトエンティティ(id, user_id, name, status, created_at, updated_at)

#### DF-7: GET /api/v1/projects/{id}

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | プロジェクト参照識別子 | 認証・権限検証 | app/api/projects.py |
| app/api/projects.py | プロジェクト参照識別子 | 詳細取得委譲 | app/services/project_service.py |
| app/services/project_service.py | プロジェクト参照識別子 | 所有権確認クエリ | projects |
| projects | プロジェクトエンティティ | レコード返却 | app/services/project_service.py |
| app/services/project_service.py | プロジェクトエンティティ | 詳細DTO返却 | app/api/projects.py |
| app/api/projects.py | プロジェクトエンティティ | 200 OK レスポンス | 利用者 |

- データ項目: プロジェクト参照識別子(project_id, user_id)
- データ項目: プロジェクトエンティティ(id, user_id, name, status, created_at, updated_at)

#### DF-8: POST /api/v1/projects/{id}/files

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | ファイルアップロード入力 | マルチパート形式検証 | app/api/files.py |
| app/api/files.py | ファイルアップロード入力 | ファイル処理委譲 | app/services/file_service.py |
| app/services/file_service.py | プロジェクト参照識別子 | 既存件数チェック(最大3件) | project_files |
| app/services/file_service.py | プロジェクトファイルエンティティ | テキスト抽出後レコード登録 | project_files |
| project_files | プロジェクトファイルエンティティ | 登録レコード返却 | app/services/file_service.py |
| app/services/file_service.py | プロジェクトファイルエンティティ | DTO変換 | app/api/files.py |
| app/api/files.py | プロジェクトファイルエンティティ | 201 Created レスポンス | 利用者 |

- データ項目: ファイルアップロード入力(project_id, filename, content_type, bytes)
- データ項目: プロジェクト参照識別子(project_id, user_id)
- データ項目: プロジェクトファイルエンティティ(id, project_id, file_name, file_type, file_size, extracted_text, created_at)

#### DF-9: GET /api/v1/projects/{id}/messages

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | プロジェクト参照識別子 | 認証・権限検証 | app/api/messages.py |
| app/api/messages.py | プロジェクト参照識別子 | メッセージ取得委譲 | app/services/chat_service.py |
| app/services/chat_service.py | プロジェクト参照識別子 | 履歴検索クエリ | messages |
| messages | メッセージ履歴一覧 | 時系列データ返却 | app/services/chat_service.py |
| app/services/chat_service.py | メッセージ履歴一覧 | 一覧DTO変換 | app/api/messages.py |
| app/api/messages.py | メッセージ履歴一覧 | 200 OK レスポンス | 利用者 |

- データ項目: プロジェクト参照識別子(project_id, user_id)
- データ項目: メッセージ履歴一覧(id, project_id, sender_type, content, created_at)

#### DF-10: POST /api/v1/projects/{id}/messages

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | チャット送信入力 | 文字数制限(1-4000字)・空送信検証 | app/api/messages.py |
| app/api/messages.py | チャット送信入力 | 対話処理委譲 | app/services/chat_service.py |
| app/services/chat_service.py | プロジェクト参照識別子 | 参考資料取得 | project_files |
| project_files | 参考資料コンテキスト | 資料テキスト返却 | app/services/chat_service.py |
| app/services/chat_service.py | プロジェクト参照識別子 | 対話履歴取得 | messages |
| messages | メッセージ履歴一覧 | 過去履歴返却 | app/services/chat_service.py |
| app/services/chat_service.py | AIプロンプト要求 | ヒアリング対話プロンプト構成 | app/llm/hearing_graph.py |
| app/llm/hearing_graph.py | AIプロンプト要求 | Gemini API呼出 | Google Gemini API (Gemini Flash-Lite) |
| Google Gemini API (Gemini Flash-Lite) | AI応答生成結果 | テキスト応答取得 | app/llm/hearing_graph.py |
| app/llm/hearing_graph.py | AI応答生成結果 | AI応答データ返却 | app/services/chat_service.py |
| app/services/chat_service.py | 保存用メッセージ対 | ユーザー発言およびAI発言保存 | messages |
| app/services/chat_service.py | メッセージエンティティ | 応答DTO返却 | app/api/messages.py |
| app/api/messages.py | メッセージエンティティ | 200 OK レスポンス | 利用者 |

- データ項目: チャット送信入力(project_id, user_id, content)
- データ項目: プロジェクト参照識別子(project_id, user_id)
- データ項目: 参考資料コンテキスト(file_name, extracted_text)
- データ項目: メッセージ履歴一覧(sender_type, content, created_at)
- データ項目: AIプロンプト要求(system_prompt, reference_docs, history, user_input)
- データ項目: AI応答生成結果(ai_content)
- データ項目: 保存用メッセージ対(user_message, ai_message)
- データ項目: メッセージエンティティ(id, project_id, sender_type, content, created_at)

#### DF-11: POST /api/v1/projects/{id}/documents/generate

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | プロジェクト参照識別子 | 一括生成リクエスト検証・レート制限確認 | app/api/documents.py |
| app/api/documents.py | プロジェクト参照識別子 | 生成ワークフロー委譲 | app/services/document_service.py |
| app/services/document_service.py | プロジェクト状態更新 | statusをgeneratingに変更 | projects |
| app/services/document_service.py | プロジェクト参照識別子 | 全チャット履歴と参考資料を取得 | messages |
| messages | メッセージ履歴一覧 | 履歴データ返却 | app/services/document_service.py |
| app/services/document_service.py | 生成パイプライン入力 | LangGraphステートグラフ実行 | app/llm/generator_graph.py |
| app/llm/generator_graph.py | 生成プロンプト要求 | Gemini APIによる4文書生成・自己診断 | Google Gemini API (Gemini Flash-Lite) |
| Google Gemini API (Gemini Flash-Lite) | 4種設計書生成・診断出力 | Markdown本文および診断JSON返却 | app/llm/generator_graph.py |
| app/llm/generator_graph.py | 4種設計書生成・診断出力 | 生成結果統合 | app/services/document_service.py |
| app/services/document_service.py | 設計書エンティティ群 | 4種設計書Markdown保存 | documents |
| app/services/document_service.py | 診断結果エンティティ群 | 3段階不足点保存 | document_diagnoses |
| app/services/document_service.py | プロジェクト状態更新 | statusをcompletedに変更 | projects |
| app/services/document_service.py | 設計書・診断レスポンス情報 | 結果レスポンス返却 | app/api/documents.py |
| app/api/documents.py | 設計書・診断レスポンス情報 | 200 OK レスポンス | 利用者 |

- データ項目: プロジェクト参照識別子(project_id, user_id)
- データ項目: プロジェクト状態更新(status, updated_at)
- データ項目: メッセージ履歴一覧(sender_type, content)
- データ項目: 生成パイプライン入力(project_id, history, files)
- データ項目: 生成プロンプト要求(doc_types, hearing_summary)
- データ項目: 4種設計書生成・診断出力(requirements_md, external_design_md, internal_design_md, implementation_plan_md, diagnoses)
- データ項目: 設計書エンティティ群(project_id, doc_type, content)
- データ項目: 診断結果エンティティ群(document_id, project_id, severity, content)
- データ項目: 設計書・診断レスポンス情報(documents, diagnoses)

#### DF-12: GET /api/v1/projects/{id}/documents

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | プロジェクト参照識別子 | 認証・権限検証 | app/api/documents.py |
| app/api/documents.py | プロジェクト参照識別子 | 設計書取得委譲 | app/services/document_service.py |
| app/services/document_service.py | プロジェクト参照識別子 | 設計書検索 | documents |
| documents | 設計書エンティティ群 | Markdown本文取得 | app/services/document_service.py |
| app/services/document_service.py | プロジェクト参照識別子 | 診断結果検索 | document_diagnoses |
| document_diagnoses | 診断結果エンティティ群 | 診断一覧取得 | app/services/document_service.py |
| app/services/document_service.py | 設計書・診断レスポンス情報 | レスポンス統合 | app/api/documents.py |
| app/api/documents.py | 設計書・診断レスポンス情報 | 200 OK レスポンス | 利用者 |

- データ項目: プロジェクト参照識別子(project_id, user_id)
- データ項目: 設計書エンティティ群(id, doc_type, content, updated_at)
- データ項目: 診断結果エンティティ群(id, document_id, severity, content)
- データ項目: 設計書・診断レスポンス情報(documents, diagnoses)

#### DF-13: GET /api/v1/projects/{id}/documents/{doc_type}/download

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 設計書DL指定情報 | 種別検証・認証検証 | app/api/documents.py |
| app/api/documents.py | 設計書DL指定情報 | ファイルエクスポート委譲 | app/services/document_service.py |
| app/services/document_service.py | 設計書DL指定情報 | 単一ドキュメント検索 | documents |
| documents | 単一設計書エンティティ | Markdown本文取得 | app/services/document_service.py |
| app/services/document_service.py | 単一設計書エンティティ | ファイル名およびストリーム準備 | app/api/documents.py |
| app/api/documents.py | Markdownファイルダウンロード形式 | 200 OK Attachmentストリーム | 利用者 |

- データ項目: 設計書DL指定情報(project_id, doc_type, user_id)
- データ項目: 単一設計書エンティティ(id, doc_type, content)
- データ項目: Markdownファイルダウンロード形式(filename, content_type, content_disposition, body)

## 3.4 例外処理・エラーハンドリング・ログ設計

例外処理・エラーハンドリング・ログ設計方針

1. 共通エラーレスポンス形式
すべてのAPIエラーは、クライアントが画一的にハンドリングできるよう以下の統一JSONスキーマで返却します。

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "指定されたプロジェクトが存在しないか、アクセス権限がありません。",
    "details": []
  }
}
```

主要エラーコードとHTTPステータスの対応一覧:
- `INVALID_REQUEST_PAYLOAD` (400): バリデーションエラー（文字数超過、空文字、不正な拡張子等）
- `UNAUTHORIZED` (401): JWT欠落、期限切れ、改ざん
- `FORBIDDEN` (403): 他ユーザーが所有するプロジェクトへのアクセス試行
- `NOT_FOUND` (404): 対象リソースの不在
- `CONFLICT` (409): メールアドレスの重複、設計書一括生成処理の多重実行
- `RATE_LIMIT_EXCEEDED` (429): 短時間での過剰なリクエスト、ブルートフォース試行
- `LLM_INTEGRATION_ERROR` (502): Gemini APIの上限超過(429/503)または応答フォーマット異常
- `INTERNAL_SERVER_ERROR` (500): 予期しないサーバー内部例外

2. セキュアログ出力方針 (NFR-007準拠)
機密性保持およびプライバシー保護のため、利用者が入力したチャット本文、アップロードされた参考資料のテキスト本文、生成された設計書の内容、パスワード等の資格情報はログに一切出力しません。
ログ出力対象は以下のメタ情報のみに限定します。
- 発生日時 (ISO 8601 UTC)
- ログレベル (INFO / WARNING / ERROR)
- エンドポイント (HTTPメソッドおよびパス)
- レスポンスHTTPステータスコード
- エラーコード (エラー発生時のみ)
- 処理所要時間 (ミリ秒)

ログ出力例:
```text
2025-05-10T12:00:00Z [ERROR] POST /api/v1/projects/550e8400-e29b-41d4-a716-446655440000/messages status=502 error_code=LLM_INTEGRATION_ERROR duration=3210ms
```

3. 例外検知・再試行方針
Gemini APIとの通信エラー時は、チャットメッセージをDBに永続化せずロールバックし、フロントエンドに分かりやすい失敗理由と再送プロンプトを返却します。設計書一括生成中の障害発生時は、プロジェクトステータスを`failed`に更新し、プレビュー画面からの安全な再生成（リトライ）を可能とします。
