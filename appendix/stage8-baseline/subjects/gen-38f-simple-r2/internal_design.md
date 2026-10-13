# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針

技術スタックおよびシステム構成の選定方針は以下の通りです。

1. フロントエンド (Next.js App Router + Tamagui):
React 19 / Next.js (App Router) を採用し、サーバーコンポーネントによる初期レンダリング高速化とクライアントサイドでの動的対話UI（ストリーミングチャットおよびタブ切替プレビュー）を両立します。UIコンポーネントライブラリにはTamaguiを採用し、洗練されたスタイルとレスポンシブ表示（PCブラウザおよびスマートフォン閲覧対応）を軽量なランタイムオーバーヘッドで実現します。

2. バックエンド (Python 3.13 + FastAPI + LangChain / LangGraph):
最新のPython 3.13の非同期I/O機能を活用し、FastAPIにより高速かつ型安全なREST APIおよびServer-Sent Events (SSE) によるストリーミングエンドポイントを構築します。AIオーケストレーションにはLangChainおよびLangGraphを採用し、ヒアリング対話ステートの管理、参考資料コンテキストの注入、および4種の設計書（要件定義書・外部設計書・内部設計書・実装計画書）の一括生成と自己診断ロジックを宣言的なパイプライングラフとして設計・実行します。

3. データベースおよびキャッシュ (PostgreSQL + Redis):
永続化層としてリレーショナルデータベースであるPostgreSQLを採用し、ユーザー、プロジェクト、参考資料テキスト、チャット履歴、生成設計書データを厳格な外部キー制約とトランザクション管理下で保持します。インメモリキャッシュ層としてRedisを採用し、スライディングウィンドウ方式によるAPIレート制限制御（ログイン・登録試行、チャット発話、設計書生成）およびリフレッシュトークンの失効リスト（ブラックリスト）管理を高速に行います。

4. インフラストラクチャ (Docker Compose + nginx + VPS + GitHub Actions):
VPS環境上にDocker Composeを展開し、フロントエンド、FastAPIバックエンド、PostgreSQL、Redis、nginxリバースプロキシのコンテナ群を一体管理します。nginxがSSL終端、静的ファイル配信キャッシュ、タイムアウト管理（LLM通信に対応した長時間タイムアウト設定）を担います。GitHub Actionsによりmainブランチへのプッシュを契機として自動テストおよびVPSへのデプロイパイプラインを実行します。

```text
+-------------------------------------------------------------------------+
| クライアント層 (Next.js / Tamagui)                                       |
| - 認証・セッション管理 (Cookie / Bearer Token)                           |
| - チャット対話 (SSE受信) / Markdownプレビュー・DL                        |
+------------------------------------+------------------------------------+
                                     | HTTPS / WSS
+------------------------------------v------------------------------------+
| リバースプロキシ層 (nginx)                                               |
| - SSL/TLS終端 / リバースプロキシ / バッファ制御                         |
+------------------------------------+------------------------------------+
                                     | リバースプロキシ (HTTP:8000)
+------------------------------------v------------------------------------+
| バックエンドアプリケーション層 (FastAPI / Python 3.13)                  |
| - レート制限ミドルウェア (Redis連携)                                     |
| - 認証・認可 (JWT検証 / HttpOnly Cookie制御)                             |
| - サービス層・リポジトリ層                                               |
| - LangGraph エージェントパイプライン                                     |
+-----------------+-------------------+-------------------+---------------+
                  |                   |                   | HTTPS (API Key)
+-----------------v-+ +---------------v-+ +-----------------v-+ +-----------v---+
| PostgreSQL        | | Redis           | | ローカルストレージ | | Gemini API    |
| (永続化データ)     | | (レート制限/    | | (一時添付ファイル) | | (Flash-Lite)  |
|                   | |  トークン管理)  | |                   | |               |
+-------------------+ +-----------------+ +-------------------+ +---------------+
```

## 3.2 データモデル定義

データモデルは、ユーザー管理、プロジェクト管理、参考資料、対話履歴、および生成された設計書群を中心とするエンティティから構成されます。

- users: アプリケーションの認証主体。メールアドレスとハッシュ化パスワードを保持します。
- refresh_tokens: JWTリフレッシュトークンの管理テーブル。失効日時や無効化ステータスを保持します。
- projects: ユーザーが作成した設計書生成単位。ユーザーに紐づき、他のユーザーからは隔離されます。
- project_files: プロジェクトにアップロードされた参考資料のメタデータおよび抽出テキスト（最大3件）。
- messages: ヒアリング対話チャットのメッセージ（ユーザー発言およびAI発言）。
- specifications: プロジェクトごとに一括生成される4種の設計書Markdown本文およびAI自己診断結果JSON。

```text
+---------------+       1:N       +------------------+
|     users     |----------------<|  refresh_tokens  |
+---------------+                 +------------------+
        | 1
        |
        | 1:N
        v
+---------------+       1:N       +------------------+
|   projects    |----------------<|  project_files   |
+---------------+                 +------------------+
        | 1             1:N       +------------------+
        |------------------------<|     messages     |
        |
        | 1:1                     +------------------+
        +------------------------<|  specifications  |
                                  +------------------+
```

### テーブル: users

ユーザーアカウント情報を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | ユーザー固有識別子 |
| email | VARCHAR(255) | NOT NULL UNIQUE | ログイン用メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | ハッシュ化されたパスワード文字列 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | アカウント登録日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | アカウント情報更新日時 |

### テーブル: refresh_tokens

JWTリフレッシュトークンおよびセッション状態を管理するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | トークンレコード識別子 |
| user_id | UUID | NOT NULL REFERENCES users(id) ON DELETE CASCADE | トークンを所有するユーザーID |
| token_hash | VARCHAR(255) | NOT NULL UNIQUE | リフレッシュトークン文字列のハッシュ値 |
| expires_at | TIMESTAMP WITH TIME ZONE | NOT NULL | トークンの有効期限日時（発行から14日後） |
| revoked_at | TIMESTAMP WITH TIME ZONE | NULL | トークン無効化日時（ログアウト時等に設定） |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | トークン発行日時 |

### テーブル: projects

設計書作成プロジェクトのメタデータを保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | プロジェクト固有識別子 |
| user_id | UUID | NOT NULL REFERENCES users(id) ON DELETE CASCADE | 作成者ユーザーID |
| name | VARCHAR(100) | NOT NULL | プロジェクト名 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | プロジェクト作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | プロジェクト更新日時 |

### テーブル: project_files

プロジェクトにアップロードされた参考資料のメタデータと抽出テキストを保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | 参考資料ファイル識別子 |
| project_id | UUID | NOT NULL REFERENCES projects(id) ON DELETE CASCADE | 紐づくプロジェクトID |
| file_name | VARCHAR(255) | NOT NULL | アップロードされた元のファイル名 |
| file_type | VARCHAR(50) | NOT NULL | MIMEタイプまたは拡張子識別（txt, md, pdf） |
| file_size | INTEGER | NOT NULL | ファイルサイズ（バイト） |
| content_text | TEXT | NOT NULL | 抽出・解析されたテキスト本文 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | アップロード登録日時 |

### テーブル: messages

プロジェクト内のヒアリングチャット対話メッセージを保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | メッセージ識別子 |
| project_id | UUID | NOT NULL REFERENCES projects(id) ON DELETE CASCADE | 紐づくプロジェクトID |
| role | VARCHAR(20) | NOT NULL | 発話主体（user または assistant） |
| content | TEXT | NOT NULL | メッセージ本文 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | 発話日時 |

### テーブル: specifications

AIによって一括生成された4種のMarkdown設計書および自己診断結果を保持するテーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() | 設計書レコード識別子 |
| project_id | UUID | NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE | 紐づくプロジェクトID（1対1関係） |
| requirements_doc | TEXT | NOT NULL | 要件定義書のMarkdownテキスト |
| external_design_doc | TEXT | NOT NULL | 外部設計書のMarkdownテキスト |
| internal_design_doc | TEXT | NOT NULL | 内部設計書のMarkdownテキスト |
| implementation_plan_doc | TEXT | NOT NULL | 実装計画書のMarkdownテキスト |
| diagnosis_data | JSONB | NOT NULL | 3段階（最重要・中程度・軽微）のAI自己診断結果JSON |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | 設計書初回生成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | 設計書再生成・更新日時 |

## 3.3 バックエンド処理・モジュール設計

バックエンドはレイヤードアーキテクチャ（API層・ミドルウェア層・サービス層・AIオーケストレーション層・リポジトリ層・モデル層）を採用し、関心の分離とテスト容易性を確保します。

1. API層 (app/api):
ルーティング、HTTPリクエストの検証（Pydantic）、クエリ/パスパラメータの抽出、HTTPレスポンスへの整形、およびSSEストリーミング応答の送出を担います。

2. サービス層 (app/services):
ビジネスロジックの中核を担います。権限チェック（プロジェクト所有者かどうかの検証）、ファイルの抽出・バリデーション処理、AIオーケストレーションの呼び出し、トランザクション制御を実施します。

3. AIオーケストレーション層 (app/llm):
LangChainおよびLangGraphを用いてGemini Flash-Liteとの通信を抽象化・制御します。プロンプトテンプレートの管理、コンテキスト（対話履歴＋参考資料テキスト）の組み立て、ストリーミングレスポンスの生成パイプライン、4種の設計書一括生成グラフ、自己診断評価グラフをカプセル化します。

4. ミドルウェア層 (app/middleware):
Redisを利用したスライディングウィンドウ型レート制限、およびJWT認証検証とコンテキストへのユーザー情報注入を担います。

5. リポジトリ・データアクセス層 (app/repositories):
SQLAlchemy 2.0を用いたデータベース操作（CRUD、フィルタリング）を担い、SQLロジックをサービス層から隠蔽します。

```text
backend/
├── app/
│   ├── main.py                     # FastAPIエントリーポイント・ライフスパン設定
│   ├── config.py                   # 環境変数設定（Gemini API Key, DB接続文字列等）
│   ├── middleware/
│   │   ├── auth.py                 # JWT検証ミドルウェア / 依存性注入
│   │   └── rate_limit.py           # Redisによるレート制限ミドルウェア
│   ├── api/
│   │   ├── auth.py                 # 認証APIルーター (/auth/*)
│   │   ├── projects.py             # プロジェクト管理APIルーター (/projects)
│   │   ├── files.py                # 参考資料APIルーター (/projects/{id}/files)
│   │   ├── messages.py             # チャットAPIルーター (/projects/{id}/messages)
│   │   └── specifications.py       # 設計書生成・DLルーター (/projects/{id}/specifications/*)
│   ├── services/
│   │   ├── auth_service.py         # 認証・トークン発行・失効サービス
│   │   ├── project_service.py      # プロジェクト管理サービス
│   │   ├── file_service.py         # ファイル抽出・検証サービス
│   │   ├── chat_service.py         # チャット対話・履歴制御サービス
│   │   └── spec_generator_service.py# 設計書生成・ZIPアーカイブサービス
│   ├── llm/
│   │   ├── client.py               # Google Gemini APIクライアント初期化
│   │   ├── prompts.py              # ヒアリング・4種設計書・自己診断用プロンプト
│   │   └── graphs.py               # LangGraphステートグラフ（生成・診断パイプライン）
│   ├── repositories/
│   │   └── *.py                    # 各エンティティ用リポジトリ
│   └── models/
│       └── *.py                    # SQLAlchemy ORMモデルおよびPydanticスキーマ
```

### APIエンドポイント一覧

| メソッド | パス | 概要 |
|---|---|---|
| POST | /api/v1/auth/register | 新規アカウント登録（メール・パスワード検証、ユーザー保存、JWTトークン発行およびCookie設定） |
| POST | /api/v1/auth/login | ログイン認証（資格情報検証、アクセストークン発行およびリフレッシュトークンのHttpOnly Cookie設定） |
| POST | /api/v1/auth/refresh | リフレッシュトークンによるアクセストークン再発行 |
| POST | /api/v1/auth/logout | ログアウト処理（リフレッシュトークン無効化およびCookie削除） |
| GET | /api/v1/projects | ログインユーザーが所有するプロジェクト一覧の取得 |
| POST | /api/v1/projects | 新規プロジェクトの作成 |
| GET | /api/v1/projects/{id} | 指定プロジェクトの詳細情報および添付ファイル一覧の取得 |
| POST | /api/v1/projects/{id}/files | 参考資料ファイル（txt, md, pdf）のアップロード、テキスト抽出および保存 |
| GET | /api/v1/projects/{id}/messages | プロジェクト内のヒアリングチャット対話履歴の取得 |
| POST | /api/v1/projects/{id}/messages | チャットメッセージ送信およびGeminiによるAI応答のストリーミング配信（SSE） |
| POST | /api/v1/projects/{id}/specifications/generate | ヒアリング履歴と参考資料に基づく4種のMarkdown設計書の一括生成およびAI自己診断の実行・保存 |
| GET | /api/v1/projects/{id}/specifications | 生成済みの4種Markdown設計書および自己診断結果の取得 |
| GET | /api/v1/projects/{id}/specifications/download | 個別Markdownファイルまたは一括ZIPアーカイブのストリーミングダウンロード |

### モジュール一覧

| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| app/api/auth.py | API層 | 認証関連エンドポイント（登録、ログイン、トークン更新、ログアウト）のリクエスト受付とCookie制御を行う。 | app/services/auth_service.py, app/middleware/rate_limit.py |
| app/api/projects.py | API層 | プロジェクト一覧取得、新規作成、詳細取得のHTTPハンドリングを行う。 | app/services/project_service.py, app/middleware/auth.py |
| app/api/files.py | API層 | 参考資料ファイルのマルチパートアップロード受付とバリデーションを制御する。 | app/services/file_service.py, app/middleware/auth.py |
| app/api/messages.py | API層 | ヒアリングチャット履歴の取得、およびメッセージ送信に伴うSSEストリーミング応答を制御する。 | app/services/chat_service.py, app/middleware/auth.py, app/middleware/rate_limit.py |
| app/api/specifications.py | API層 | 設計書一括生成のキック、生成済み設計書の取得、ファイルダウンロードレスポンスを制御する。 | app/services/spec_generator_service.py, app/middleware/auth.py, app/middleware/rate_limit.py |
| app/services/auth_service.py | サービス層 | ユーザー登録、パスワード照合、JWTトークン生成・検証およびRedis/DBを用いたトークン無効化を処理する。 | app/repositories/*.py, bcrypt, PyJWT |
| app/services/project_service.py | サービス層 | プロジェクトの作成、所有者権限の検証、一覧および詳細情報の取得ビジネスロジックを管理する。 | app/repositories/*.py |
| app/services/file_service.py | サービス層 | 参考資料（txt, md, pdf）の形式・件数・容量検証、テキスト抽出、および保存を処理する。 | app/repositories/*.py, pypdf |
| app/services/chat_service.py | サービス層 | 入力文字数検証、ユーザー発言の保存、LLMオーケストレーションへのストリーミング委譲、およびAI応答の完了後保存を行う。 | app/repositories/*.py, app/llm/client.py |
| app/services/spec_generator_service.py | サービス層 | LangGraphを利用した4種の設計書一括生成・自己診断の統制、DBへの格納、およびZIP圧縮アーカイブの生成を処理する。 | app/repositories/*.py, app/llm/graphs.py |
| app/llm/client.py | AIオーケストレーション層 | Google Gemini APIクライアントを初期化し、ストリーミング対話およびエラーハンドリングを行う。 | langchain-google-genai |
| app/llm/graphs.py | AIオーケストレーション層 | LangGraphを用いて要件定義書、外部設計書、内部設計書、実装計画書の一括生成と3段階自己診断のステート遷移グラフを定義・実行する。 | app/llm/client.py, langgraph |
| app/middleware/rate_limit.py | ミドルウェア層 | Redisを用いてIPおよびユーザー単位でのアクセス頻度を監視し、スライディングウィンドウ方式でレート制限を執行する。 | redis |
| app/middleware/auth.py | ミドルウェア層 | HTTPリクエストのAuthorizationヘッダーに含まれるJWTアクセストークンを検証し、ユーザーコンテキストをFastAPI依存性として注入する。 | PyJWT |
| app/repositories/*.py | リポジトリ層 | PostgreSQLに対するSQLAlchemyを用いた各テーブル（ユーザー、プロジェクト、ファイル、対話、設計書）のデータアクセス処理を提供する。 | app/models/*.py, SQLAlchemy |
| app/models/*.py | モデル層 | PostgreSQLテーブルに対応するSQLAlchemy ORMエンティティ定義およびAPI送受信用Pydanticスキーマを定義する。 | SQLAlchemy, pydantic |

### 処理別データフロー

#### DF-1: POST /api/v1/auth/register

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 新規登録リクエスト (email, password) | — | app/api/auth.py |
| app/api/auth.py | 登録パラメータ | 入力形式バリデーション | app/services/auth_service.py |
| app/services/auth_service.py | メール重複チェック問い合わせ | — | users |
| app/services/auth_service.py | 新規ユーザーレコード | パスワードハッシュ化 (bcrypt) | users |
| app/services/auth_service.py | リフレッシュトークンレコード | トークンハッシュ計算 | refresh_tokens |
| app/services/auth_service.py | JWTアクセストークン・Cookie設定 | JWT署名生成 | app/api/auth.py |
| app/api/auth.py | 登録成功レスポンス (201 Created + Cookie) | — | 利用者 |

- データ項目: 新規登録リクエスト(email, password)
- データ項目: 新規ユーザーレコード(id, email, password_hash, created_at, updated_at)
- データ項目: リフレッシュトークンレコード(id, user_id, token_hash, expires_at, created_at)
- データ項目: 認証成功情報(access_token, user)

#### DF-2: POST /api/v1/auth/login

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | ログインリクエスト (email, password) | — | app/api/auth.py |
| app/api/auth.py | レート制限確認 | IPキーでの試行回数確認 | app/middleware/rate_limit.py |
| app/api/auth.py | ログイン資格情報 | — | app/services/auth_service.py |
| app/services/auth_service.py | ユーザー取得クエリ | — | users |
| users | ユーザーレコード | — | app/services/auth_service.py |
| app/services/auth_service.py | リフレッシュトークン保存 | パスワード検証成功・トークンハッシュ化 | refresh_tokens |
| app/services/auth_service.py | アクセストークンおよびCookie情報 | JWT署名生成 | app/api/auth.py |
| app/api/auth.py | ログイン成功レスポンス (200 OK + Cookie) | — | 利用者 |

- データ項目: ログインリクエスト(email, password)
- データ項目: ユーザーレコード(id, email, password_hash)
- データ項目: リフレッシュトークンレコード(id, user_id, token_hash, expires_at, created_at)
- データ項目: 認証成功情報(access_token, user)

#### DF-3: POST /api/v1/auth/refresh

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | トークン再発行リクエスト (Cookie: refresh_token) | — | app/api/auth.py |
| app/api/auth.py | Cookie取得トークン文字列 | — | app/services/auth_service.py |
| app/services/auth_service.py | トークン検証クエリ | トークンハッシュ計算 | refresh_tokens |
| refresh_tokens | 有効なトークンレコード | — | app/services/auth_service.py |
| app/services/auth_service.py | 新規アクセストークン | JWT署名生成 | app/api/auth.py |
| app/api/auth.py | 再発行レスポンス (200 OK) | — | 利用者 |

- データ項目: トークン再発行リクエスト(refresh_token_cookie)
- データ項目: トークンレコード(id, user_id, token_hash, expires_at, revoked_at)
- データ項目: 新規トークン情報(access_token)

#### DF-4: POST /api/v1/auth/logout

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | ログアウトリクエスト (Cookie: refresh_token) | — | app/api/auth.py |
| app/api/auth.py | トークン文字列 | — | app/services/auth_service.py |
| app/services/auth_service.py | トークン無効化更新 (revoked_at設定) | トークンハッシュ計算 | refresh_tokens |
| app/services/auth_service.py | 無効化完了通知 | — | app/api/auth.py |
| app/api/auth.py | ログアウト成功レスポンス (Cookie削除) | — | 利用者 |

- データ項目: ログアウトリクエスト(refresh_token_cookie)
- データ項目: トークン無効化更新(revoked_at)

#### DF-5: GET /api/v1/projects

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | プロジェクト一覧取得リクエスト (Bearerトークン) | — | app/api/projects.py |
| app/api/projects.py | トークン検証 | JWTデコード・ユーザーID抽出 | app/middleware/auth.py |
| app/api/projects.py | ログインユーザーID | — | app/services/project_service.py |
| app/services/project_service.py | 所有プロジェクト検索クエリ (user_id一致) | — | projects |
| projects | プロジェクトレコード一覧 | — | app/services/project_service.py |
| app/services/project_service.py | プロジェクト一覧DTO | — | app/api/projects.py |
| app/api/projects.py | 一覧JSONレスポンス (200 OK) | — | 利用者 |

- データ項目: プロジェクト一覧取得リクエスト(authorization_header)
- データ項目: プロジェクトレコード一覧(id, user_id, name, created_at, updated_at)

#### DF-6: POST /api/v1/projects

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | プロジェクト作成リクエスト (name, Bearerトークン) | — | app/api/projects.py |
| app/api/projects.py | トークン検証 | JWT検証・ユーザーID抽出 | app/middleware/auth.py |
| app/api/projects.py | プロジェクト作成データ (user_id, name) | 名前文字数バリデーション | app/services/project_service.py |
| app/services/project_service.py | 新規プロジェクトレコード | — | projects |
| projects | 作成されたプロジェクトレコード | — | app/services/project_service.py |
| app/services/project_service.py | プロジェクトDTO | — | app/api/projects.py |
| app/api/projects.py | 作成成功レスポンス (201 Created) | — | 利用者 |

- データ項目: プロジェクト作成リクエスト(name)
- データ項目: 新規プロジェクトレコード(id, user_id, name, created_at, updated_at)

#### DF-7: GET /api/v1/projects/{id}

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | プロジェクト詳細リクエスト (id, Bearerトークン) | — | app/api/projects.py |
| app/api/projects.py | トークン検証 | ユーザーID抽出 | app/middleware/auth.py |
| app/api/projects.py | プロジェクトIDおよびユーザーID | — | app/services/project_service.py |
| app/services/project_service.py | プロジェクト取得クエリ | — | projects |
| projects | プロジェクトレコード | 所有権限チェック (user_id検証) | app/services/project_service.py |
| app/services/project_service.py | 参考資料取得クエリ | — | project_files |
| project_files | 参考資料レコード一覧 | — | app/services/project_service.py |
| app/services/project_service.py | プロジェクト詳細DTO | — | app/api/projects.py |
| app/api/projects.py | 詳細JSONレスポンス (200 OK) | — | 利用者 |

- データ項目: プロジェクト詳細リクエスト(project_id)
- データ項目: プロジェクト詳細DTO(id, name, created_at, updated_at, files)

#### DF-8: POST /api/v1/projects/{id}/files

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | ファイルアップロードリクエスト (multipart/form-data, Bearerトークン) | — | app/api/files.py |
| app/api/files.py | 認証検証 | ユーザーID抽出 | app/middleware/auth.py |
| app/api/files.py | ファイルバイナリとプロジェクトID | ファイル形式・容量(5MB)検証 | app/services/file_service.py |
| app/services/file_service.py | 既存件数確認クエリ | — | project_files |
| project_files | 現在のファイル件数 | 3件未満チェック | app/services/file_service.py |
| app/services/file_service.py | 参考資料レコード | テキスト抽出 (txt/md直接・pdf抽出) | project_files |
| app/services/file_service.py | 保存済みファイルメタ情報 | — | app/api/files.py |
| app/api/files.py | アップロード成功レスポンス (201 Created) | — | 利用者 |

- データ項目: ファイルアップロードリクエスト(file, project_id)
- データ項目: 参考資料レコード(id, project_id, file_name, file_type, file_size, content_text, created_at)

#### DF-9: GET /api/v1/projects/{id}/messages

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | チャット履歴取得リクエスト (Bearerトークン) | — | app/api/messages.py |
| app/api/messages.py | トークン検証 | ユーザーID抽出 | app/middleware/auth.py |
| app/api/messages.py | プロジェクトID | — | app/services/chat_service.py |
| app/services/chat_service.py | メッセージ取得クエリ (created_at昇順) | — | messages |
| messages | メッセージレコード配列 | — | app/services/chat_service.py |
| app/services/chat_service.py | チャット履歴DTO配列 | — | app/api/messages.py |
| app/api/messages.py | 履歴JSONレスポンス (200 OK) | — | 利用者 |

- データ項目: チャット履歴リクエスト(project_id)
- データ項目: メッセージレコード配列(id, role, content, created_at)

#### DF-10: POST /api/v1/projects/{id}/messages

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | メッセージ送信リクエスト (content, Bearerトークン) | — | app/api/messages.py |
| app/api/messages.py | レート制限確認 | ユーザーキーでのチャットレート確認 | app/middleware/rate_limit.py |
| app/api/messages.py | ユーザー発話データ | 空チェック・文字数制限チェック | app/services/chat_service.py |
| app/services/chat_service.py | 参考資料テキストクエリ | — | project_files |
| project_files | 参考資料テキスト配列 | — | app/services/chat_service.py |
| app/services/chat_service.py | 過去対話履歴クエリ | — | messages |
| messages | 過去対話履歴配列 | — | app/services/chat_service.py |
| app/services/chat_service.py | プロンプトおよびコンテキスト | ヒアリング用プロンプト構築 | app/llm/client.py |
| app/llm/client.py | ストリーミング生成リクエスト | — | Google Gemini API |
| Google Gemini API | チャンクストリーム | — | app/llm/client.py |
| app/llm/client.py | SSEチャンクデータ | Server-Sent Events形式 | app/api/messages.py |
| app/api/messages.py | リアルタイムSSEストリーム | — | 利用者 |
| app/services/chat_service.py | ユーザー発言＆完了後AI応答レコード | 生成完了後にDB永続化 | messages |

- データ項目: メッセージ送信リクエスト(content, project_id)
- データ項目: プロンプトおよびコンテキスト(system_prompt, file_context, chat_history, latest_message)
- データ項目: SSEチャンクデータ(event, data)
- データ項目: 保存メッセージレコード(project_id, role, content, created_at)

#### DF-11: POST /api/v1/projects/{id}/specifications/generate

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 設計書生成要求 (Bearerトークン) | — | app/api/specifications.py |
| app/api/specifications.py | レート制限確認 | 生成APIレート確認 | app/middleware/rate_limit.py |
| app/api/specifications.py | 生成指示 | — | app/services/spec_generator_service.py |
| app/services/spec_generator_service.py | プロジェクト全データ取得（対話・資料） | — | messages |
| app/services/spec_generator_service.py | プロジェクト参考資料取得 | — | project_files |
| app/services/spec_generator_service.py | 対話履歴と参考資料の結合コンテキスト | LangGraphステート初期化 | app/llm/graphs.py |
| app/llm/graphs.py | 各ドキュメント生成プロンプト | 要件定義・外部設計・内部設計・実装計画・自己診断パイプライン | Google Gemini API |
| Google Gemini API | 4種設計書Markdownおよび自己診断JSON | — | app/llm/graphs.py |
| app/llm/graphs.py | 完成設計書データセット | — | app/services/spec_generator_service.py |
| app/services/spec_generator_service.py | 設計書レコード | Upsert処理（新規作成または再生成更新） | specifications |
| app/services/spec_generator_service.py | 生成完了設計書DTO | — | app/api/specifications.py |
| app/api/specifications.py | 生成結果レスポンス (200 OK) | — | 利用者 |

- データ項目: 設計書生成要求(project_id)
- データ項目: 完成設計書データセット(requirements_doc, external_design_doc, internal_design_doc, implementation_plan_doc, diagnosis_data)
- データ項目: 設計書レコード(id, project_id, requirements_doc, external_design_doc, internal_design_doc, implementation_plan_doc, diagnosis_data, updated_at)

#### DF-12: GET /api/v1/projects/{id}/specifications

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 設計書取得リクエスト (Bearerトークン) | — | app/api/specifications.py |
| app/api/specifications.py | トークン検証 | ユーザーID抽出 | app/middleware/auth.py |
| app/api/specifications.py | プロジェクトID | — | app/services/spec_generator_service.py |
| app/services/spec_generator_service.py | 設計書レコード取得クエリ | — | specifications |
| specifications | 設計書レコード | — | app/services/spec_generator_service.py |
| app/services/spec_generator_service.py | 設計書詳細DTO | — | app/api/specifications.py |
| app/api/specifications.py | 設計書JSONレスポンス (200 OK) | — | 利用者 |

- データ項目: 設計書取得リクエスト(project_id)
- データ項目: 設計書詳細DTO(id, project_id, requirements_doc, external_design_doc, internal_design_doc, implementation_plan_doc, diagnosis_data, updated_at)

#### DF-13: GET /api/v1/projects/{id}/specifications/download

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | ダウンロードリクエスト (type: individual/zip, doc_type, Bearerトークン) | — | app/api/specifications.py |
| app/api/specifications.py | 認証検証 | ユーザーID抽出 | app/middleware/auth.py |
| app/api/specifications.py | ダウンロードパラメータ | — | app/services/spec_generator_service.py |
| app/services/spec_generator_service.py | 設計書データクエリ | — | specifications |
| specifications | 設計書レコード | ZIP圧縮 (4種MD+diagnosis.md) または 個別MD抽出 | app/services/spec_generator_service.py |
| app/services/spec_generator_service.py | バイナリストリーム (ZIPまたはMD) | Content-Dispositionヘッダー付与 | app/api/specifications.py |
| app/api/specifications.py | ファイルダウンロードレスポンス (200 OK, application/zip or text/markdown) | — | 利用者 |

- データ項目: ダウンロードリクエスト(project_id, type, doc_type)
- データ項目: ダウンロードファイルバイナリ(content_type, filename, file_stream)

## 3.4 例外処理・エラーハンドリング・ログ設計

例外処理・エラーハンドリングおよびログ方針は以下の通り規定します。

1. 共通エラーレスポンスフォーマット:
すべてのエラーはクライアントが統一的にハンドリングできるよう、以下のJSONスキーマに従って返却します。

```json
{
  "error": {
    "code": "STRING_ERROR_CODE",
    "message": "ユーザー向け表示メッセージ",
    "details": null
  }
}
```

主なエラーコード一覧:
- 400 Bad Request: `INVALID_INPUT` (バリデーション違反、空文字送信、ファイル上限超過)
- 401 Unauthorized: `UNAUTHORIZED` (トークン不正、未認証、トークン期限切れ)
- 403 Forbidden: `FORBIDDEN` (他人のプロジェクトへのアクセス)
- 404 Not Found: `NOT_FOUND` (プロジェクトまたは設計書未生成)
- 409 Conflict: `EMAIL_ALREADY_EXISTS` (アカウント重複登録)
- 429 Too Many Requests: `RATE_LIMIT_EXCEEDED` (Redisレート制限超過)、`GEMINI_QUOTA_EXCEEDED` (Gemini APIの無料枠・分間リクエスト上限超過)
- 500 Internal Server Error: `INTERNAL_SERVER_ERROR` (予期せぬ内部障害)
- 503 Service Unavailable: `AI_SERVICE_UNAVAILABLE` (Gemini APIの一時的な障害)

2. 例外ハンドリング方針:
- FastAPIのグローバル例外ハンドラ (`@app.exception_handler`) を定義し、ドメイン例外（`AppException`）、Pydantic検証例外（`RequestValidationError`）、HTTP例外（`HTTPException`）、および捕捉されなかった汎用例外（`Exception`）を一括トラップします。
- Gemini APIの無料枠上限超過（ResourceExhausted / HTTP 429）を検知した場合は、送信されたユーザー発言をDBにコミットせずロールバックし、HTTP 429とともに「AIサービスの利用上限に達しました。時間を置いてから再試行してください」というガイダンスを返却します。
- 4種の設計書一括生成処理でエラーが発生した場合は、トランザクションをロールバックして失敗状態とし、クライアント側で「再生成」ボタンから再実行できる状態を維持します。

3. ログ出力方針 (セキュリティ・個人情報保護の徹底):
- 非機能要件 NFR-007 に従い、システムログ（標準出力およびnginxアクセス/エラーログ）にはパスワード、JWTトークン、参考資料テキスト、チャット本文、設計書本文などのユーザー機密データを一切出力しません。
- 出力内容は「タイムスタンプ (UTC)」「リクエストID / トレースID」「HTTPメソッド・パス」「ステータスコード」「処理所要時間(ms)」「例外クラス名・エラーコード」のみとします。
- ログフォーマットは構造化ログ (JSON Lines) を採用します。

```json
{
  "timestamp": "2025-01-15T12:00:00.000Z",
  "level": "ERROR",
  "request_id": "req-uuid-1234",
  "method": "POST",
  "path": "/api/v1/projects/uuid/messages",
  "status_code": 429,
  "error_code": "GEMINI_QUOTA_EXCEEDED",
  "duration_ms": 450
}
```
