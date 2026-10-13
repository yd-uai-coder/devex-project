# 3. 内部設計書

## 3.1 技術スタック選定・アーキテクチャ方針

フロントエンドはNext.js (App Router) を採用し、Tamaguiを用いてPCおよびスマートフォンブラウザでの表示に対応するレスポンシブUIを構築する。バックエンドはPython 3.13とFastAPIを採用し、非同期I/Oを活用してチャットのストリーミング応答(SSE)および設計書一括生成処理を効率的に処理する。LLM連携にはLangChainおよびLangGraphを用い、対話ヒアリング状態の遷移管理と4文書の順次・並列生成パイプラインを実装する。主データベースにはPostgreSQLを採用してアカウント、チャットログ、設計書等の永続化を行い、RedisはJWTの失効・ブラックリスト管理および各種エンドポイントのアクセス頻度を制御するレート制限用キャッシュとして利用する。インフラはクラウドVPS上にDocker Composeとnginxで構成し、リバースプロキシによるTLS終端およびリクエストルーティングを行う。

```text
+-----------------------------------------------------------+
|                    Client (Browser)                       |
+-----------------------------+-----------------------------+
                              | HTTPS
+-----------------------------v-----------------------------+
|                   Cloud VPS (nginx)                       |
+-----------------------------+-----------------------------+
                              | Reverse Proxy
+-----------------------------v-----------------------------+
|              FastAPI Application (Python 3.13)            |
|  +----------------------+      +-----------------------+  |
|  | Auth / Project API   |      | LangChain / LangGraph |  |
|  +----------+-----------+      +-----------+-----------+  |
+-------------|------------------------------|--------------+
              |                              | API Call
    +---------+---------+          +---------v---------+
    |                   |          | Google Gemini API |
+---v------+     +------v----+     | (Gemini Flash-Lite|
|PostgreSQL|     |   Redis   |     +-------------------+
| (Main DB)|     |(Cache/RL) |                          
+----------+     +-----------+                          
```

## 3.2 データモデル定義

システムで管理する主要エンティティとリレーションは以下の通りである。ユーザー(users)は複数のプロジェクト(projects)を所有し、プロジェクトには参考資料(project_attachments)、チャット履歴(messages)、生成された設計書(documents)、および設計書の自己診断結果(document_diagnoses)が1対多で紐づく。他人のプロジェクトへの不正アクセスを防ぐため、すべての従属データはプロジェクトIDおよび所有ユーザーIDの検証を経てアクセスされる。

```text
users
  |--< projects
         |--< project_attachments
         |--< messages
         |--< documents
         |--< document_diagnoses
```

### テーブル: users

システムを利用するユーザーのアカウント情報を保持するテーブル。

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PRIMARY KEY | ユーザーの一意識別子 |
| email | VARCHAR(255) | NOT NULL, UNIQUE | ログイン用メールアドレス |
| hashed_password | VARCHAR(255) | NOT NULL | ハッシュ化されたパスワード |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | 登録日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | 更新日時 |

### テーブル: projects

ユーザーが作成した要件定義・設計プロジェクトを保持するテーブル。

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PRIMARY KEY | プロジェクトの一意識別子 |
| user_id | UUID | NOT NULL, FOREIGN KEY (users.id) ON DELETE RESTRICT | プロジェクトを所有するユーザーID |
| name | VARCHAR(255) | NOT NULL | プロジェクト名 |
| status | VARCHAR(50) | NOT NULL DEFAULT 'hearing' | プロジェクト状態 (hearing, generating, generated, failed) |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | 更新日時 |

### テーブル: project_attachments

プロジェクト立ち上げ時に添付された参考資料ファイルおよび抽出テキストを保持するテーブル。

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PRIMARY KEY | 添付ファイルの一意識別子 |
| project_id | UUID | NOT NULL, FOREIGN KEY (projects.id) ON DELETE CASCADE | 紐づくプロジェクトID |
| file_name | VARCHAR(255) | NOT NULL | アップロード元のファイル名 |
| file_type | VARCHAR(50) | NOT NULL | ファイル種別 (txt, md, pdf) |
| file_path | VARCHAR(512) | NOT NULL | サーバー上での保存先パス |
| extracted_text | TEXT | NOT NULL | ファイルから抽出した参照用テキスト本文 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | アップロード日時 |

### テーブル: messages

チャット画面におけるユーザーとAIのヒアリング対話ログを保持するテーブル。

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PRIMARY KEY | メッセージの一意識別子 |
| project_id | UUID | NOT NULL, FOREIGN KEY (projects.id) ON DELETE CASCADE | 紐づくプロジェクトID |
| role | VARCHAR(20) | NOT NULL | 発話者種別 (user または assistant) |
| content | TEXT | NOT NULL | メッセージ本文 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | 送信日時 |

### テーブル: documents

生成された4種類のMarkdown設計書本文を保持するテーブル。

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PRIMARY KEY | 設計書レコードの一意識別子 |
| project_id | UUID | NOT NULL, FOREIGN KEY (projects.id) ON DELETE CASCADE | 紐づくプロジェクトID |
| doc_type | VARCHAR(50) | NOT NULL | 設計書種別 (requirement, external, internal, implementation) |
| content | TEXT | NOT NULL | Markdown形式のドキュメント本文 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | 生成日時 |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | 最終更新日時 |

### テーブル: document_diagnoses

生成ドキュメントに対するAI自己診断の不足点項目を保持するテーブル。

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PRIMARY KEY | 診断項目の一意識別子 |
| project_id | UUID | NOT NULL, FOREIGN KEY (projects.id) ON DELETE CASCADE | 紐づくプロジェクトID |
| severity | VARCHAR(20) | NOT NULL | 重要度区分 (critical: 最重要, moderate: 中程度, minor: 軽微) |
| issue_text | TEXT | NOT NULL | 診断された不足点の内容説明 |
| suggestion | TEXT | NOT NULL | 改善への推奨事項・追記提案 |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL DEFAULT CURRENT_TIMESTAMP | 診断日時 |

## 3.3 バックエンド処理・モジュール設計

FastAPIバックエンドはクリーンアーキテクチャのレイヤード構造をベースにし、ルーティング層(routers)、業務ロジック層(services)、データ永続化層(repositories)、外部AI連携ロジック層(agents/workflows)に分離する。LangGraphワークフローによりヒアリング状態管理とドキュメント一括生成パイプラインをカプセル化する。共通基盤として認証・トークン検証(core/auth)、Redisによるレート制限(core/rate_limit)、例外ハンドラ(core/errors)を配置する。

```text
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   ├── rate_limit.py
│   │   ├── exceptions.py
│   │   └── database.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── projects.py
│   │   ├── messages.py
│   │   └── documents.py
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── project_service.py
│   │   ├── chat_service.py
│   │   ├── file_service.py
│   │   └── document_service.py
│   ├── ai/
│   │   ├── client.py
│   │   ├── prompts.py
│   │   └── workflows.py
│   ├── repositories/
│   │   ├── user_repo.py
│   │   ├── project_repo.py
│   │   ├── message_repo.py
│   │   └── document_repo.py
│   └── schemas/
│       ├── auth.py
│       ├── project.py
│       ├── message.py
│       └── document.py
└── scripts/
    └── backup.sh
```

### APIエンドポイント一覧

| メソッド | パス | 概要 |
|---|---|---|
| POST | /api/v1/auth/register | 新規ユーザー作成、パスワードハッシュ化、JWTアクセストークン発行およびリフレッシュトークンCookie設定 |
| POST | /api/v1/auth/login | ユーザー資格情報検証、ログイン試行レート制限確認、JWTアクセストークン発行およびリフレッシュトークンCookie設定 |
| POST | /api/v1/auth/refresh | Cookie内リフレッシュトークンの検証と失効有無の確認、新規アクセストークン再発行 |
| POST | /api/v1/auth/logout | リフレッシュトークンCookie破棄およびRedis失効ブラックリストへのトークン登録 |
| GET | /api/v1/projects | 認証ユーザーが所有するプロジェクト一覧情報の取得 |
| POST | /api/v1/projects | プロジェクト作成、添付ファイル形式・件数バリデーション、テキスト抽出と保存 |
| GET | /api/v1/projects/{id} | プロジェクト詳細情報および添付ファイルメタ情報の取得(所有者認可検証を含む) |
| GET | /api/v1/projects/{id}/messages | 対象プロジェクトのヒアリングチャット対話履歴一覧の取得 |
| POST | /api/v1/projects/{id}/messages | ユーザー入力の検証・一時受付、Gemini APIによるSSEストリーミング応答、対話ログ保存 |
| POST | /api/v1/projects/{id}/documents/generate | LangGraphワークフローによる4種設計書の一括生成と3段階自己診断の実行・保存 |
| GET | /api/v1/projects/{id}/documents | 生成済み4種Markdown本文および自己診断結果一覧の取得 |
| GET | /api/v1/projects/{id}/documents/{doc_type}/download | 指定ドキュメント種別のMarkdownファイルのローカルダウンロード用バイナリレスポンス生成 |

### モジュール一覧

| パス | 層 | 責務 | 主な依存先 |
|---|---|---|---|
| backend/app/routers/auth.py | ルート | 認証・認可に関するHTTPリクエスト受付とCookie制御を行う。 | backend/app/services/auth_service.py, backend/app/core/rate_limit.py |
| backend/app/routers/projects.py | ルート | プロジェクト一覧・詳細取得および新規作成・ファイル添付受付を行う。 | backend/app/services/project_service.py, backend/app/core/rate_limit.py |
| backend/app/routers/messages.py | ルート | チャット履歴取得およびSSEによるAIヒアリング応答ストリーミングの配信を行う。 | backend/app/services/chat_service.py, backend/app/core/rate_limit.py |
| backend/app/routers/documents.py | ルート | 設計書一括生成トリガー、ドキュメント取得およびファイルダウンロードを提供する。 | backend/app/services/document_service.py, backend/app/core/rate_limit.py |
| backend/app/services/auth_service.py | サービス | パスワード検証・ハッシュ化、トークン生成・リフレッシュおよび失効管理ロジックを担う。 | backend/app/repositories/user_repo.py, backend/app/core/security.py |
| backend/app/services/project_service.py | サービス | プロジェクト作成、権限チェック、添付ファイル解析処理の統括を行う。 | backend/app/repositories/project_repo.py, backend/app/services/file_service.py |
| backend/app/services/file_service.py | サービス | アップロードされたtxt/md/pdfの拡張子・形式バリデーションとテキスト抽出を行う。 | pypdf |
| backend/app/services/chat_service.py | サービス | ヒアリング対話の文脈構築、Geminiへのストリーミング要求、および対話履歴永続化を制御する。 | backend/app/repositories/message_repo.py, backend/app/repositories/project_repo.py, backend/app/ai/client.py |
| backend/app/services/document_service.py | サービス | 設計書一括生成パイプラインの実行管理、診断結果集約、Markdown出力生成を担う。 | backend/app/repositories/document_repo.py, backend/app/repositories/project_repo.py, backend/app/ai/workflows.py |
| backend/app/ai/workflows.py | AIロジック | LangGraphを用いて4種設計書の自動生成と3段階自己診断を実行するパイプラインを定義する。 | langgraph, langchain, backend/app/ai/client.py, backend/app/ai/prompts.py |
| backend/app/ai/client.py | 外部連携 | Gemini Flash-Lite APIとの通信およびAPI上限エラーハンドリングを統括する。 | google-genai, backend/app/core/config.py |
| backend/app/repositories/*_repo.py | リポジトリ | PostgreSQLデータベースとのCRUD処理およびトランザクション制御を担当する。 | sqlalchemy, backend/app/core/database.py |
| backend/app/core/rate_limit.py | ミドルウェア | Redisを用いたトークンバケットまたは固定ウィンドウによるエンドポイント利用制限を行う。 | redis |
| backend/app/core/security.py | セキュリティ | JWTのエンコード・デコードおよびパスワードのArgon2/bcryptハッシュ化・照合を行う。 | passlib, pyjwt |
| backend/scripts/backup.sh | 運用バッチ | PostgreSQLデータベースのダンプ日次バックアップを実行し、VPS外へ転送退避する。 | — |

### 処理別データフロー

#### DF-1: POST /api/v1/auth/register

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 新規登録要求(email, password) | — | backend/app/routers/auth.py |
| backend/app/routers/auth.py | IP/アカウント単位の登録試行回数 | レート制限チェック | backend/app/core/rate_limit.py |
| backend/app/routers/auth.py | 登録情報(email, raw_password) | — | backend/app/services/auth_service.py |
| backend/app/services/auth_service.py | 重複確認クエリ | — | users |
| backend/app/services/auth_service.py | 新規ユーザーエンティティ(email, hashed_password) | パスワードハッシュ化 | users |
| backend/app/services/auth_service.py | トークンペア(Access/Refresh JWT) | JWT生成 | backend/app/routers/auth.py |
| backend/app/routers/auth.py | 登録成功応答(201 Created, アクセストークン, HttpOnly Cookie) | — | 利用者 |

- データ項目: RegisterRequest(email, password)
- データ項目: AuthResponse(access_token, token_type, user_id)

#### DF-2: POST /api/v1/auth/login

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | ログイン認証要求(email, password) | — | backend/app/routers/auth.py |
| backend/app/routers/auth.py | 総当たり防止チェック | レート制限確認 | backend/app/core/rate_limit.py |
| backend/app/routers/auth.py | 認証情報(email, password) | — | backend/app/services/auth_service.py |
| backend/app/services/auth_service.py | ユーザー取得クエリ | — | users |
| users | ユーザーレコード(id, hashed_password) | — | backend/app/services/auth_service.py |
| backend/app/services/auth_service.py | トークンペア | パスワード検証・JWT生成 | backend/app/routers/auth.py |
| backend/app/routers/auth.py | 認証成功応答(200 OK, アクセストークン, HttpOnly Cookie) | — | 利用者 |

- データ項目: LoginRequest(email, password)
- データ項目: AuthResponse(access_token, token_type, user_id)

#### DF-3: POST /api/v1/auth/refresh

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | トークン再発行要求(Cookie内Refresh Token) | — | backend/app/routers/auth.py |
| backend/app/routers/auth.py | Refresh Token検証要求 | — | backend/app/services/auth_service.py |
| backend/app/services/auth_service.py | トークン失効問い合わせ | — | backend/app/core/rate_limit.py |
| backend/app/services/auth_service.py | 新規Access Token | 署名検証・新JWT発行 | backend/app/routers/auth.py |
| backend/app/routers/auth.py | トークン再発行応答(200 OK, 新Access Token) | — | 利用者 |

- データ項目: RefreshTokenPayload(sub, exp, jti)
- データ項目: TokenRefreshResponse(access_token, token_type)

#### DF-4: POST /api/v1/auth/logout

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | ログアウト要求(Cookie内Refresh Token) | — | backend/app/routers/auth.py |
| backend/app/routers/auth.py | トークン無効化要求 | — | backend/app/services/auth_service.py |
| backend/app/services/auth_service.py | トークンブラックリスト登録 | 有効期限までRedis登録 | backend/app/core/rate_limit.py |
| backend/app/routers/auth.py | ログアウト完了(200 OK, Cookieクリア) | — | 利用者 |

- データ項目: LogoutResponse(message)

#### DF-5: GET /api/v1/projects

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | プロジェクト一覧要求(JWT) | — | backend/app/routers/projects.py |
| backend/app/routers/projects.py | 所有プロジェクト検索(user_id) | — | backend/app/services/project_service.py |
| backend/app/services/project_service.py | SQL取得クエリ(user_id一致) | — | projects |
| projects | プロジェクト行一覧 | — | backend/app/services/project_service.py |
| backend/app/services/project_service.py | プロジェクト一覧DTO | レスポンス整形 | backend/app/routers/projects.py |
| backend/app/routers/projects.py | プロジェクト一覧応答(200 OK) | — | 利用者 |

- データ項目: ProjectListItem(id, name, status, created_at, updated_at)

#### DF-6: POST /api/v1/projects

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 新規プロジェクト情報および添付ファイル群 | — | backend/app/routers/projects.py |
| backend/app/routers/projects.py | 作成レート制限確認 | — | backend/app/core/rate_limit.py |
| backend/app/routers/projects.py | プロジェクトデータ・ファイルバイナリ | — | backend/app/services/project_service.py |
| backend/app/services/project_service.py | 添付ファイル群(txt/md/pdf, 最大3件) | — | backend/app/services/file_service.py |
| backend/app/services/file_service.py | 検証済みファイルテキストおよびメタ情報 | 拡張子チェック・テキスト抽出 | backend/app/services/project_service.py |
| backend/app/services/project_service.py | 新規プロジェクトエンティティ | — | projects |
| backend/app/services/project_service.py | 添付ファイルレコード群 | — | project_attachments |
| backend/app/services/project_service.py | 作成プロジェクト情報DTO | — | backend/app/routers/projects.py |
| backend/app/routers/projects.py | プロジェクト作成応答(201 Created) | — | 利用者 |

- データ項目: ProjectCreateRequest(name, files)
- データ項目: ProjectDetailResponse(id, name, status, attachments, created_at)

#### DF-7: GET /api/v1/projects/{id}

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | プロジェクト詳細要求(project_id) | — | backend/app/routers/projects.py |
| backend/app/routers/projects.py | 所有権限付き取得要求 | — | backend/app/services/project_service.py |
| backend/app/services/project_service.py | プロジェクト取得クエリ | — | projects |
| projects | プロジェクトレコード(user_id照合) | — | backend/app/services/project_service.py |
| backend/app/services/project_service.py | 添付資料取得クエリ | — | project_attachments |
| project_attachments | 添付資料メタデータ一覧 | — | backend/app/services/project_service.py |
| backend/app/services/project_service.py | プロジェクト詳細DTO | — | backend/app/routers/projects.py |
| backend/app/routers/projects.py | プロジェクト詳細応答(200 OK) | — | 利用者 |

- データ項目: ProjectDetailResponse(id, name, status, attachments, created_at)

#### DF-8: GET /api/v1/projects/{id}/messages

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 対話履歴要求(project_id) | — | backend/app/routers/messages.py |
| backend/app/routers/messages.py | 履歴取得要求 | — | backend/app/services/chat_service.py |
| backend/app/services/chat_service.py | プロジェクト所有権確認 | — | projects |
| backend/app/services/chat_service.py | 対話履歴取得クエリ | — | messages |
| messages | メッセージ行リスト(時系列順) | — | backend/app/services/chat_service.py |
| backend/app/services/chat_service.py | 対話履歴DTO | — | backend/app/routers/messages.py |
| backend/app/routers/messages.py | 対話履歴一覧応答(200 OK) | — | 利用者 |

- データ項目: ChatMessage(id, role, content, created_at)

#### DF-9: POST /api/v1/projects/{id}/messages

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | チャットメッセージ(content) | — | backend/app/routers/messages.py |
| backend/app/routers/messages.py | チャット利用回数チェック | — | backend/app/core/rate_limit.py |
| backend/app/routers/messages.py | メッセージ送信要求 | — | backend/app/services/chat_service.py |
| backend/app/services/chat_service.py | 所有者確認および状態確認 | — | projects |
| backend/app/services/chat_service.py | 過去対話履歴および添付資料テキスト取得 | — | messages |
| backend/app/services/chat_service.py | ヒアリング用プロンプト文脈 | コンテキスト組み立て | backend/app/ai/client.py |
| backend/app/ai/client.py | Gemini API チャットストリーミング要求 | — | Google Gemini API (Gemini Flash-Lite) |
| Google Gemini API (Gemini Flash-Lite) | ストリーミングチャンク | — | backend/app/services/chat_service.py |
| backend/app/services/chat_service.py | SSEイベントストリーム | — | 利用者 |
| backend/app/services/chat_service.py | ユーザーメッセージおよびAI全回答メッセージ | 完了後コミット(エラー時は保存中止) | messages |

- データ項目: SendMessageRequest(content)
- データ項目: StreamChunk(chunk, is_finished)

#### DF-10: POST /api/v1/projects/{id}/documents/generate

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 設計書一括生成トリガー | — | backend/app/routers/documents.py |
| backend/app/routers/documents.py | 生成レート制限チェック | — | backend/app/core/rate_limit.py |
| backend/app/routers/documents.py | 設計書生成処理要求 | — | backend/app/services/document_service.py |
| backend/app/services/document_service.py | プロジェクト状態を 'generating' に更新 | — | projects |
| backend/app/services/document_service.py | 全対話履歴および添付抽出テキスト | — | backend/app/ai/workflows.py |
| backend/app/ai/workflows.py | 設計書生成・診断プロンプト要求 | — | Google Gemini API (Gemini Flash-Lite) |
| Google Gemini API (Gemini Flash-Lite) | 4種設計書Markdownおよび自己診断項目(3段階) | — | backend/app/ai/workflows.py |
| backend/app/ai/workflows.py | 生成結果ドキュメント群および診断データ | — | backend/app/services/document_service.py |
| backend/app/services/document_service.py | 4種設計書レコード (要件・外部・内部・計画) | UPSERT更新 | documents |
| backend/app/services/document_service.py | 自己診断レコード群 (最重要・中程度・軽微) | — | document_diagnoses |
| backend/app/services/document_service.py | プロジェクト状態を 'generated' に更新 | — | projects |
| backend/app/services/document_service.py | 生成完了ジョブ応答 | — | backend/app/routers/documents.py |
| backend/app/routers/documents.py | 受付・完了ステータス(202 Accepted または完了通知) | — | 利用者 |

- データ項目: GenerateDocumentResponse(project_id, status, generated_at)

#### DF-11: GET /api/v1/projects/{id}/documents

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 生成済みドキュメント取得要求(project_id) | — | backend/app/routers/documents.py |
| backend/app/routers/documents.py | ドキュメント取得要求 | — | backend/app/services/document_service.py |
| backend/app/services/document_service.py | 所有者検証 | — | projects |
| backend/app/services/document_service.py | 設計書レコード取得クエリ | — | documents |
| documents | 4種のMarkdownドキュメントレコード | — | backend/app/services/document_service.py |
| backend/app/services/document_service.py | 自己診断レコード取得クエリ | — | document_diagnoses |
| document_diagnoses | 重要度別診断項目リスト | — | backend/app/services/document_service.py |
| backend/app/services/document_service.py | ドキュメント集約レスポンスDTO | — | backend/app/routers/documents.py |
| backend/app/routers/documents.py | 4種ドキュメントおよび自己診断結果応答(200 OK) | — | 利用者 |

- データ項目: ProjectDocumentsResponse(project_id, documents, diagnoses)
- データ項目: DiagnosisItem(severity, issue_text, suggestion)

#### DF-12: GET /api/v1/projects/{id}/documents/{doc_type}/download

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| 利用者 | 単体ファイルダウンロード要求(doc_type) | — | backend/app/routers/documents.py |
| backend/app/routers/documents.py | 単体ドキュメント抽出要求 | — | backend/app/services/document_service.py |
| backend/app/services/document_service.py | 所有者検証および対象ドキュメント取得 | — | documents |
| documents | Markdown本文 | — | backend/app/services/document_service.py |
| backend/app/services/document_service.py | Markdownバイナリデータ | ファイル名およびContent-Dispositionヘッダー付与 | backend/app/routers/documents.py |
| backend/app/routers/documents.py | Markdownファイルダウンロード応答(200 OK, text/markdown) | — | 利用者 |

- データ項目: FileDownloadPayload(file_name, content_type, content)

#### DF-13: backend/scripts/backup.sh

| 元 | データ | 変換 | 先 |
|---|---|---|---|
| backend/scripts/backup.sh | 日次pg_dump実行要求 | — | PostgreSQL |
| PostgreSQL | データベースダンプファイル(.sql.gz) | — | backend/scripts/backup.sh |
| backend/scripts/backup.sh | ダンプファイル複製・転送 | 7世代保持管理および外部VPS転送 | 外部実体 |

- データ項目: DatabaseDumpArchive(dump_file_name, checksum, created_at)

## 3.4 例外処理・エラーハンドリング・ログ設計

FastAPIの例外ハンドラ基盤により、システム全体の共通エラーレスポンス形式を統一する。エラーレスポンスはRFC 7807に準拠したJSON形式（code, message, details）で返却する。

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "入力内容に誤りがあります。",
    "details": ["メールアドレスの形式が正しくありません。"]
  }
}
```

例外検知およびログ出力方針は要件定義書のNFR-007に厳格に準拠する。機密保持の観点から、ログ出力にはユーザーの入力テキスト、アップロードされた資料の内容、チャット本文、生成された設計書本文などの個人情報・機密情報は一切含めない。ログフォーマットは構造化された最小限のメタデータとし、発生日時、HTTPステータスコード、内部エラーコード、リクエストID、エラー発生モジュール名のみを記録する。また、Gemini APIの無料枠制限超過(HTTP 429 / ResourceExhausted)や一時的な停止(HTTP 503)を検知した場合は、502/503エラーへマッピングし、画面側に再送・再試行を促すエラー通知を表示する。チャット送信時のAI呼び出し失敗時は、該当送信メッセージをDBに永続化させずロールバックすることで、画面とDBの不整合を抑止する。
