[← README.md](../README.md)

# 内部設計書：Devex

## 3.1 技術スタック選定・アーキテクチャ方針

本システム（Devex）は、[要件定義書](requirements.md)に定められた制約に基づき、以下の技術スタックを採用する。

### 1. 技術スタック選定理由

* **フロントエンド（Next.js）**:
  * SSR/SSGによる初期表示の高速化と、SEOフレンドリーな構成が可能。
  * App Routerを採用し、チャット画面やプレビュー画面の動的ルーティング、およびServer ActionsやAPI Routesを活用した効率的な状態管理を実現。
* **バックエンド（FastAPI + LangChain）**:
  * **FastAPI**: 非同期処理（Async/Await）にネイティブ対応しており、LLMのストリーミング応答やバックグラウンドでのドキュメント生成処理（非同期化）に最適。自動でSwagger/OpenAPIドキュメントが生成されるため、フロントエンドとの連携も容易。
  * **LangChain**: チャット履歴の管理、プロンプトテンプレートの構造化、および外部LLM(**Gemini Flash-Lite**採用予定。無料プランのためトークン上限超過時のエラーハンドリングを前提とする。3.4節参照)への抽象化されたアクセスレイヤーを提供するため。
* **データベース（PostgreSQL）**:
  * ユーザー情報、プロジェクトデータ、時系列のチャット履歴、およびバージョン管理されるMarkdownドキュメントといった、リレーショナルな構造とJSONデータの双方を堅牢に管理するため。
* **インフラストラクチャー（Docker / Docker Compose）**:
  * フロントエンド、バックエンド、データベースをそれぞれコンテナ化することで、開発・検証・本番環境における環境差異を排除し、デプロイの容易性と拡張性を担保。

### 2. アーキテクチャ方針

* **バックエンド構成**: クリーンアーキテクチャ（またはレイヤードアーキテクチャ）の考え方を導入し、「ルーター（API）」、「サービス（ビジネスロジック・LangChain連携）」、「リポジトリ（DBアクセスマネジメント）」に責務を分離する。これにより、プロンプトのチューニングやLLMモデルの変更に対する拡張性を高める。
* **非同期・ストリーミング処理**: チャットの対話では **Server-Sent Events (SSE)** を用いたストリーミング応答を実装し、ユーザーの待ち時間を軽減する。SSEを採用する理由: (1) 通常のHTTPで完結しFastAPIの`StreamingResponse`で実装できる、(2) 送信はユーザーからのPOSTで十分でありサーバー→クライアントの片方向で要件を満たせる、(3) ブラウザの`EventSource`が自動再接続を標準サポートする、(4) 現行要件に双方向のリアルタイム機能(タイピングインジケーター等)が無い。将来双方向のリアルタイム機能が必要になった場合はWebSocketへの移行を再検討する。また、ヒアリング完了後の「4種の設計書一括生成」では、タスクがタイムアウトしないよう非同期バックグラウンドワーカー（FastAPI BackgroundTasks もしくは Celery）による処理を導入する。
* **認証(JWT)のトークン方針**: アクセストークン有効期限は30分、リフレッシュトークン有効期限は14日とする。リフレッシュトークンはhttpOnly Secure Cookieに保持(XSS対策)し、アクセストークンはクライアントメモリ(Zustandストア、非persist)に保持する。リフレッシュは`devex-ui`既存の`auth-store.ts`(JWT `exp`検知+サイレントリフレッシュタイマー)パターンを踏襲し、有効期限の一定時間前に自動リフレッシュする。この仕様は将来の別プロジェクトでも再利用する想定であり、Devexプロジェクト完了後に`devex-api`/`devex-ui`テンプレートリポジトリ側のデフォルト仕様として反映する(`textbook/decision-digest.md`参照)。

---

## 3.2 データモデル定義

### 1. 主要エンティティ一覧

* **User（ユーザー）**: システムを利用する開発者やPMのアカウント情報を管理。
* **Project（プロジェクト）**: 1つの開発案件（アイデア）単位。チャットセッションや生成ドキュメントの親となる。
* **ChatHistory（チャット履歴）**: ユーザーとAIの間で行われた対話のログ。
* **GeneratedDocument（生成ドキュメント）**: ヒアリング結果を基に生成された4種のMarkdownテキスト（要件定義、外部設計、内部設計、実装計画）およびそのバージョンを管理。
* **PromptTemplate（プロンプトテンプレート）**: ※Should have要件を見据え、WebアプリやAPI向けなどのテンプレート定義を保持。
* **IntakeFile（添付ファイル）**: 初期ヒアリング入力時にアップロードされた参考資料(txt/Markdown/PDF、最大3ファイル)から抽出したテキストを管理。

### 2. テーブル定義

#### ① `users` テーブル

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK, DEFAULT gen_random_uuid() | ユーザーID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | パスワードハッシュ |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 更新日時 |

#### ② `projects` テーブル

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK, DEFAULT gen_random_uuid() | プロジェクトID |
| user_id | UUID | FK (`users.id`), NOT NULL | 所有ユーザーID |
| title | VARCHAR(255) | NOT NULL | プロジェクト名 / アイデア概要 |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'interviewing' | 状態 (interviewing: ヒアリング中, generating: 生成中, completed: 完了) |
| intake | JSONB | NULL可 | 初期ヒアリング入力([外部設計書](external_design.md) 2.5節3項)をそのまま保持。`system_overview`/`goals_raw`/`notes_raw`/`environment` を含む |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 更新日時 |

#### ③ `chat_histories` テーブル

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK, DEFAULT gen_random_uuid() | チャット履歴ID |
| project_id | UUID | FK (`projects.id`), NOT NULL | プロジェクトID |
| sender | VARCHAR(20) | NOT NULL | 送信者タイプ ('user' / 'ai' / 'intake': 初期ヒアリング入力の記録 / 'others': ドキュメント自己診断結果の記録) |
| message | TEXT | NOT NULL | メッセージ本文 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 送信日時 |

#### ④ `generated_documents` テーブル

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK, DEFAULT gen_random_uuid() | ドキュメントID |
| project_id | UUID | FK (`projects.id`), NOT NULL | プロジェクトID |
| doc_type | VARCHAR(50) | NOT NULL | 種別 ('requirements', 'external_design', 'internal_design', 'implementation_plan') |
| content | TEXT | NOT NULL | 生成されたMarkdownテキスト |
| version | INT | NOT NULL, DEFAULT 1 | バージョン番号 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 作成日時 |

**バージョニング方針**: 「再生成する」ボタン押下時は既存行を上書きせず新バージョンを追加する。同一`project_id`+`doc_type`につき直近3バージョンまで保管し、4件目が生成された時点で最も古いバージョンを削除する。

#### ⑤ `prompt_templates` テーブル（※Should have対応）

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK, DEFAULT gen_random_uuid() | テンプレートID |
| name | VARCHAR(100) | NOT NULL | テンプレート名 (例: "Webアプリ向け") |
| target_type | VARCHAR(50) | NOT NULL | 対象システム種別 |
| system_prompt | TEXT | NOT NULL | LLMに与えるシステムプロンプト定義 |
| default_environment | JSONB | NULL可 | このテンプレート選択時にSCR-004のintake環境設定へプリフィルするデフォルト値。`intake.environment`([外部設計書](external_design.md) 2.5節3項)と同じ構造(`languages`/`frameworks`/`databases`/`deploy_targets`) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 作成日時 |

#### ⑥ `intake_files` テーブル

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK, DEFAULT gen_random_uuid() | 添付ファイルID |
| project_id | UUID | FK (`projects.id`), NOT NULL | プロジェクトID |
| filename | VARCHAR(255) | NOT NULL | アップロード時の元ファイル名 |
| file_type | VARCHAR(20) | NOT NULL | 拡張子(`txt`/`md`/`pdf`のいずれか) |
| size_bytes | INT | NOT NULL | 元ファイルのサイズ(バイト) |
| extracted_text | TEXT | NULL可 | 抽出したテキスト内容(抽出失敗時はNULL、最大20,000文字で切り詰め) |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'processed' | 処理結果 (`processed`: テキスト化成功, `failed`: 失敗) |
| error_message | VARCHAR(255) | NULL可 | 失敗時の理由 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 作成日時 |

**保存方針**: 元ファイルの実体(バイナリ)は保持しない。テキスト化後は破棄し、`extracted_text`のみ永続化する(オブジェクトストレージ非依存)。テキスト化方式は`file_type`によって異なる: `txt`/`md`はファイル内容をUTF-8テキストとしてそのまま読み込む(LLM呼び出し不要)。`pdf`はGeminiのネイティブなファイル理解でテキスト化する(図・レイアウトの解釈を含む。詳細は3.3節・[外部設計書](external_design.md) 2.5節5項参照)。対応形式をtxt/Markdown/PDFの3種類に限定しているのは、Word/Excel/PowerPointをLLMへ直接渡せず、同水準の図解釈を行うにはPDF変換用の新規インフラ(LibreOffice等)が必要になるため(導入しない判断。[decision-digest](../textbook/decision-digest.md)参照)。

---

## 3.3 バックエンド処理・モジュール設計

### 1. 主要処理ロジック（ビジネスロジック）の分割方針

FastAPIのアプリケーションディレクトリ構成と責務の分割を以下のように定義する。

```text
backend/
├── app/
│   ├── api/             # ルーター層 (エンドポイント定義、リクエスト/レスポンスバリデーション)
│   ├── core/            # 共通設定 (DB接続, セキュリティ・JWT, 環境変数)
│   ├── models/          # ORMモデル (SQLAlchemy等によるDB定義)
│   ├── schemas/         # Pydanticモデル (入出力バリデーション用スキーマ)
│   ├── services/        # ビジネスロジック層
│   │   ├── chat_service.py      # LangChainを用いた対話・ヒアリング制御
│   │   └── doc_generator_service.py # 4種のドキュメント一括生成ロジック
│   └── repositories/    # データアクセス層 (DBへのCRUD操作)
```

* **`chat_service.py`**:
  * プロジェクト作成時、`intake`(初期ヒアリング入力)を`sender='intake'`の`chat_histories`行として永続化する。添付ファイルがある場合は`intake_files`のテキスト化(後述)も行い、その`extracted_text`も`sender='intake'`の`chat_histories`行(ファイルごと、またはintake本体行への追記)として併せて永続化する。ユーザーからの入力とこれまでの `chat_histories`(intake行・添付ファイル由来の行を含む)をLangChainのメモリ（Memory）にロードし、LLMへ送信することで、チャット開始直後のAIの最初の発話に反映する。
  * **添付ファイルのテキスト化**: `txt`/`md`はファイル内容をUTF-8テキストとしてそのまま読み込む。`pdf`は既存の`app/ai/llm/gemini.py`のGeminiクライアントを流用し、ファイルをそのまま渡してLLMのネイティブなファイル理解でテキスト化する(新規のPDF解析ライブラリは追加しない)。結果は`intake_files`テーブルに保存する(3.2節参照)。
  * ヒアリングが十分な状態に達したか（あるいはユーザーが生成を要求したか）を判定するロジックを保持。判定基準([外部設計書](external_design.md) 2.3節SCR-004参照): (1)目的・課題の明確化、(2)コア機能が最低1つ以上「誰が・何を・なぜ」のレベルで具体化、(3)想定ユーザー像の把握、(4)MVPスコープの認識合わせ、(5)環境設定未入力時は技術的制約の確認、をすべて満たしたら「十分」と判定する。十分と判断した場合は、即座に生成へ進まず、構造化した要件サマリをユーザーに提示して明示的な承認を得てから次のステップ（`doc_generator_service.py` の呼び出し）に進む。
* **`doc_generator_service.py`**:
  * ヒアリング完了時、チャット全履歴をコンテキストとしてインプットし、「要件定義」「外部設計」「内部設計」「実装計画」のそれぞれに特化したプロンプトを実行。
  * バックグラウンドタスクとして非同期実行され、進捗や結果をデータベース (`generated_documents`) に保存。
  * **自己診断ステップ**: 4文書の生成完了後、生成した文書自体を入力として追加のLLM呼び出しを行い、不足・不明瞭な点を「最重要/中程度/軽微」の3段階に分類して抽出する([要件定義書](requirements.md) 1.4節「ドキュメント自己診断機能」)。抽出結果は`sender='others'`の`chat_histories`行として保存し、ユーザーへの提示は`chat_service.py`側のチャット表示ロジックが担う。

### 2. APIエンドポイント一覧

| メソッド | パス | 概要 | 認証要否 |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/auth/register` | 新規ユーザー登録 | 不要 |
| **POST** | `/api/v1/auth/login` | ログイン（JWT発行） | 不要 |
| **POST** | `/api/v1/projects` | 新規プロジェクト作成(初期ヒアリング入力を`intake`として受け取る。添付ファイル最大3件・txt/md/pdfのみを伴う場合は`multipart/form-data`になる。[外部設計書](external_design.md) 2.5節3項・5項参照) | 必要 |
| **GET** | `/api/v1/projects` | ユーザーのプロジェクト一覧取得 | 必要 |
| **GET** | `/api/v1/projects/{id}` | 特定プロジェクトの詳細・状態取得(添付ファイルのサマリ ── ファイル名・形式・`status` ── を含む。`extracted_text`本文は含めない) | 必要 |
| **POST** | `/api/v1/projects/{id}/chat` | チャットメッセージ送信・AI応答取得（ストリーミング対応） | 必要 |
| **GET** | `/api/v1/projects/{id}/chat` | 特定プロジェクトのチャット履歴取得 | 必要 |
| **POST** | `/api/v1/projects/{id}/generate` | 設計書4種の自動生成トリガー（非同期） | 必要 |
| **GET** | `/api/v1/projects/{id}/documents` | 生成された設計書一覧・内容の取得 | 必要 |
| **GET** | `/api/v1/projects/{id}/documents/{doc_id}/download` | 指定Markdownドキュメントのダウンロード | 必要 |

---

## 3.4 例外処理・エラーハンドリング・ログ設計

### 1. 共通エラーレスポンス形式

API全体で一貫したエラーハンドリングを行うため、エラー発生時は以下のJSONフォーマットでレスポンスを返却する。

```json
{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "ユーザー向けの詳細なエラーメッセージ",
    "details": []
  }
}
```

主なエラーコード例：
* `UNAUTHORIZED`: 認証トークンが無効または有効期限切れ
* `RESOURCE_NOT_FOUND`: 指定されたプロジェクトやドキュメントが存在しない
* `LLM_API_ERROR`: 外部LLMプロバイダー（Gemini等）との通信エラーやレートリミット超過
* `LLM_QUOTA_EXCEEDED`: Gemini Flash-Lite無料枠のトークン上限超過。ユーザーには「本日の利用上限に達しました」等の分かりやすいメッセージを表示する([実装計画書](implementation_plan.md) 4.4リスク3参照)
* `TOO_MANY_FILES`: 初期ヒアリングの添付ファイルが上限(3件)を超えている
* `UNSUPPORTED_FILE_TYPE`: 添付ファイルがtxt/Markdown/PDF以外の形式である
* `FILE_TOO_LARGE`: 添付ファイルが1ファイルあたりの上限(5MB)を超えている
* `FILE_EXTRACTION_FAILED`: 添付ファイルのテキスト化に失敗した(破損ファイル等。ヒアリング自体はブロックしない)
* `INTERNAL_SERVER_ERROR`: 予期せぬサーバーエラー

### 2. 例外検知・ログ出力方針

* **ログライブラリ**: Python標準の `logging` モジュール（または構造化ログを出力する `structlog`）を使用し、JSON形式でログを出力する。
* **ログレベルの定義**:
  * `DEBUG`: 開発環境での詳細なデバッグ情報（SQLクエリ、プロンプトの内容など）
  * `INFO`: APIリクエストの受付、プロジェクト作成、ドキュメント生成完了などの主要なライフサイクルイベント
  * `WARNING`: 外部APIの応答遅延、バリデーションエラー等の軽微な問題
  * `ERROR`: データベース接続エラー、外部LLMの呼び出し失敗、予期せぬ例外（スタックトレースを必ず記録）
* **例外キャッチとハンドリング**:
  * FastAPIの `exception_handler` を用いて、カスタム例外（例: `AppException`）および未処理の `Exception` をグローバルにキャッチし、適切なHTTPステータスコードと共通エラーレスポンスに変換して返却する。
