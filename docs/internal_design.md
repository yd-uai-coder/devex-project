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
* **非同期・ストリーミング処理**: チャットの対話では **Server-Sent Events (SSE)** を用いたストリーミング応答を実装し、ユーザーの待ち時間を軽減する。SSEを採用する理由: (1) 通常のHTTPで完結しFastAPIの`StreamingResponse`で実装できる、(2) 送信はユーザーからのPOSTで十分でありサーバー→クライアントの片方向で要件を満たせる、(3) ブラウザの`EventSource`が自動再接続を標準サポートする、(4) 現行要件に双方向のリアルタイム機能(タイピングインジケーター等)が無い。将来双方向のリアルタイム機能が必要になった場合はWebSocketへの移行を再検討する。なお、ステージ6(Phase 35)からヒアリングの返信は本文と選択肢カードを1回の構造化出力で作るため、本文はトークンごとには流れず、まとめて1回で届く(SSE は本文・カード・失敗を順に伝える経路として使い続ける)。また、ヒアリング完了後の「4種の設計書一括生成」では、タスクがタイムアウトしないよう非同期バックグラウンドワーカー（FastAPI BackgroundTasks もしくは Celery）による処理を導入する。
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
* **DesignStage（詳細設計の段階、ステージ4）**: 詳細設計モードの段階1〜7ごとの成果物(意味モデル)と承認状態を管理(⑩、Phase 15で新設)。

### 2. テーブル定義

#### ① `users` テーブル

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK, DEFAULT gen_random_uuid() | ユーザーID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス(ログインに使う) |
| hashed_password | VARCHAR(255) | NOT NULL | パスワードハッシュ |
| user_name | VARCHAR(255) | NULL | ユーザーネーム(表示名。ステージ9 で `full_name` から改名) |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | 有効なアカウントか(無効ならログインできない) |
| is_superuser | BOOLEAN | NOT NULL, DEFAULT false | 管理者か(既定のキーでの設計レビュー。ステージ8) |
| review_enabled | BOOLEAN | NOT NULL, DEFAULT false | 設計レビューの設定(ステージ8) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 更新日時 |

**(ステージ9)** 表示名の列 `full_name` を `user_name` に改名した(Phase 66。Alembic の列の改名でデータは残す)。この表も実際の列に合わせて直した(それまでは `password_hash` と書き、`is_active`・`is_superuser`・`review_enabled` が無かった)。用途ごとのモデルと API キーは別のテーブルに持つ(3.3節「9. 使い勝手とアカウント・モデル設定」)。

#### ② `projects` テーブル

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK, DEFAULT gen_random_uuid() | プロジェクトID |
| user_id | UUID | FK (`users.id`), NOT NULL | 所有ユーザーID |
| title | VARCHAR(255) | NOT NULL | プロジェクト名。作成時に入力する(必須・前後の空白を除いて1〜40文字。ゴール3後の調整)。以前のプロジェクトは、システム概要の全文が入っている |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'interviewing' | 状態 (interviewing: ヒアリング中, generating: 生成中, completed: 完了, revising: 修正中。completed後に新規チャットメッセージを送るとrevisingへ遷移する) |
| mode | VARCHAR(20) | NOT NULL, DEFAULT 'simple'（※ステージ4、Phase 15）  | 作成時に選んだモード。`simple`(簡易ドキュメントモード: 4文書の一括生成)/`detailed`(詳細設計モード: 要件定義・外部設計の後に段階1〜7)。作成後は変えない。既存の行は`simple`にする([外部設計書](external_design.md) 2.7節) |
| template_id | UUID | FK (`prompt_templates.id`), NULL可（※ステージ2対応） | SCR-003で選択したテンプレート。クライアント側のプリフィルのみで終わらせず、プロジェクトのライフサイクル全体(ヒアリング再開・再生成時)を通じて選択したテンプレートを保持するためサーバー側に永続化する(⑤`prompt_templates`テーブル参照) |
| intake | JSONB | NULL可 | 初期ヒアリング入力([外部設計書](external_design.md) 2.5節3項)をそのまま保持。`system_overview`/`goals_raw`/`notes_raw`/`environment` を含む |
| hearing_check | JSONB | NULL可(ゴール3後の調整) | 直近のヒアリング完了判定の結果(`is_sufficient`/`summary`/`missing_points`)。ユーザーの発言のたびに判定し直して保存し、`GET /hearing-completion`はこれを返す。まだ判定していない、または直近の判定に失敗したら NULL(「十分でない」として扱う) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | NULL可(※ステージ9、Phase 64) | 削除の印。付いた行は取得・一覧から外し、ロックが空いたときに子の行ごと物理削除する(3.3節 9項「プロジェクトの削除」)。NULL は削除していない |

#### ③ `chat_histories` テーブル

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK, DEFAULT gen_random_uuid() | チャット履歴ID |
| project_id | UUID | FK (`projects.id`), NOT NULL | プロジェクトID |
| sender | VARCHAR(20) | NOT NULL | 送信者タイプ ('user' / 'ai' / 'intake': 初期ヒアリング入力の記録 / 'others': ドキュメント自己診断結果の記録) |
| message | TEXT | NOT NULL | メッセージ本文 |
| cards | JSONB | NULL可 | 選択肢カード(AI の発言だけが持つ。カードごとに id・観点のキーと名前・問い・選択肢(名前と結果)・おすすめの番号と理由・選ばれた選択肢の番号。Phase 35) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 送信日時。アプリが行ごとに時刻を入れる(1回の送信で利用者の発言と AI の返信を同じトランザクションで保存するため、DB の`now()`(トランザクションの開始時刻)では2行が同じ時刻になり、発生順に並ばない。Phase 35 完了後の調整) |

#### ④ `generated_documents` テーブル

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK, DEFAULT gen_random_uuid() | ドキュメントID |
| project_id | UUID | FK (`projects.id`), NOT NULL | プロジェクトID |
| doc_type | VARCHAR(50) | NOT NULL | 種別 ('requirements', 'external_design', 'internal_design', 'implementation_plan') |
| content | TEXT | NOT NULL | 生成されたMarkdownテキスト |
| model | JSONB | NULL可 | 意味モデル。要件定義書は要件の行・ID・出どころ・観点、生成した時点の観点の状態(Phase 36)。外部設計書は画面・API・外部連携の行(Phase 37)。内部設計書はテーブル・API・モジュール・処理別データフローの行と説明の節、実装計画書はマイルストーン・タスク(段階7と同じ型)・リスクと説明の節(簡易モード。Phase 45)。`content`はこれから組み立てたmd。modelを持たない以前の版はNULL(mdのまま使う) |
| version | INT | NOT NULL, DEFAULT 1 | バージョン番号 |
| is_current | BOOLEAN | NOT NULL, DEFAULT false | 現在表示中のバージョンか。同一`project_id`+`doc_type`につきちょうど1行のみ`true`(ステージ2追補) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 作成日時 |

`UNIQUE(project_id, doc_type, version)`(Phase 15)。生成の二重実行は409と画面のボタンの無効化で塞ぎ、それをすり抜けた並行実行もDBで止める。

**バージョニング方針**: 「再生成する」ボタン押下時は既存行を上書きせず新バージョンを追加する。同一`project_id`+`doc_type`につき直近3バージョンまで保管し、4件目が生成された時点で最も古いバージョンを削除する。

**(ステージ2診断で確定)** 上記のバージョン増分+直近3件保持というDBレベルの機構自体はMVP(ステージ1)で実装済みであり(`app/repositories/generated_document.py`の`create_version`)、ステージ2の「バージョン管理・履歴保持」機能はこの機構自体の変更ではなく、その上に被せる**UI(SCR-006 バージョン履歴管理画面)**の新設を指す。保持件数は3件キャップを維持し(拡張・撤廃はしない)、「復元」はUI上で選んだ過去バージョンの内容を**新バージョンとして追加**する(既存行の上書きはしない、この方針との一貫性を保つ)。

**(ステージ2動作確認後の改訂・上記の復元方針を置き換える)** 復元のたびに同じ内容のバージョンが増え、保持3件を無意味に消費してしまうため、「復元」は**新しい行を作らず、表示中バージョン(`is_current`)を指定バージョンへ切り替えるだけ**にする。バージョン番号が増えるのは再生成(`create_version`)のときのみで、新しく生成した版は自動的に`is_current=true`になる(それまでの`is_current`は外れる)。ドキュメント一覧(`GET /projects/{id}/documents`)は最新版ではなく`is_current=true`の版を返し、画面表示・ダウンロードの対象は常に表示中バージョンになる。バージョン履歴UIは表示中の版に「表示中」バッジを付ける。

#### ⑤ `prompt_templates` テーブル（※Should have対応）

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK, DEFAULT gen_random_uuid() | テンプレートID |
| name | VARCHAR(100) | NOT NULL | テンプレート名 (例: "Webアプリ向け") |
| target_type | VARCHAR(50) | NOT NULL | 対象システム種別 |
| system_prompt | TEXT | NOT NULL | LLMに与えるシステムプロンプト定義 |
| default_environment | JSONB | NULL可 | このテンプレート選択時にSCR-004のintake環境設定へプリフィルするデフォルト値。`intake.environment`([外部設計書](external_design.md) 2.5節3項)と同じ構造(`languages`/`frameworks`/`databases`/`deploy_targets`) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 作成日時 |

**(ステージ2診断で確定)** `system_prompt`の合流先は、4文書生成(`doc_generator_service.py`の`_DOC_TYPE_PROMPTS`、doc_type単位で固定)ではなく、**ヒアリングチャットのシステムプロンプト**(`chat_service.py`の`_HEARING_SYSTEM_PROMPT`)である。`projects.template_id`が設定されている場合、該当テンプレートの`system_prompt`をヒアリング開始時に合流させる。テンプレート自体は当面**固定シードデータ**(「Webアプリ向け」「API向け」の2件)とし、ユーザーによるCRUD機能は設けない(一覧取得APIのみ新設)。

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

#### ⑦ `uml_diagrams` テーブル(ステージ3、Phase 8で新設予定)

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK, DEFAULT gen_random_uuid() | 図ID |
| project_id | UUID | FK (`projects.id`), NOT NULL | プロジェクトID |
| view | VARCHAR(50) | NOT NULL | 設計ビュー(`structure`/`data`/`dataflow`等) |
| notation | VARCHAR(50) | NOT NULL | 図記法(`component`/`er`/`dfd`。初期実装対象) |
| subject | VARCHAR(255) | NOT NULL, DEFAULT '' | 同じ記法の中で図を識別するキー(component: `''`、ER: 全体なら`''`・部分図ならグループ名(詳細設計モードの段階3の ER は全体`''`の1枚だけ。Phase 18)、DFD: 処理名(詳細設計モードでは段階2の機能グループ名。Phase 17)。Phase 10で追加) |
| scope | JSONB | NULL可 | AIに渡した対象の選択(ER部分図の`{"tables": [...]}`。再生成で再利用する。Phase 10で追加) |
| semantic_model | JSONB | NOT NULL | 意味モデル(要素・関係。Single Source of Truth)。ER の列は任意の`constraints`・`description`、テーブルは任意の`description`を持つ(詳細設計モードのテーブル定義の正本。既定は空文字。Phase 18) |
| layout_model | JSONB | NULL可 | 自動レイアウト結果(ノード座標・辺の折れ点・辺ラベルの中心`label_pos`(Phase 12)。手動移動後は折れ点とラベル位置を破棄しsmoothstep/orthogonalEdgeStyleに委ねる) |
| style_model | JSONB | NULL可 | 表示スタイル |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'draft' | `draft`/`reviewing`/`approved`/`exported`(遷移規則は`app/uml/domain/status.py`。保存・自動レイアウトで`reviewing`、承認で`approved`、出力で`exported`、AI再生成で`draft`。Phase 12) |
| version | INT | NOT NULL, DEFAULT 1 | 楽観ロック用バージョン |
| generation_status | VARCHAR(20) | NOT NULL, DEFAULT 'completed' | AI生成の状態(`generating`/`completed`/`failed`)。レビューの状態`status`とは別の軸(Phase 10で追加) |
| generation_error | TEXT | NULL可 | 直近の生成が失敗した理由(ユーザー向けの文言。Phase 10で追加) |
| source_doc_versions | JSONB | NULL可 | 生成元とした各`generated_documents`のバージョン番号(文書再生成時の陳腐化検知用) |
| created_at / updated_at | TIMESTAMP | NOT NULL | 作成・更新日時 |

所有権は`projects.user_id`経由で既存の`CurrentProjectDep`により検証する(既存パターンを踏襲)。

`UNIQUE(project_id, notation, subject)`(Phase 10)。AIによる再生成は同じ行を上書きする(semantic_modelを置換し、layout_modelを破棄、status='draft'、version+1)。`source_doc_versions`は生成時に`{"internal_design": <version>}`を記録する(詳細設計モードの段階2の DFD は、段階2の入力の版`{"stage:1": <version>, "doc:requirements": <version>}`を記録する。Phase 17。段階3の ER は`{"stage:2": <version>}`。Phase 18)。

#### ⑧ `data_items` テーブル(ステージ3、Phase 8で新設)

**データ辞書(`DataItem`、プロジェクト共通、ステージ3)**: DFDの全フローが参照する「名前+フィールド名の一覧」を保持し、自由記述ラベルを禁止する(処理ノードには入力→出力の対応と変換の1行説明を持たせる)。プロジェクト全図で共有することで、ER図のテーブルやAPIスキーマと同じデータ項目を指しているかを確認できる基礎にする。永続化の実体は**専用テーブルとして確定した**(Phase 8。項目単位のCRUD・一意性制約・「どこからも参照されないデータ項目がない」検証を素直に書けることを優先し、プロジェクト単位のJSONBには寄せなかった。詳細は[`textbook/decision-digest.md`](../textbook/decision-digest.md)参照)。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK, DEFAULT gen_random_uuid() | データ項目ID |
| project_id | UUID | FK (`projects.id`, ondelete CASCADE), NOT NULL | プロジェクトID |
| name | VARCHAR(255) | NOT NULL, `UNIQUE(project_id, name)` | データ項目名(プロジェクト内一意) |
| fields | JSONB | NOT NULL, DEFAULT `[]` | フィールド一覧。各要素は`{name, type?, required?}`(型・必須は任意項目) |
| created_at / updated_at | TIMESTAMP | NOT NULL | 作成・更新日時 |

#### ⑨ `uml_generation_runs` テーブル(ステージ3、Phase 10で新設)

> **[Phase 24 で確定 ── 〈`uml_generation_runs`を使わない〉]** 当初〈簡易ドキュメントモードの設計図の生成の履歴を記録する〉→ 撤回。理由〈簡易モードの設計図を削除した(外部設計書 2.6節の撤回を参照)。テーブルは既存のデータを残すため消さず、書き込む処理は無い〉。


UML図のAI生成リクエスト1回分の履歴。一括生成の途中でクォータ超過・トークン上限等で止まった場合に、対象ごとの結果(生成済み/失敗/未着手)と理由をユーザーが確認できるようにする。図の数による上限は設けず、止まった理由と「再度の生成指示が必要なこと」をここで伝える。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK | 履歴ID |
| project_id | UUID | FK (`projects.id`, ondelete CASCADE), NOT NULL | プロジェクトID |
| notation | VARCHAR(50) | NOT NULL | 図記法 |
| requested | JSONB | NOT NULL | 受け付けた対象(`[{subject, diagram_id}]`、受け付け順) |
| status | VARCHAR(20) | NOT NULL | `running`/`completed`/`partial`/`failed` |
| results | JSONB | NOT NULL | 対象ごとの`{subject, diagram_id, outcome: succeeded\|failed\|skipped, reason_code, message}`。`reason_code`は`QUOTA_EXCEEDED`/`TOKEN_LIMIT`/`INVALID_OUTPUT`/`GENERATION_FAILED`/`STALE_GENERATION`(15分を超えて実行中のまま止まったものを回収した。Phase 15) |
| started_at / finished_at | TIMESTAMP | started_at NOT NULL | 開始・終了日時 |

#### ⑩ `design_stages` テーブル(ステージ4、Phase 15で新設)

詳細設計モード([外部設計書](external_design.md) 2.7節)の段階ごとの成果物と承認状態。方針はPhase 14で確定し、カラムの詳細はPhase 15で確定した([`textbook/Phase-15/Phase-15-2.md`](../textbook/Phase-15/Phase-15-2.md))。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK | 段階ID |
| project_id | UUID | FK (`projects.id`, ondelete CASCADE), NOT NULL | プロジェクトID |
| stage | SMALLINT | NOT NULL, CHECK 1〜8 | 段階番号(1〜8。段階7 実装計画・段階8 実装手順書も同じ承認の流れに乗せる。段階8は Phase 27 で足した(Alembic `c9d0e1f2a3b4`)。3.3節「5. 実装手順書」) |
| status | VARCHAR(20) | NOT NULL | `draft`(AIの下書き)/`regenerated`(内容のある段階をAIが作り直した・未承認。画面は「再生成済(未承認)」。Phase 16)/`reviewing`(人が保存した)/`approved`。画面の「未着手」(行が無い)と「古い」(入力が承認時から変わった)は保存せず、`app/detailed_design/stages.py`の`derive_states`が導く |
| model | JSONB | NULL可 | 段階の意味モデル(機能一覧・処理概要表・CRUD図・モジュール一覧・手順・処理ロジック等の表)。図(DFD・ER・構成図)は既存の`uml_diagrams`・`data_items`を使う |
| version | INT | NOT NULL | 楽観ロック用バージョン。保存で+1、承認では増やさない(承認済みを保存すると`reviewing`に戻る) |
| approved_version | INT | NULL可 | 最後に承認したときの`version` |
| generation_status | VARCHAR(20) | NULL可 | AIの下書きの生成の状態(`generating`/`completed`/`failed`。NULLはまだ生成していない)。レビューの状態`status`とは別の軸(UML図と同じ)。生成中は、その段階の生成・保存・承認を409(`DESIGN_STAGE_GENERATION_IN_PROGRESS`)にする(Phase 16) |
| generation_error | TEXT | NULL可 | 直近の生成が失敗した理由(ユーザー向けの文言。Phase 16) |
| generation_started_at | TIMESTAMP | NULL可 | 生成を始めた時刻。15分を超えて生成中のままなら、生成の受け付け時と一覧の取得時に`failed`へ戻す(Phase 16) |
| input_fingerprint | JSONB | NULL可 | 承認したとき・AIの下書きを生成したとき(Phase 16)に入力にした前段の版(`{"stage:<n>": 承認済みの版, "doc:<doc_type>": 表示中の版}`)。今の値と「等しくない」ものがあれば「古い」と判定する(Phase 13の`source_doc_versions`と同じ考え方)。承認済みでない段階の今の値は`null`なので、前の段階を編集した時点で後ろの段階が古くなり、古さは後ろへ順に伝わる |
| approved_model | JSONB | NULL可 | 直前に承認したときの`model`の写し(1件だけ。ステージ7、Phase 43、Alembic `e5f6a7b8c9d1`)。次の承認で今の`model`と要素の単位で比べ、変更の影響を求める。段階3の写しには、承認したときの ER のテーブル定義(`er_snapshot`)を添える。既存の行は、承認の後に変わっていない行にだけ写しを入れた |
| impact | JSONB | NULL可 | 他の段階・文書・この段階の変更から届いた見直しの印(`{changes: [{source, key, change, stage, label, before, after, new_key}], marks: [{key, label, stage, path, reason, sources, reviewed}]}`。Phase 43)。段階を承認すると消える。他から届いた未確認の印があると承認できない(409 `DESIGN_STAGE_UNREVIEWED_IMPACT`) |
| created_at / updated_at | TIMESTAMP | NOT NULL | 作成・更新日時 |

`UNIQUE(project_id, stage)`。段階ごとの入力は`STAGE_INPUTS`(1: 外部設計 / 2: 段階1+要件定義 / 3: 段階2 / 4: 段階1〜3+要件定義 / 5: 段階2・4 / 6: 段階5 / 7: 段階1〜6+要件定義・外部設計)。入力がそろっていない段階は保存も承認もできない(409 `DESIGN_STAGE_LOCKED`)。前の段階を承認し直しても後ろの段階は自動で作り直さず、陳腐化の表示にとどめる(再生成は人が指示する。古い段階は内容を変えずに「承認し直す」こともできる)。プロジェクトのモードは`projects.mode`(②`projects`テーブル)で持つ。`design_stages`の行を持つのは`mode='detailed'`のプロジェクトだけ。

**段階1の`model`の形(Phase 16で確定)**: `{groups: [機能グループ名], functions: [{id: "F-01", name, kind: "API"|"API+バッチ"|"バッチ"|"画面"|"その他", trigger, screens: [画面ID], group_initial, group, summary}], next_number}`(`app/detailed_design/function_list.py`の`FunctionListModel`)。`kind`の「画面」は、サーバーを呼ばずに画面の中で完結する非自明な演算・描画で、`trigger`は`SCR-005: <操作>`の形。`group_initial`はAPIのパスから決定的に作った初期値(APIでない処理はAIの提案)、`group`は人の確定値。`next_number`は次に振る処理IDの番号で、消えた番号は再利用しない。段階ごとの検証(`app/detailed_design/validation.py`の`STAGE_VALIDATORS`)にエラーがあると承認できない(409 `DESIGN_STAGE_INVALID`)。警告は承認を止めない。検証の結果は保存せず、取得のたびに計算して`issues`で返す([`textbook/Phase-16/Phase-16-2.md`](../textbook/Phase-16/Phase-16-2.md))。


#### ⑪ `hearing_points` テーブル(ステージ6、Phase 34で新設)

ヒアリングの観点ごとの状態([外部設計書](external_design.md) 2.9節)。方針は Phase 33 で決めた([`textbook/Phase-33/Phase-33-2.md`](../textbook/Phase-33/Phase-33-2.md) 決定1)。カラムは Phase 34 で確定した([`textbook/Phase-34/Phase-34-1.md`](../textbook/Phase-34/Phase-34-1.md))。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK | |
| project_id | UUID | FK (`projects.id`, ondelete CASCADE), NOT NULL | プロジェクトID |
| point_key | VARCHAR(40) | NOT NULL | 観点のキー(`scale`・`availability` など。観点の定義はコードに持つ) |
| status | VARCHAR(20) | NOT NULL | `decided`(ユーザーが決定)/`adopted`(AI の提案を採用)/`open`(未決)/`not_applicable`(対象外) |
| summary | TEXT | NOT NULL | 決めたこと |
| evidence | JSONB | NULL可 | 根拠の発言(`chat_histories.id` の文字列のリスト。利用者側の発言だけ) |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

`UNIQUE(project_id, point_key)`。判定のたびに全観点(16行。Phase 47 から20行)をまとめて書き直す。完了は「規模で決まる必須の観点が、すべて`open`以外」をコードが判定する(LLM には判定させない)。規模は`projects.hearing_scale`(VARCHAR(20) NULL。`personal`/`internal`/`public`)に持ち、未決の間は「個人・小規模」の列で必須を数える。`projects.hearing_check`は、表から作った完了判定(`is_sufficient`・`summary`=表から組み立てたまとめ・`missing_points`=未決の必須の名前)を同じ形で保存する。判定に失敗したら`hearing_check`だけを消し、表は前のまま残す(行があって`hearing_check`が無い = 表が直近の発言を反映していない)。行が無く`hearing_check`だけがあるのは以前のプロジェクトで、5条件の判定をそのまま返す(次の発言から観点の表で判定する)。

#### ⑫ `user_model_settings` テーブル(ステージ9、Phase 67で新設)

用途ごとに選んだ provider とモデル([外部設計書](external_design.md) 2.12節「マイページ」)。`user_id` が null の行はシステムの既定値で、`scripts/seed.py` が `.env` のモデル(`GEMINI_MODEL`・`REVIEW_MODEL`・`JUDGE_MODEL`)で書く。ユーザーが選ばない用途は行を持たず、既定値に従う。決定の経緯は [`textbook/Phase-67/Phase-67-2.md`](../textbook/Phase-67/Phase-67-2.md)。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK | |
| user_id | UUID | FK (`users.id`, ondelete CASCADE), NULL可 | ユーザーID(null はシステムの既定値) |
| purpose | VARCHAR(20) | NOT NULL | `chat`/`generation`/`review`/`judge` |
| provider | VARCHAR(20) | NOT NULL | `gemini`/`claude` |
| model | VARCHAR(100) | NOT NULL | モデル ID(選べるモデルの表 `app/ai/llm/catalog.py` にあるもの) |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

`UNIQUE(user_id, purpose) NULLS NOT DISTINCT`(既定値の行も用途ごとに1行。PostgreSQL 15 以降)。既定値の行がまだ無い DB では、読み出しのときに `.env` の値で補う。

#### ⑬ `user_api_keys` テーブル(ステージ9、Phase 67で新設)

ユーザーが provider ごとに1つ登録する API キー。キーは Fernet で暗号化して持ち(鍵は環境変数 `ENCRYPTION_KEY`)、画面に出すのは末尾の4文字だけ。システムの既定のキーは環境変数に残し、この表には入れない。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK | |
| user_id | UUID | FK (`users.id`, ondelete CASCADE), NOT NULL | ユーザーID |
| provider | VARCHAR(20) | NOT NULL | `gemini`/`claude` |
| encrypted_key | TEXT | NOT NULL | 暗号文(Fernet のトークン) |
| key_hint | VARCHAR(8) | NOT NULL | 末尾の4文字(平文) |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

`UNIQUE(user_id, provider)`。登録し直すと暗号文と末尾を置き換える。
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
│   ├── repositories/    # データアクセス層 (DBへのCRUD操作)
│   └── uml/             # UML設計図パイプライン(ステージ3。既存レイヤーの外側に独立パッケージとして追加、Phase 8〜)
│       ├── domain/       # Semantic/Layout/StyleモデルのPydantic定義
│       ├── generation/   # AI生成(内部設計書の節抽出・LLM出力スキーマ・プロンプト・変換・失敗の分類。Phase 10)
│       ├── layout/       # 自動レイアウト(別プロジェクトの自作エンジンを移植。Phase 9)
│       ├── export/       # draw.io Generator / SVG出力(決定的、AI非依存)
│       ├── sync/         # 内部設計書への差し込み(document_writer。Phase 13)
│       └── validation/   # ID重複・参照切れ・DFD規則等の検証
```

* **`chat_service.py`**:
  * （※ステージ2診断で確定）`projects.template_id`が設定されている場合、該当`prompt_templates.system_prompt`をヒアリング開始時のシステムプロンプトへ合流させる(3.2節⑤参照)。
  * プロジェクト作成時、`intake`(初期ヒアリング入力)を`sender='intake'`の`chat_histories`行として永続化する。添付ファイルがある場合は`intake_files`のテキスト化(後述)も行い、その`extracted_text`も`sender='intake'`の`chat_histories`行(ファイルごと、またはintake本体行への追記)として併せて永続化する。ユーザーからの入力とこれまでの `chat_histories`(intake行・添付ファイル由来の行を含む)をLangChainのメモリ（Memory）にロードし、LLMへ送信することで、チャット開始直後のAIの最初の発話に反映する。
  * **添付ファイルのテキスト化**: `txt`/`md`はファイル内容をUTF-8テキストとしてそのまま読み込む。`pdf`は既存の`app/ai/llm/gemini.py`のGeminiクライアントを流用し、ファイルをそのまま渡してLLMのネイティブなファイル理解でテキスト化する(新規のPDF解析ライブラリは追加しない)。結果は`intake_files`テーブルに保存する(3.2節参照)。
  * ヒアリングが十分な状態に達したか（あるいはユーザーが生成を要求したか）を判定するロジックを保持。判定基準([外部設計書](external_design.md) 2.3節SCR-004参照): (1)目的・課題の明確化、(2)コア機能が最低1つ以上「誰が・何を・なぜ」のレベルで具体化、(3)想定ユーザー像の把握、(4)MVPスコープの認識合わせ、(5)環境設定未入力時は技術的制約の確認、をすべて満たしたら「十分」と判定する。十分と判断した場合は、即座に生成へ進まず、構造化した要件サマリをユーザーに提示して明示的な承認を得てから次のステップ（`doc_generator_service.py` の呼び出し）に進む。
  * **判定してから返信する(ゴール3後の調整)**: `stream_reply`は、ユーザーの発言を保存したら先に`check_completion`を呼び、結果を`projects.hearing_check`に保存する。十分なら LLM で返信を作らず、判定の`summary`から決まった形の返信(サマリ+「この内容で設計書を生成する」を押す案内)を流す。足りなければ、`missing_points`(発話の回数が足りないことを示す点は除く)をシステムプロンプトに「まだ確認できていない観点」として足して返信を作る。判定に失敗(`GenerationFailedError`)したら、`hearing_check`を NULL にして通常の返信を作る(チャットは止めない)。`GET /hearing-completion`は`stored_completion`で保存値を返すだけで、LLM を呼ばない。`_HEARING_SYSTEM_PROMPT`には、確定の確認・サマリ・設計書の本文をチャットに書かないよう指示する。以前は判定(画面が返信の後に GET で別に呼ぶ)と返信が互いを知らずに動き、AIがまだ質問しているのにボタンが出たり、AIがチャットで確定を求めたり要件定義書を書き始めたりした。
  * **`completed → revising`遷移**: `project.status == "completed"`の状態でユーザーが新規チャットメッセージを送信すると、そのメッセージを永続化する前に`project.status`を`revising`(修正中)へ変更する。「チャットに戻る」操作は必ずしも修正指示を意味しないため、この遷移は実際にメッセージを送信した時点で初めて発生させ、チャット画面を開いただけでは発生させない。
* **`doc_generator_service.py`**:
  * ヒアリング完了時、「要件定義」「外部設計」「内部設計」「実装計画」のそれぞれに特化したプロンプトを、この順に**連鎖的に**実行する。要件定義のみチャット全履歴をコンテキストとしてインプットし、以降の3文書は生の対話履歴を再解釈せず、前段で確定した文書だけを入力にする(外部設計は要件定義を、内部設計は要件定義+外部設計を、実装計画は要件定義+内部設計を入力にする)。こうすることで4文書間の記述の一貫性を確保する。
  * バックグラウンドタスクとして非同期実行され、進捗や結果をデータベース (`generated_documents`) に保存。`generate()`開始時点の`project.status`(`interviewing`または`revising`)を保持しておき、`generating`への変更を経て、成功時は`completed`へ、失敗時は保持していた開始時点のステータスへ差し戻す(`revising`からの再生成に失敗した場合に`interviewing`へ戻ってしまい「生成済みだった」という文脈を失うことを防ぐ)。
  * **内部設計書の固定形式の見出し(Phase 10)**: UML図の生成対象を決定的に列挙できるよう、内部設計書プロンプトで3.2節のテーブル見出しを`### テーブル: <テーブル名>`、3.3節の「処理別データフロー」小節の処理見出しを`#### DF-<連番>: <HTTPメソッド> <パス>`(バッチは`<バッチ名>`)に固定する。各処理の下には「元/データ/変換/先」の表と`- データ項目: <名前>(<フィールド…>)`を書かせる。
  * **生成の受け付け・失敗・固着(Phase 15)**: 生成の要求(`POST /generate`)の時点で`generating`にし、生成中なら409(`DOC_GENERATION_IN_PROGRESS`)にする。失敗したときは rollback で途中の版と古い版の削除を取り消してから、状態を戻し、失敗の通知(生の例外の文字列は含めない)だけを commit する。15分を超えて`generating`のままのプロジェクトは、プロジェクトの取得時と生成の要求時に、文書があれば`revising`、無ければ`interviewing`へ戻す(中断の通知をチャットに残す)。
  * **モードごとの生成(ステージ4、Phase 15)**: `projects.mode='simple'`は今と同じく4文書を連鎖生成する。`'detailed'`は要件定義・外部設計の2文書だけを生成し(自己診断つき)、内部設計・実装計画は詳細設計モードの段階(3.3節「4.」)へ引き継ぐ。
  * **外部設計書のAPI一覧(Phase 16)**: 外部設計書プロンプトに「2.6 API一覧」(メソッド/パス/概要/関連画面の表)を求める指示を足す。両方のモードで同じ。詳細設計モードの段階1が、機能グループの初期値をAPIのパスから決め、下書きに漏れたAPIを照合する材料にする。内部設計書プロンプトの3.3節のAPI表は、2.6と同じメソッド・パスを使い、内部の担当の観点で概要を書かせる([`textbook/Phase-16/Phase-16-1.md`](../textbook/Phase-16/Phase-16-1.md))。
  * **実装計画書の WBS(ゴール3後の調整)**: 4.2のタスクは番号を付けないチェックボックス(`- [ ] タスク内容`)で書かせる。LLM が自分で振った番号は、区分をまたいで重複した(実際の生成で、フロントエンドの先頭が「2.2」になった)。
    > **[Phase 31 で確定 ── 〈WBS のタスクに番号を付けない〉]** 当初〈4.2 のタスクは番号の無い層別のチェックボックス〉→ 撤回。理由〈簡易モードの実装手順書が、WBS を作業単位として決定的に読むため。マイルストーン`### M-01: 名前 ── 【Must】`の中の縦割りのタスク`- [ ] M-01-T01 [機能] タスク名`(字下げした「処理: DF-n」「依存:」「モジュール:」「環境・設定:」の欄)の決まった書式にした。番号の重複は、ID を並び順から導き、書かれた ID と違えば軽微の指摘にすることで扱う(3.3節「5. 実装手順書」の簡易ドキュメントモード)〉。
  * **モジュール一覧の表(ステージ4、Phase 15)**: 簡易ドキュメントモードの内部設計書プロンプトの3.3節に、ファイル単位の「モジュール一覧」(パス/層/責務/主な依存先)の表を求める指示を足す。詳細設計モードの段階4と同じ列で、簡易ドキュメントモードでもファイル単位の責務が分かるようにする(Phase 14の決定#6)。
  * **自己診断ステップ**: 4文書の生成完了後、生成した文書自体を入力として追加のLLM呼び出しを行い、不足・不明瞭な点を「最重要/中程度/軽微」の3段階に分類して抽出する([要件定義書](requirements.md) 1.4節「ドキュメント自己診断機能」)。抽出結果は`sender='others'`の`chat_histories`行として保存し、ユーザーへの提示は`chat_service.py`側のチャット表示ロジックが担う。

### 2. APIエンドポイント一覧

| メソッド | パス | 概要 | 認証要否 |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/auth/register` | 新規ユーザー登録 | 不要 |
| **POST** | `/api/v1/auth/login` | ログイン（JWT発行） | 不要 |
| **POST** | `/api/v1/projects` | 新規プロジェクト作成(初期ヒアリング入力を`intake`として受け取る。ステージ4では`mode`(`simple`/`detailed`、省略時`simple`)も受け取る。添付ファイル最大3件・txt/md/pdfのみを伴う場合は`multipart/form-data`になる。[外部設計書](external_design.md) 2.5節3項・5項参照) | 必要 |
| **GET** | `/api/v1/projects` | ユーザーのプロジェクト一覧取得(ステージ9 で`q`・`mode`・`status`(繰り返して複数)・`page`を受け、`{items, total}`を返す。1ページ10件。Phase 65) | 必要 |
| **GET** | `/api/v1/projects/{id}` | 特定プロジェクトの詳細・状態取得(添付ファイルのサマリ ── ファイル名・形式・`status` ── を含む。`extracted_text`本文は含めない) | 必要 |
| **POST** | `/api/v1/projects/{id}/chat` | チャットメッセージ送信・AI応答取得（SSE）。本文は`{message, card_answers: [{card_id, option}], continue_optional}`(message と card_answers のどちらか一方は要る。Phase 35。`continue_optional`は必須がそろった後に任意の観点を続けるとき。Phase 35 完了後の調整)。応答は本文`data: {"delta"}`・選択肢カード`event: cards`(`data: {"cards": [...]}`)・`data: [DONE]`の順。途中で失敗したときは`event: error`(`data: {code, detail}`)を送って終える(200を返した後のため。発話は保存しない。Phase 15。古いカード・回答済みのカードへの回答は`INVALID_CARD_ANSWER`) | 必要 |
| **GET** | `/api/v1/projects/{id}/chat` | 特定プロジェクトのチャット履歴取得 | 必要 |
| **PUT** | `/api/v1/projects/{id}/hearing-points/{key}` | 観点の表の画面から、未決の観点を「対象外(後で決める)」にする(本文`{status: "not_applicable"}`のみ)。LLM は呼ばず、完了判定をその場で表から作り直し、作り直した観点の表を返す。知らないキーは 404、未決でない観点・生成中は 409(Phase 35 完了後の調整) | 必要 |
| **POST** | `/api/v1/projects/{id}/generate` | 設計書の自動生成トリガー（非同期。簡易ドキュメントモードは4種、詳細設計モードは要件定義・外部設計の2種。生成中は409 `DOC_GENERATION_IN_PROGRESS`。Phase 15。本文の任意の`{start_from}`で再生成の起点を選ぶと、その文書から下流だけを作り直し、上流は表示中の版を入力に使う。モードに無い起点は400 `GENERATION_START_INVALID`、上流の文書が無ければ409 `GENERATION_UPSTREAM_MISSING`。Phase 53 の完了後の調整） | 必要 |
| **GET** | `/api/v1/projects/{id}/generation-progress` | 生成の進み具合`{targets, done, current}`(作り直す文書・できた文書・今作っている文書)。生成していなければ null。生成の間だけ Redis の`doc_generation:{project_id}`に置き、終わったら消す(保存は今どおり最後にまとめて行う)。Phase 53 の完了後の調整 | 必要 |
| **GET** | `/api/v1/projects/{id}/documents` | 生成された設計書一覧(doc_typeごとの現在表示中(`is_current`)の版のみ)・内容の取得 | 必要 |
| **POST** | `/api/v1/projects/{id}/documents/requirements/rows/{req_id}/adopt` | 要件定義書の現在の版の推測の要件を「採用」にする(LLM は呼ばない。同じ版の model と md を書き換え、版は増やさない)。要件が無い・model の無い版は 404 `REQUIREMENT_NOT_FOUND`、推測でない要件・生成中は 409(Phase 36) | 必要 |
| **GET** | `/api/v1/projects/{id}/documents/{doc_id}/download` | 指定Markdownドキュメントのダウンロード | 必要 |
| **GET** | `/api/v1/projects/{id}/documents/{doc_type}/versions` | （※ステージ2、SCR-006向け）指定doc_typeの保持済みバージョン一覧(最大3件)を取得 | 必要 |
| **POST** | `/api/v1/projects/{id}/documents/{doc_type}/versions/{version}/restore` | （※ステージ2、SCR-006向け）指定バージョンを表示中(`is_current`)に切り替える。新バージョンは作らない(3.2節バージョニング方針参照) | 必要 |
| **GET** | `/api/v1/prompt-templates` | （※ステージ2、SCR-003向け）選択可能なプロンプトテンプレート一覧の取得(固定シードデータ) | 必要 |
| **POST** | `/api/v1/projects/{id}/uml/diagrams` | （※ステージ3、Phase 10）UML設計図のAI生成の受け付け(`202`、非同期。`{notation, subjects: [{subject, tables?}]}`、1回5件まで。同じ対象の図は上書き) | 必要 |
| **GET** | `/api/v1/projects/{id}/uml/diagrams` | （※ステージ3、Phase 10）UML図の一覧(`generation_status`のポーリングに使う。15分を超えて生成中のまま止まった図は、返す前に`failed`へ戻す。Phase 15) | 必要 |
| **GET** | `/api/v1/projects/{id}/uml/candidates` | （※ステージ3、Phase 10）生成対象の候補(内部設計書から列挙したDFDの処理・ERのテーブル) | 必要 |
| **GET** | `/api/v1/projects/{id}/uml/generation-runs` | （※ステージ3、Phase 10）AI生成の履歴(対象ごとの結果と、止まった理由) | 必要 |
| **GET** | `/api/v1/projects/{id}/uml/diagrams/{diagram_id}` | （※ステージ3、Phase 8）UML図の取得 | 必要 |
| **PUT** | `/api/v1/projects/{id}/uml/diagrams/{diagram_id}` | （※ステージ3、Phase 8）UML Model全体の更新(`version`による楽観ロック) | 必要 |
| **POST** | `/api/v1/projects/{id}/uml/diagrams/{diagram_id}/validate` | （※ステージ3、Phase 8）バリデーション実行 | 必要 |
| **GET** | `/api/v1/projects/{id}/uml/data-items` | （※ステージ3、Phase 8）データ辞書一覧取得 | 必要 |
| **POST** | `/api/v1/projects/{id}/uml/data-items` | （※ステージ3、Phase 8）データ項目作成 | 必要 |
| **PUT** | `/api/v1/projects/{id}/uml/data-items/{item_id}` | （※ステージ3、Phase 8）データ項目更新 | 必要 |
| **DELETE** | `/api/v1/projects/{id}/uml/data-items/{item_id}` | （※ステージ3、Phase 8）データ項目削除 | 必要 |
| **POST** | `/api/v1/projects/{id}/uml/diagrams/{diagram_id}/layout` | （※ステージ3、Phase 9）自動レイアウトの実行 | 必要 |
| **POST** | `/api/v1/projects/{id}/uml/diagrams/{diagram_id}/approve` | （※ステージ3、Phase 12）承認(`{version}`。draft/reviewing→approved。versionの不一致・承認済みは409、配置の無い要素・バリデーションNGは400。状態が変わってもversionは増やさない) | 必要 |
| **GET** | `/api/v1/projects/{id}/uml/diagrams/{diagram_id}/export/drawio` | （※ステージ3、Phase 12）`.drawio`ダウンロード(approved/exportedのみ。それ以外は409。成功でapproved→exported) | 必要 |
| **GET** | `/api/v1/projects/{id}/uml/diagrams/{diagram_id}/export/svg` | （※ステージ3、Phase 12）SVGダウンロード(同上。draw.ioと同じ中間表現から書き出す) | 必要 |
| **POST** | `/api/v1/projects/{id}/uml/reflect` | （※ステージ3、Phase 13）承認済みの図すべてを内部設計書の表示中の版へ反映し直す(`{reflected}`。版は増やさない。内部設計書が無ければ404) | 必要 |
| **GET** | `/api/v1/projects/{id}/uml/embeds` | （※ステージ3、Phase 13）文書のプレビューに差し込む図(承認済みの図のSVG)と、図と文書の食い違い(`source_outdated`・`doc_state`)。状態は変えない | 必要 |
| **GET** | `/api/v1/projects/{id}/uml/bundle` | （※ステージ3、Phase 13）内部設計書のmd+反映済みの図(SVG・drawio)のzip。zipに入れた図はapproved→exported | 必要 |
| **GET** | `/api/v1/projects/{id}/design-stages` | （※ステージ4、Phase 15）段階1〜7の状態(`state`・`is_open`・`missing_inputs`・`version`・`approved_version`・`model`。Phase 16で`generation_status`・`generation_error`・`issues`を追加)。未着手の段階も含む。止まった生成(15分超)はここで回収する。Phase 31 で、簡易ドキュメントモードのプロジェクトには段階8だけを返すようにし(それまでは409 `DESIGN_STAGES_NOT_AVAILABLE`)、`mode`(プロジェクトのモード)と`plan`(段階8だけ。作業単位。詳細設計モードは段階7、簡易モードは実装計画書の WBS を読んだもの)を足した。モードに無い段階の保存・承認・生成は409 `DESIGN_STAGES_NOT_AVAILABLE` | 必要 |
| **PUT** | `/api/v1/projects/{id}/design-stages/{stage}` | （※ステージ4、Phase 15）段階の内容の保存(`{version, model}`。未着手は`version: null`で作る。楽観ロック。承認済みは`reviewing`に戻る。開いていない段階は409 `DESIGN_STAGE_LOCKED`) | 必要 |
| **POST** | `/api/v1/projects/{id}/design-stages/{stage}/approve` | （※ステージ4、Phase 15）段階の承認(`{version}`。下書き・レビュー中・古いが対象。承認時に`input_fingerprint`を記録する。versionは増やさない。承認済みで古くない・内容が空は409 `DESIGN_STAGE_NOT_APPROVABLE`。段階ごとの検証にエラーがあれば409 `DESIGN_STAGE_INVALID`(Phase 16)) | 必要 |
| **GET** | `/api/v1/projects/{id}/design-stages/impact` | （※ステージ7、Phase 43）変更の影響(`{stages: [{stage, changes, marks, open, reviewed}], regeneration_targets: [{stage, key, label}]}`)。記録した印に、承認の後に編集してまだ承認していない段階から届く印(`pending: true`。記録しない)を足す。再生成の候補は段階5・6・8 の未確認の印の要素 | 必要 |
| **POST** | `/api/v1/projects/{id}/design-stages/{stage}/impact/review` | （※ステージ7、Phase 43）段階の印を確認済みにする(`{keys, reviewed}`。`reviewed: false`で未確認に戻す。知らないキーは無視。段階の`version`は変えない)。応答は段階1つ分の`{stage, changes, marks, open, reviewed}` | 必要 |
| **GET** | `/api/v1/projects/{id}/design-stages/document` | （※ステージ4、Phase 22）詳細設計書の zip(`detailed_design.html`・`detailed_design.md`・`diagrams/*.svg|.drawio`。Phase 23 で実装計画`implementation_plan.html`・`.md`を足した)。0件で承認した段階6は「省略」。zip に入れた図は`exported`になる。段階1〜7がすべて承認済み(古くない)でなければ409 `DESIGN_DOCUMENT_NOT_READY`(Phase 30 の調整。それまでは、いつでもダウンロードでき、未承認の章は「未承認」と書いた)。詳細設計モードでなければ409 `DESIGN_STAGES_NOT_AVAILABLE`(簡易モードは段階8だけを持つため)。テスト仕様書の今の版が古くなければ`test_spec.md`も入れる(Phase 57) | 必要 |
| **GET** | `/api/v1/projects/{id}/design-stages/procedure-document` | （※ステージ5、Phase 30）実装手順書の zip(`implementation_procedure.zip`。直下に`index.md`・`implementation_procedure.html`・単位ごとの md・`ai/<単位ID>.md`)。段階8が承認済み(古くない)でなければ409 `DESIGN_DOCUMENT_NOT_READY`。簡易ドキュメントモードのプロジェクトも、段階8を承認すれば同じ形で落とせる(Phase 31。それまでは409 `DESIGN_STAGES_NOT_AVAILABLE`) | 必要 |
| **POST** | `/api/v1/projects/{id}/design-stages/{stage}/generate` | （※ステージ4、Phase 16）段階のAIの下書きの生成を受け付ける(202。段階は`generating`になり、裏で生成して`draft`・version+1で保存する。画面は一覧をポーリングする)。生成に対応していない段階は409 `DESIGN_STAGE_GENERATION_NOT_SUPPORTED`(Phase 16は段階1だけ。Phase 28 で段階1〜8すべて)、生成中は409 `DESIGN_STAGE_GENERATION_IN_PROGRESS`、開いていない段階は409 `DESIGN_STAGE_LOCKED`。本文で対象を選べる: 段階5`function_ids`・段階6`logics`・段階8`unit_ids`(Phase 28) | 必要 |
| **GET** | `/api/v1/projects/{id}/design-stages/procedures/{function_id}/sequence` | （※ステージ5、Phase 29）段階5の処理1つのシーケンス図(`{function_id, svg, issues: [{step_id, code, message}]}`)。保存した手順(下書き・レビュー中を含む)と承認済みの段階4から毎回導き、保存しない。段階5が開いていなければ409 `DESIGN_STAGE_LOCKED`、段階5で選んでいない処理は404。簡易ドキュメントモードは409 `DESIGN_STAGES_NOT_AVAILABLE` | 必要 |
| **GET** | `/api/v1/projects/{id}/design-stages/units/{unit_id}/context` | （※ステージ5、Phase 28）段階8の作業単位1つが参照する設計の展開(`{unit_id, refs: [{kind, key, resolved, via, label, markdown, svg}], crosscutting, environment}`。`svg`は段階5の手順の参照のシーケンス図。Phase 29)。承認済みの段階1〜7から毎回導き、保存しない。段階8が開いていなければ409 `DESIGN_STAGE_LOCKED`、段階7に無い単位は404。簡易ドキュメントモードは4文書から導き、`kind`に`dataflow`(内部設計書の処理別データフロー)が加わる(Phase 31) | 必要 |
| **GET** | `/api/v1/projects/{id}/design-stages/units/{unit_id}/ai-markdown` | （※ステージ5、Phase 30）段階8の作業単位1つの AI 向けの版(`{unit_id, markdown, state, finding_total, critical}`。`state`は段階8の状態、`finding_total`・`critical`はその単位に残る未定義の件数と最重要の件数)。保存済みの手順書と承認済みの段階1〜7から組み立て、保存しない。段階8が承認済みでない・未定義が残るときは md の先頭で警告する。段階8が開いていなければ409 `DESIGN_STAGE_LOCKED`、段階7に無い単位・手順書の無い単位(未生成・段階7と合わない)は404。簡易ドキュメントモードは段階7の代わりに実装計画書の WBS と4文書から組み立てる(Phase 31) | 必要 |
| **DELETE** | `/api/v1/projects/{id}` | （※ステージ9、Phase 64）プロジェクトの削除(204。所有者だけ。他人・無いものは404 `RESOURCE_NOT_FOUND`。生成中も可)。削除の印を付けてすぐに返し、行と子の行(CASCADE)の物理削除はバックグラウンドで行う(3.3節 9項) | 必要 |
| **PATCH** | `/api/v1/users/me` | （※ステージ9、Phase 66）ユーザーネームの変更(`{user_name}`。前後の空白を除いて1〜255文字。外れれば422) | 必要 |
| **PUT** | `/api/v1/users/me/email` | （※ステージ9、Phase 66）メールアドレスの変更(`{new_email, current_password}`)。今のパスワードが合わなければ400 `CURRENT_PASSWORD_MISMATCH`、使われているメールは409。即時に変える(確認メールは送らない) | 必要 |
| **PUT** | `/api/v1/users/me/password` | （※ステージ9、Phase 66）パスワードの変更(`{current_password, new_password}`)。新しいパスワードは登録の画面と同じ規則(外れれば422)、不一致は400 `CURRENT_PASSWORD_MISMATCH`。その人の refresh を全部失効させ、今の端末には新しいアクセストークン(本文)と refresh(Cookie)を返す | 必要 |
| **GET** | `/api/v1/llm/catalog` | （※ステージ9、Phase 67）選べる provider・モデル(`{provider, model_id, label, note}`)と用途(`{purpose, label, description, recommend_low_cost}`)の表。静的(`app/ai/llm/catalog.py`) | 必要 |
| **GET** / **PUT** | `/api/v1/users/me/models` | （※ステージ9、Phase 67）用途ごとのモデルの取得・保存。PUT は`{choices: [{purpose, provider, model}]}`で選択の全体を置き換え、含めない用途は既定値に従う。応答は4用途の`{purpose, provider, model, is_default, key_missing, default_provider, default_model, selectable_providers}`。カタログに無いモデルは422 `MODEL_NOT_IN_CATALOG`、選べない provider は422 `MODEL_PROVIDER_KEY_REQUIRED` | 必要 |
| **GET** | `/api/v1/users/me/api-keys` | （※ステージ9、Phase 67）登録済みのキー(`{provider, key_hint, needs_reregister}`。キー本体は返さない)と`encryption_available` | 必要 |
| **PUT** / **DELETE** | `/api/v1/users/me/api-keys/{provider}` | （※ステージ9、Phase 67）provider ごとの API キーの登録(`{api_key}`。保存の前にモデルの一覧の取得で確かめる。無効は422 `API_KEY_INVALID`、確かめられないときは502 `API_KEY_CHECK_FAILED`、暗号の鍵が無いときは503 `ENCRYPTION_UNAVAILABLE`。試行はユーザーごとに1時間10回)・削除(204。無くても204。選択の行は残す) | 必要 |

> **[Phase 24 で確定 ── 〈簡易モードの設計図の API を削除〉]** 当初〈上の表の`POST /uml/diagrams`(生成)・`/uml/candidates`・`/uml/generation-runs`・`/uml/reflect`・`/uml/embeds`・`/uml/bundle`を提供する〉→ 撤回。理由〈簡易ドキュメントモードの設計図(SCR-007)を削除した([外部設計書](external_design.md) 2.6節の撤回を参照)。残りの`/uml/...`(図の取得・一覧・更新・検証・自動レイアウト・承認・出力、データ辞書)は、詳細設計モードの段階2〜4が使う〉。

### 3. UML設計図パイプラインの図↔文書対応(ステージ3、D5)

Stage 3(Phase 7〜)で追加するUML設計図パイプラインの図記法と、本文書内の対応セクションを以下のとおり確定する(要件整理は`appendix/stage3-requirements-organization.md`、決定事項D5は[decision digest](../textbook/decision-digest.md)参照)。

| 設計ビュー | 図記法 | 対応セクション |
| :--- | :--- | :--- |
| システム構造(モジュール) | コンポーネント図 | 本節「1. 主要処理ロジックの分割方針」 |
| データ構造 | ER図 | 3.2節「2. テーブル定義」 |
| 処理別データフロー(Must) | DFD | 本節の「処理別データフロー」小節(Phase 10で内部設計書プロンプトに追加済み。APIエンドポイント/バッチ単位の`#### DF-<n>`見出し。要素表は「元/データ/変換/先」) |
| 振る舞い(Should、Phase 14) | アクティビティ図 | [外部設計書](external_design.md) 2.2節「画面一覧・画面遷移フロー」 |

> **[Phase 14 で確定 ── 〈アクティビティ図を実装しない〉]** 当初〈旧Phase 14でアクティビティ図を追加する予定〉→ 撤回。理由〈ステージ3はPhase 13で終了した。振る舞いは詳細設計モードの「05 主要処理の手順」で扱う(本節「4. 詳細設計モード」)〉。

`internal_design`(本文書)にcomponent/ER/DFDを寄せているのは、`external_design.md`が画面・API等の利用者向け仕様のみを扱うのに対し、本文書の3.2/3.3節が既にモジュール構造・データモデルを扱っており、実装者向けの構造図・データ構造図の置き場として一貫するため。承認済みの図と要素表は、上記セクションにアンカーコメント(`<!-- uml:diagram:<diagram_id>:start v=<version> -->`〜`<!-- uml:diagram:<diagram_id>:end -->`)経由でプレビュー時にSVGとして差し込む(M9a、Phase 13)。内部設計書生成プロンプトへの「処理別データフロー」節の追加はPhase 10で実施済み。

**図の反映・アンカー・陳腐化(Phase 13で確定)**:
* **アンカー**: 図のIDを含むため、文書を生成するLLMには書かせず、反映のときにバックエンドが見出しを基準に挿入する(プロンプトは変えない)。挿入先はcomponentが`## 3.3`直下、ERが`## 3.2`直下、DFDが対象の`#### DF-<n>: <処理名>`直下。見つからなければ末尾の`## 付録: 設計図`節に入れる。同じ図のアンカーが既にあれば、その位置のまま中身を置き換える。`v=<version>`は反映したときの図の`version`で、文書の復元で古いアンカーも一緒に戻る。
* **反映**: 承認と同じトランザクションで、`is_current`の版の本文をアンカーの範囲だけ書き換える(版は増やさない。D1案A)。範囲の中身は、題名の注意書きと要素表(component: 名称/種別/説明/依存先、ER: カラムと関連、DFD: 元/データ/変換/先とデータ項目)。文書の再生成・復元でアンカーが消えた場合は、一括の再反映(`POST /uml/reflect`)で戻す。
* **陳腐化**: (a) 図が古い = `source_doc_versions.internal_design` ≠ 表示中の内部設計書の版(「等しくない」で比べる。復元で番号が下がるため)。(b) 文書が古い = アンカーの`v`と図の状態・`version`の食い違い(`reflected`/`not_reflected`/`outdated`/`not_applicable`)。文書チェーンに沿った下流への伝播はPhase 13b(M9b)で扱う。
  > **[Phase 14 で確定 ── 〈文書チェーンの伝播をM9bで扱わない〉]** 当初〈Phase 13b(M9b)で扱う予定〉→ 撤回。理由〈M9bを撤回した。前の段階の変更が後ろへ伝わる仕組みは、詳細設計モードの段階の陳腐化(3.2節⑩`design_stages.input_fingerprint`)として作る〉。
* 詳細は[`textbook/Phase-13/Phase-13-introduction.md`](../textbook/Phase-13/Phase-13-introduction.md)参照。

**DFD検証規則(Phase 10で確定)**: DFDは「APIエンドポイント/バッチごとに1枚」のフラットな構成に確定した(Phase 10)。診断8(`appendix/stage3-requirements-organization.md`)のDFD検証規則5点のうち「上位図と下位図の境界フローが一致する」は、上位図・下位図の階層を持たないため撤回した。「どこからも参照されないデータ項目がない」は、図単体ではなくプロジェクト内の全DFDを横断して判定する。詳細は[`textbook/Phase-10/Phase-10-4.md`](../textbook/Phase-10/Phase-10-4.md)参照。

**UML図のAI生成(Phase 10)**: `POST /uml/diagrams`は受け付け(検証・対象の図を`generating`化・履歴作成)までをリクエスト内で行い、生成自体はBackgroundTasksで対象を1件ずつ実行する。入力は内部設計書の現行版から記法ごとに必要な節だけを抽出する(component: 3.1+3.3、ER: 3.2(部分図は選んだテーブルのみ)、DFD: 3.2+対象のDF節+既存データ辞書)。構造化出力は`include_raw=True`で呼び、`finish_reason=MAX_TOKENS`(トークン上限。再試行しない)と解釈失敗(再試行する)を区別する。クォータ超過で止まった場合、残りの対象はLLMを呼ばずに未着手(skipped)として履歴に残す。同時実行はプロジェクトごとに1本。詳細は[`textbook/Phase-10/Phase-10-introduction.md`](../textbook/Phase-10/Phase-10-introduction.md)参照。

### 4. 詳細設計モード(ステージ4)

[外部設計書](external_design.md) 2.7節の詳細設計モードの内部の方針(Phase 14で確定)。構想は[`appendix/detailed-design-mode-organization.md`](../appendix/detailed-design-mode-organization.md)、経緯は[`textbook/Phase-14/Phase-14-1.md`](../textbook/Phase-14/Phase-14-1.md)参照。

* **正本は段階の意味モデル**: 詳細設計書(HTML・Markdown)は、承認済みの段階の意味モデル(`design_stages.model`と、図の`uml_diagrams`)から決定的に組み立てる表示である。散文を正本にしないため、図や表の変更を散文へ戻す処理(旧M9b)は要らない。
* **詳細設計書の章構成**: 01 機能(処理)一覧 / 02 データフロー / 03 データモデル / 04 ソフトウェア構造 / 05 主要処理の手順 / 06 処理ロジックの詳細(任意) / 07 横断事項(例外とHTTP・認証・トランザクション・ログ)。01〜06は段階1〜6と1対1。
  > **[Phase 22 で確定 ── 〈07 横断事項を Phase 22 の組み立てに含めない〉]** 当初〈07 横断事項まで組み立てる予定〉→ 保留。理由〈01〜06は段階1〜6の承認済みの意味モデルから組み立てるが、07 の元になる段階のデータが無い(段階7は実装計画)。07 をどう作るか(段階7と同時に生成するか、別の段階にするか)は Phase 23(段階7)で決める。経緯は[`textbook/Phase-22/Phase-22-introduction.md`](../textbook/Phase-22/Phase-22-introduction.md)参照〉。
  * **07 横断事項(Phase 23 で確定)**: 段階7(横断事項と実装計画)で、実装計画と一緒に作る。段階の数は1〜7のまま。段階7が承認済みなら07章を組み立て、それ以外は「未承認」と書く(01〜06章と同じ規則)。経緯は[`textbook/Phase-23/Phase-23-introduction.md`](../textbook/Phase-23/Phase-23-introduction.md)参照。
* **ID体系**:
  * 処理ID: `F-01`… 段階1で振り、再生成しても変えない(今の`DF-<n>`が再生成で振り直される問題を避ける)。以降の章はこのIDで互いを参照する。
  * 手順ID: `<処理ID>#<手順番号>`(`F-01#4`、分岐は`F-01#4a`)。文書全体で一意。
  * 処理ロジックID: `L-01`…
* **05と06の紐づけの正本**: 手順の行が持つ`logic`(L-ID)の1か所だけに持つ。06の「呼ばれる手順」、05の索引の「詳細(06)」、06の逆引き表、処理 × モジュールの関与表は、すべてそこから導く。組み立ての前に、手順が参照するL-IDが06に存在することを検証する(参照切れの検出)。
  > **[Phase 20 で確定 ── 〈手順の行に logic を持たせない〉]** 当初〈05と06の紐づけを手順の行の`logic`(L-ID)に持つ予定〉→ 撤回。理由〈段階6は段階5を入力にするため、段階6で関数を選ぶたびに承認済みの段階5の`logic`を書き換えることになる。すると段階5が差し戻され、段階6が「古い」になる循環が起きる。紐づけは、手順の行の(呼び出し先`callee`, 関数`call`)と、段階6の項目の(モジュール, 関数)の一致から導く。06の「呼ばれる手順」・05の詳細バッジと索引の「詳細(06)」・06の逆引き表はこの一致から導き、保存する紐づけは持たない。手順番号が編集で振り直されても紐づけは切れない。経緯は[`textbook/Phase-20/Phase-20-introduction.md`](../textbook/Phase-20/Phase-20-introduction.md)参照〉。
* **関与表の列**: 呼び出し先のうち、段階4のモジュール一覧のパスだけ(利用者・スケジューラ等の外部の役者は含めない)。
* **出力の組み立て**: HTML・Markdownとも、ステージ3のzip出力と同じ層(バックエンドの`app/uml/export`・`uml_sync_service`の並び)で組み立てる。HTMLは全文字をエスケープし、外部を読み込まない。Markdownはリンクを持たない。devex-uiのデモ(`src/features/detailed-design/demo/procedureModel.ts`の`toHtml`・`toMarkdown`)は形式の見本で、本実装はバックエンドへ移す。
* **詳細設計書の組み立て(Phase 22)**:
  * 純粋関数のパッケージ`app/detailed_design/document/`(`source`: 入力`DocumentSource`と章の状態 / `views`: 表の導出 / `markdown`・`html`: 書き出し)と、DB の読み取り・図の描画・zip を受け持つ`app/services/detailed_design_export_service.py`に分ける。devex-ui のデモは書式の見本として残す。
  * 章の状態: 段階が承認済み(古くない)なら本文を組み立てる。段階6が0件で承認済みなら「省略」。それ以外(未着手・下書き・レビュー中・古い)は「未承認」とだけ書き、途中の内容は出さない。ダウンロードはいつでもできる。
  * 導出: 手順番号・手順IDは`number_steps`・`step_id`、L-IDは`logic_id`、05↔06は手順の(callee, call)と`logic_key`の一致、関与表の列はモジュール一覧の並び(呼ばれたものだけ)、データ辞書の「使う処理」は DFD の線の端の処理の箱。CRUD 図の記号は`dfd_accesses`で3つに分ける(R が DFD の線から決まる / C・U・D の書き込みは DFD から決まり区別は人が確定 / DFD に描いていない分で人が確定)。HTML は色、md は印(なし・`+`・`*`)で書き分ける。
  * 載せる図: 承認済みの段階2の`dfd_groups`の DFD、段階3の ER、段階4の構成図のうち、承認済み(出力済みを含む)で配置のあるもの。描画はステージ3の zip と同じ`app.uml.export.render_diagram`(Phase 22 で`uml_sync_service`から移した。名前の重複除けの`unique_base`も同じ)。zip に入れた図は`exported`にする。
  * zip の中身: `detailed_design.html`・`detailed_design.md`・`implementation_plan.html`・`implementation_plan.md`(Phase 23)・`diagrams/*.svg`・`diagrams/*.drawio`。md は図を相対パスの画像(`![題](diagrams/x.svg)`)で載せる(章の間のリンクと生の HTML は持たない)。HTML は文字をすべて`html.escape`し、図の SVG だけはそのまま埋め込む(自前の出力エンジンが中の文字をエスケープ済みのため)。
* **機能グループ**: 段階1の下書きで、APIのリソース名(`/api/v1/<リソース>`、親の個別の対象に属するものは`/api/v1/<親>/{id}/<リソース>`の子のリソース名)から決定的に初期値を作り、人が確定する。APIのパスは外部設計書の「2.6 API一覧」から取る(Phase 16)。
* **段階1の下書き(Phase 16)**: AIには外部設計書から処理を列挙させるだけにし、処理IDと機能グループの初期値はコードで決める。再生成では、前の版の行とトリガー(メソッド+正規化したパス。APIでなければ名称)で突き合わせ、一致した行は処理IDと人が確定した機能グループを引き継ぐ。生成は受け付けとバックグラウンドの実行に分ける(`app/services/design_stage_generation_service.py`。UML図の生成と同じ形)。
* **段階2 データフロー(Phase 17)**:
  * `design_stages.model`(段階2)は`{dfd_groups, summaries}`(DFD を描く機能グループ・全処理の処理概要表`{function_id, input, process, output}`)だけ。DFD は`uml_diagrams`(notation=dfd、subject=機能グループ名)、データ辞書は`data_items`が正本で、model に複製しない(`app/detailed_design/data_flow.py`)。
  * 下書きは、処理概要表(LLM 1回)→ 選んだグループごとの DFD(1グループ LLM 1回、5グループまで)を順に呼び、段階・DFD・データ項目を1トランザクションで書く(失敗したらまとめて取り消す)。DFD の処理の箱は処理IDで、AIには`function_id`だけを書かせ、ステージ3の出力スキーマ`DfdGenerationOutput`に組み替えて写像(`app/uml/generation/mapper.py`)を再利用する(`app/detailed_design/data_flow_drafting.py`)。再生成では`dfd_groups`を引き継ぎ、選んだグループの DFD は同じ行を上書きする(承認はやり直し)。
  * 検証(`STAGE_VALIDATORS[2]`)は、承認済みの段階1の内容と DFD の要約を`StageSources`で受け取る。エラー: 処理概要表の過不足・重複、グループの上限・重複・不明、選んだグループの DFD が無い・生成中・未承認。警告: DFD を描くグループが1つも無い(`NO_DFD_GROUPS`。段階3の ER は DFD のデータストアとデータ辞書から下書きするので、テーブルが作られない。DFD を描く分を人が選ぶ原則は変えないので、エラーにはしない。ゴール3後の調整)、処理概要表の空欄、DFD の処理とグループの過不足。
  * 段階の外の正本の編集: 詳細設計モードで DFD を保存・自動レイアウトする、またはデータ項目を作成・更新・削除すると、承認済みの段階2を`reviewing`・version+1 に戻す(`DesignStageService.mark_edited`)。段階3が段階2の承認した版で陳腐化を判定するため。
* **CRUD図**: 段階2のDFDの線の向きから、R(ストア → 処理)とW(処理 → ストア)を決定的に作る。Wの C/U/D の区別と、DFDに描いていない処理の分は、AIが処理概要表から下書きし、人が確定する。
* **段階3 データモデル(Phase 18)**:
  * `design_stages.model`(段階3)は`{cells: [{function_id, table, ops, draft}]}`(CRUD 図のセル)だけ。`ops`は C・R・U・D をこの順に並べた文字列、`draft`は AI の下書きのまま人が確定していない印。ER は`uml_diagrams`(notation=er、subject=`''`の1枚)、テーブル定義は ER の列の`constraints`・`description`とテーブルの`description`が正本で、model に複製しない(`app/detailed_design/data_model.py`)。
  * R/W の導出: 段階2で DFD を描くと選んだグループの DFD について、データストア → 処理 を R、処理 → データストア を W とする。データストアと ER のテーブルは名前で突き合わせる(前後の空白を除いて小文字)。`merge_crud`は、読みの線のセルに R を足し、書き込みの線のセルは C/U/D が無くても空で残す(検証のエラーで人に決めさせる)。
  * 下書き: ER(LLM 1回。入力は DFD のデータストア名・データ辞書・処理概要表。出力スキーマは段階3専用で制約・説明つき)→ CRUD 図(LLM 1回。DFD の R/W を「決まったもの」として渡す)を順に呼び、ER と段階を1トランザクションで書く。再生成は置き換え(前の版の人の確定は引き継がない)。ER は同じ行を上書きし承認はやり直し(`app/detailed_design/data_model_drafting.py`、`_save_diagram`)。
  * 検証(`STAGE_VALIDATORS[3]`)は、ER の要約(`ErDiagramSummary`)と DFD の R/W(`DfdDiagramSummary.accesses`)を`StageSources`で受け取る。エラー: ER が無い・生成中・未承認、ER にテーブルが無い(`ER_EMPTY`。段階4・5の入力にならないため。実際の生成で、DFD を描かずに進めると ER が空のまま承認できた。ゴール3後の調整)、ER のテーブル名の重複(CRUD 図のセルを引く鍵のため)、セルの処理ID・テーブルが不明・重複、操作の形が不正、DFD の読みに R が無い・書き込みに C/U/D が無い。警告: 下書きのセルが残っている、DFD のデータストアが ER に無い、どの処理も触れないテーブル、主キーの無いテーブル。
  * 承認で`draft`をすべて外す(承認 = 人の一括確定。version は増やさない)。段階の一覧(`DesignStageRead`)の段階3は、DFD から決まる R/W を`dfd_accesses`で返す(画面で導き直さないため)。
  * 段階の外の正本の編集: 詳細設計モードで ER を保存・自動レイアウトすると、承認済みの段階3を`reviewing`・version+1 に戻す(`UmlDiagramService._reopen_stage`。記法 → 段階の対応表で DFD と共通)。
* **段階4 ソフトウェア構造(Phase 19)**:
  * `design_stages.model`(段階4)は`{modules: [{path, layer, responsibility, depends_on, functions, all_functions}]}`(ファイル単位のモジュール一覧)だけ。`functions`は関わる処理の処理ID(機能一覧の順)、`all_functions`は全処理が通る横断のモジュールの印(文書では「全処理」)。構成図は`uml_diagrams`(notation=component、subject=`''`の1枚。箱はパッケージ単位、要素の`layer`が層のレーン)が正本で、model に複製しない。構成図とモジュール一覧は層の名前でつなぐ(`app/detailed_design/structure.py`)。
  * 下書き: 構成図(LLM 1回。入力は要件定義の全文(技術スタック)・機能一覧・処理概要表・ER のテーブル名。出力スキーマと写像はステージ3の`ComponentGenerationOutput`・`to_component`を再利用し、プロンプトだけ段階4専用)→ モジュール一覧(LLM 1回。構成図の要素と層・依存の向き、CRUD 図、ER のテーブル名を渡す。層は構成図の層から選ばせる。入力は箱と層を分けて書き、下書きが層の欄に箱の名前を書いたら組み立てでその箱の層に置き換える。検証も層の欄が箱の名前ならその箱の層で照合する ── Phase 55 の完了後の調整)を順に呼び、構成図と段階を1トランザクションで書く。再生成は置き換え。構成図は同じ行を上書きし承認はやり直し(`app/detailed_design/structure_drafting.py`、`_save_diagram`)。「関わる処理」は CRUD 図から決定的には作らない(テーブルとモジュールの対応は名前の推測になるため)。
  * 検証(`STAGE_VALIDATORS[4]`)は、構成図の要約(`ComponentDiagramSummary`: 状態と層)を`StageSources`で受け取る。エラー: 形が不正、モジュールが0件、構成図が無い・生成中・未承認、パスが空・重複(段階5の手順の呼び出し先と関与表の列の鍵のため)、関わる処理の処理IDが機能一覧に無い。警告: 責務が空、層が構成図のレーンに無い、どのモジュールにも現れない処理(`all_functions`の行は数えない)、依存先がパスの形(`/`を含む)なのに当たるモジュールが一覧に無い。依存先の照合は区切り単位の部分一致(`module_ref_matches`。「/」で区切った単位の列が、パスの単位の列のどこかに連続して現れれば一致。末尾の拡張子は除き、パスの`{a,b}`は展開、`*`はどの単位とも一致。ディレクトリ`app/services`や短い書き方`services/auth`は一致し、`app/ser`や`app/models`→`app/models_old.py`は一致しない。Phase 19 の画面確認後に変更)。
  * 段階の外の正本の編集: 詳細設計モードで構成図を保存・自動レイアウトすると、承認済みの段階4を`reviewing`・version+1 に戻す(`_STAGE_OF_NOTATION`に component を足した)。
* **段階5 主要処理の手順(Phase 20)**:
  * `design_stages.model`(段階5)は`{procedures: [{function_id, reason, note, steps: [{caller, callee, call, data, action, result, db, branch, is_branch, kind}]}]}`だけ。`kind`は行の種別(`call`=同期の呼び出し・`async`=非同期の呼び出し・`return`=戻り。Phase 29。既定は`call`で、種別の無い既存の行も`call`として読むのでマイグレーションは要らない。分岐の行は`call`に戻す)。`procedures`は人が選んだ処理(手順の無い行は未生成)、`reason`は選定理由、`note`はトランザクションの範囲などの注記。分岐の行(`is_branch`)は元の手順の直後に置き、`action`に条件、`branch`に結果を書く(`app/detailed_design/procedure.py`)。
  * 手順番号は保存しない。並び順と`is_branch`から`number_steps`で導く(分岐でない行は1から順に、分岐の行は直前の手順の番号に a, b…, z, aa)。手順IDは`step_id`(`F-01#4a`)。
  * 呼び出し先は、段階4のモジュール一覧のパスか、外部の役者(「/」を含まない名前)。下書きの取り込みで`resolve_callee`がパスにそろえる(完全一致、または`module_ref_matches`で1行だけに当たればその行のパス。それ以外はそのまま)。
  * 下書き: 対象の処理ごとに LLM 1回(入力はその処理の機能一覧の行・処理概要表の行・DFD の R/W・CRUD 図の行と、ER のテーブル名・モジュール一覧。`NAMING_RULES`を足す)。`merge_procedure`は対象の処理の手順だけを置き換え(人の選定理由は残し、注記は置き換える)、他の処理は残す。全対象を1トランザクションで書く(`app/detailed_design/procedure_drafting.py`、`generate_procedures`)。
  * 生成の対象: `POST /design-stages/5/generate`の本文`{function_ids?}`(省略すると、選んだ処理のうち手順の無いもの。`generation_targets`)。受け付けで、対象が空・選ばれていない処理・5件超(`MAX_PROCEDURE_TARGETS`)を409`DESIGN_STAGE_INVALID`で断る。段階5以外への指定も断る。対象は background task に値で渡し、`StageGenerationContext.targets`で生成の関数へ渡す。状態は、対象の処理にもともと手順があれば`regenerated`。
  * 検証(`STAGE_VALIDATORS[5]`)は、段階1の機能一覧と段階4のモジュール一覧を`StageSources.stages`から読む。エラー: 形が不正、処理が0件、処理IDが機能一覧に無い・重複、手順が0件、先頭の行が分岐、呼び出し先が空、パスの形の呼び出し先がモジュール一覧のパスと完全一致しない(関与表の列の鍵のため)。警告: 選定理由が空、モジュールを呼ぶ手順の関数が空(戻りの行は除く)、シーケンス図にするときの指摘(Phase 29。`RETURN_AS_CALL` 同期の呼び出しの先が呼び出し中の参加者 = 戻りを呼び出しとして書いている、`NESTING_UNKNOWN` 呼び出し元が呼び出し中でない、`MISSING_BRANCH_TARGET` 分岐の欄の「1a へ」の行が無い、`CALLEE_NOT_DEPENDENCY` 呼び出し先が呼び出し元の段階4の依存先に無い、`EMPTY_CALLER` 呼び出し元が空)。指摘の`target`は処理IDか手順ID。
  * 関数を呼ぶ行(`calls_function`。分岐でも戻りでもなく、呼び出し先がモジュールで、関数が空でない)だけが、06 の紐づけ・段階6の候補・段階8の参照・関与表の対象になる(Phase 29。戻りの行を除くため、判定を1か所にまとめた)。
  * 索引と関与表は画面(`devex-ui`の`procedureOps.ts`)が編集中の内容から導く。関与表の列は、段階4のモジュール一覧のパスのうち呼び出し先に現れるもの(一覧の並び)。
* **段階6 処理ロジックの詳細(Phase 21)**:
  * `design_stages.model`(段階6)は`{logics: [{module, function, signature, args, returns, raises, pre, post, pseudo: [{text, sub}]}]}`だけ。`logics`は人が選んだ関数(シグネチャと擬似フローが空の行は未生成)。`module`は段階4のモジュール一覧のパス、`function`は手順の`call`で、この組が05との紐づけの鍵(`logic_key`)。L-IDは保存せず、並び順から`logic_id`で導く(`app/detailed_design/logic.py`)。
  * 候補と「呼ばれる手順」は、段階5の手順のうち分岐でなく・呼び出し先がパスで・関数が空でない行を(呼び出し先, 関数)ごとにまとめて導く(`logic_candidates`・`calling_steps`。手順IDは`number_steps`・`step_id`を再利用)。
  * 下書き: 対象の関数ごとに LLM 1回(入力はモジュール一覧の行(層・責務・依存先)、その関数を呼ぶ手順と直後の分岐の行、ER のテーブル名。`NAMING_RULES`を足す。モジュール・関数の名前とL-IDは書かせない。シグネチャの言語はモジュールのパスから判断させ、要件定義は入力にしない)。`merge_logic`は対象の関数の詳細だけを置き換え、他の関数は残す(`app/detailed_design/logic_drafting.py`、`generate_logics`)。
  * 生成の対象: `POST /design-stages/6/generate`の本文`{logics?: [{module, function}]}`(省略すると、選んだ関数のうち詳細の無いもの)。受け付けで、対象が空・選ばれていない関数・5件超(`MAX_LOGIC_TARGETS`)を409`DESIGN_STAGE_INVALID`で断る。段階6以外への指定も断る。対象は`logic_key`の文字列で`StageGenerationContext.targets`に渡す。状態は、対象の関数にもともと詳細があれば`regenerated`。
  * 検証(`STAGE_VALIDATORS[6]`)は、段階5の手順を`StageSources.stages`から読む。エラー: 形が不正、モジュール・関数が空、(モジュール, 関数)の重複、段階5のどの手順からも呼ばれない(`UNCALLED_LOGIC`)、詳細が無い。警告: 事前条件・事後条件が空。指摘の`target`はL-ID。0件は指摘なし。
  * 段階6を飛ばす: 専用のAPIは持たず、`{logics: []}`を保存して承認する(画面の「段階6を飛ばす」)。段階7の入力(`STAGE_INPUTS[7]`)に段階6の承認が要るため。段階5を承認し直すと、他の段階と同じく段階6は「古い」になり、「このまま承認し直す」で済む。組み立て(Phase 22)は、0件で承認済みの段階6を「06 省略」として出す。
  * 逆引き・05の詳細バッジ・段階をまたぐ移動は画面(`devex-ui`の`logicOps.ts`・`LogicPanel`・`ProcedurePanel`)が導く。移動先(段階と手順IDまたは関数の鍵)はストアの`focus`に置き、移動先のパネルが一度だけ読んで消す。
* **段階7 横断事項と実装計画(Phase 23)**:
  * `design_stages.model`(段階7)は`{crosscutting: [{topic, policy, modules}], milestones: [{name, goal, priority, tasks: [{kind, title, function_ids, depends_on, modules, config_files}]}], environment, risks: [{risk, mitigation}]}`(`app/detailed_design/plan.py`。Phase 26 で改修)。タスクはマイルストーンの中に入れ子で持つ(名前で参照すると改名で切れるため)。タスクは実装手順書の作業単位で、`kind`は`feature`(機能。処理を持つ縦割りの単位)か`base`(基盤。処理の無い準備・デプロイ)。マイルストーンの番号(`M-01`…)と単位の ID(`M-01-T01`…)は保存せず、並び順から`milestone_id`・`task_id`で導く。`depends_on`は単位の ID で書き、前の単位だけを指せる。並べ替え・削除での付け替えは画面(`devex-ui`の`planOps.ts`の`relinkDependencies`)が行う。マイルストーンの処理は保存せず、タスクの処理から`milestone_functions`で導く(Phase 23 の`Milestone.function_ids`は二重管理になるので削除)。優先度は Must / Should / Could。処理IDは段階1の機能一覧の ID で書く。タスクの`modules`は段階4のモジュール一覧のパスで、検証する。`config_files`は環境・設定のファイル(`Dockerfile`・`docker-compose.yml` など)の例で、検証しない。横断事項の`modules`は関わるファイルの例で、検証しない(Phase 23 では、タスクの`modules`も検証しない例だった。環境のファイルがモジュール一覧に入らずエラーになったため。Phase 26 で欄を分けた)。
    > **[Phase 25 で確定 ── 〈段階7のタスクを層の横割り(区分)のままにしない・ファイルを例のままにしない〉]** 当初〈タスクは区分(準備/バックエンド/フロントエンド/テスト/デプロイ)ごとの行で、`modules`は検証しない例〉→ 改訂(実装は Phase 26)。理由〈ステージ5の実装手順書は、段階7のタスクを作業単位としてそのまま使う。単位の区切り・順序・依存は実装計画の役割で、手順書の生成時に作り直すと、人が承認した区切りを上書きして二重管理になる。そこで、処理を持つタスクは機能ごとの縦割り(機能)、処理の無い準備・デプロイは基盤とし、ID(`M-01-T01`、並び順から導く)と単位の間の依存を持たせる。ファイルは、段階4のパスで検証する「モジュール」と、検証しない「環境・設定のファイル(例)」に分ける(環境のファイルがエラーになった Phase 23 の問題は、欄を分けて避ける)。経緯は[`textbook/Phase-25/Phase-25-1.md`](../textbook/Phase-25/Phase-25-1.md)、改修後の見本は[`appendix/implementation-procedure-sample/stage7-recut.md`](../appendix/implementation-procedure-sample/stage7-recut.md)〉。
  * 検証(`STAGE_VALIDATORS[7]`)は、段階1・4の内容を`StageSources.stages`から読む(段階4は Phase 26 から)。エラー: 形が不正、マイルストーンが0件、マイルストーン名が空・重複、タスク名が空、横断事項の項目が空、機能一覧に無い処理ID(`UNKNOWN_FUNCTION`)、単位の一覧に無い依存先(`UNKNOWN_DEPENDENCY`)、自分か後ろの単位への依存(`FORWARD_DEPENDENCY`。依存の順と計画の並び順が一致し、循環も起きない)、モジュール一覧に無いモジュール(`UNKNOWN_MODULE`。手順書が参照する設計の鍵のため)。警告: どの単位にも無い処理(`UNPLANNED_FUNCTION`。次のリリースに回す処理もあるため承認は止めない)、複数の単位にある処理(`DUPLICATE_FUNCTION`)、種別と処理の食い違い(`KIND_MISMATCH`)、処理が`MAX_UNIT_FUNCTIONS`(3)を超える単位(`MANY_FUNCTIONS`。原則1処理)、モジュールの無い機能の単位(`NO_MODULES`)、ディレクトリのモジュール(`MODULE_NOT_FILE`。最後の区切りに拡張子が無い)、タスクの無いマイルストーン、既定の横断事項(例外と HTTP・認証・トランザクション・ログ)の欠け・方針が空、リスクが0件。単位の指摘の`target`は単位の ID。
  * 下書き: 入力の詳細設計書は、出力と同じ組み立てで作った md の01〜06章(`DetailedDesignExportService.collect(project, render=False)`→`to_markdown(source, chapters)`。図は描かず、`exported`にもしない)。LLM を2回呼ぶ。① 要件定義・外部設計・詳細設計書 md → 横断事項、② 要件定義・詳細設計書 md・①の横断事項・処理IDの一覧・モジュールのパスの一覧(Phase 26)→ マイルストーン・タスク・開発環境・リスク。依存先は、出力の並び順から導く ID で書かせる(`app/detailed_design/plan_drafting.py`、`generate_plan`。`NAMING_RULES`を足す)。ファイルは`normalize_plan`が段階5の呼び出し先と同じ規則(`resolve_callee`)で、当たるものだけモジュール一覧のパスにそろえる。作り直しは全体を置き換える(段階4と同じ)。簡易ドキュメントモードの実装計画書が「要件定義+内部設計書」を入力にするのに当たる。
  * 既存データの移行(Phase 26、Alembic `b8c9d0e1f2a3`): 区分の横割りの形の段階7を、行ごとに作業単位の形へ変える。処理のあるタスクは`feature`、無いタスクは`base`。`modules`は同じプロジェクトの段階4のパスに一致するものを`modules`、残りを`config_files`へ。`depends_on`は空、`Milestone.function_ids`は捨てる。承認済みの段階7は`reviewing`に戻し、どの行も`version`を1つ上げる(開いている画面の保存を版の不一致で止める)。変換は移行ファイルの中の純粋関数で、`app`のコードを import しない(後の改修で移行の結果が変わらないようにするため)。downgrade は形だけを戻し、承認は戻さない。
  * 段階7の入力の大きさ(Phase 26 で計測。ゴール3の生成物、11処理・12モジュール): 横断事項の入力 約1.7万字、実装計画の入力 約1.5万字。モデルの入力の上限に対して小さく、絞り込みは要らない。段階8の手順書の生成は、単位が参照する箇所だけを渡す(Phase 25-1 決定10)。
  * 出力: 07 横断事項は詳細設計書の07章、実装計画は別のファイル(`implementation_plan.md`・`.html`。マイルストーン一覧 → マイルストーンごとの単位の表(ID・種別・タスク・処理・依存・モジュール・環境・設定のファイル(例))→ 処理の割り当て(処理ごとの単位の ID、無ければ「未計画」)→ 開発環境 → リスク。Phase 26 で、区分の表と M-ID の割り当てから改めた。HTML は単位の行に ID のアンカーを持ち、依存と割り当ての ID から移れる)。段階7が未承認なら、どちらも「未承認」とだけ書く。
* **下書きの表記の規則(Phase 19 の画面確認後)**: 詳細設計モードの全段階の下書きの system プロンプトの末尾に、共通の規則`NAMING_RULES`(`app/detailed_design/prompt_rules.py`)を足す。簡易ドキュメントモードのプロンプトには入れない。
  * 名称・説明・責務・層の名前・注釈は日本語で書く。英語の識別子を説明の代わりに使わない(必要なら「日本語の名称(識別子)」と併記。構成図の箱は「サービス(services)」の形)。
  * ファイル・ディレクトリのパス、テーブル名・列名、クラス名・関数名・変数名などの識別子は、技術スタックの命名規則に従って英語で書く(ユーザーの規則「新規のディレクトリ名・ファイル名は日本語を基本とし、互換性に問題がある場合は英語」の互換性の条件が、Python・TypeScript などのパスでは常に当てはまるとみなした)。
  * フレームワーク・ライブラリ・外部サービス・プロトコルの正式名称と、環境変数・設定キー・コマンド・パッケージ名は原文のまま。
  * 入力にある名前(処理ID・テーブル名・パス・層の名前・データ項目の名前)は変えない(後の段階が名前で突き合わせるため)。
* **簡易ドキュメントモードとの関係**: 簡易ドキュメントモードの内部設計書にも、段階4と同じ列のモジュール一覧の表を足す(3.3節1.の`doc_generator_service.py`参照)。それ以外の簡易ドキュメントモードの挙動は変えない。
  > **[Phase 16 で確定 ── 〈外部設計書の構成は簡易ドキュメントモードでも変える〉]** 当初〈モジュール一覧の表のほかは、簡易ドキュメントモードの挙動を変えない〉→ 外部設計書の「2.6 API一覧」は両方のモードで出す。理由〈ユーザーの選択。API仕様は実務でも外部設計(基本設計)に置くことが多く、プロンプトをモードで分けずに済む。重なる内部設計書3.3節のAPI表は、2.6と同じメソッド・パスを使わせてそろえる〉。

### 5. 実装手順書(ステージ5)

[外部設計書](external_design.md) 2.8節の実装手順書の内部の方針(Phase 25で確定)。方針は[`appendix/devex_implementation_procedure_guideline.md`](../appendix/devex_implementation_procedure_guideline.md)、経緯は[`textbook/Phase-25/Phase-25-1.md`](../textbook/Phase-25/Phase-25-1.md)・[`Phase-25-5.md`](../textbook/Phase-25/Phase-25-5.md)。意味モデル・API・マイグレーションの詳細は各実装 Phase で確定する。

* **段階8として持つ**: `design_stages`に段階8(入力は段階1〜7と要件定義。`STAGE_INPUTS[8]`。要件定義は手順書の対象外(Should / Could / Won't)を書くために読む)を足し、承認・陳腐化(`input_fingerprint`)・生成の状態・段階ごとの検証(`STAGE_VALIDATORS[8]`)・部分生成(`StageGenerationContext.targets`)の仕組みをそのまま使う。`stage`の CHECK は 1〜8(Phase 27)。生成器は Phase 28 で登録した(`STAGE_GENERATORS[8] = generate_procedure_docs`)。
* **意味モデル(Phase 27)**: `design_stages.model`(段階8)は`{units: [{unit_id, title, purpose, files: [{path, kind, responsibility, basis}], notes, tests: [{viewpoint, sut, driver, stub}], gwt, verify, findings: [{level, target, message, fix_stage}]}]}`(`app/detailed_design/procedure_doc.py`)。`units`は手順書のある単位だけ。`unit_id`と`title`は手順書を作ったときの段階7の単位の ID とタスク名で、段階7の並べ替え・改名で合わなくなった手順書は検証のエラー(`UNIT_MISMATCH`)にして作り直させる(自動で付け替えない。段階7を承認し直すと、段階8は既存の陳腐化で「古い」になる)。ファイルの`kind`は`module`(段階4のパス。検証する)・`test`・`config`。`findings`は AI の指摘で、重要度`level`(`critical`=最重要・`major`=中程度・`minor`=軽微)と直す先の段階`fix_stage`を持つ。単位の一覧は段階7の並び順(`plan_units`。依存は前の単位だけを指すので、これが依存順)。
* **正本と参照**: 作業単位の正本は段階7(単位の ID は並び順から導く)。段階8の model は単位ごとの手順書の中身(目的・作成・変更するファイル(テスト・環境のファイルを含む)・実装の要点・テスト観点・確認方法・AI の指摘)だけを持ち、設計の中身を複製しない。参照する設計は単位の処理ID・モジュールから導き、表示・AI 向けの出力・生成の入力のときにだけ展開する(参照の展開は決定的な純粋関数で、この3か所で共有する)。
* **実装可能性チェックの2層**:
  * **検証(決定的。Phase 27)**: `STAGE_VALIDATORS[8]`(`validate_procedure_doc`)。参照する設計は`unit_refs`が単位の処理ID・モジュールから導く(段階5の手順 → 手順が呼ぶ段階6の関数(`logic_key`)→ 段階4のモジュール)。段階8の指摘は手順書がまだ無くても出す(`validate_stage`は段階8だけ内容が空でも検証し、画面の一覧は開いている段階8に行が無くても指摘を返す)。指摘の`StageIssue`に、段階8だけが持つ欄`level`・`fix_stage`・`unit`(指摘の出た単位の ID)を足した。
    * エラー(承認を止める。手順書そのものの不正だけ): 形が不正、同じ単位の手順書が2つ(`DUPLICATE_UNIT`)、段階7と合わない手順書(`UNIT_MISMATCH`)。
    * 警告(重要度と直す先の段階を持つ。承認は止めない): 機能の単位の処理に段階5の手順が無い(`NO_PROCEDURE`。中程度・段階5。段階5は主要処理だけを選ぶので最重要にしない)、手順に DB 操作があるのに CRUD 図にその処理の操作が無い(`NOT_IN_CRUD`。中程度・段階3)、単位のモジュールがディレクトリ(`MODULE_NOT_FILE`。中程度・段階4)、手順書のモジュールのファイルが段階4に無い(`UNKNOWN_FILE`。中程度・段階4)、手順の`call`が段階6に無く、同じモジュールの段階6の`function`と書き方だけが違う(`UNRESOLVED_CALL`。軽微・段階5。小文字にし`_`・`-`を除くと等しいもの。揺れは吸収せず、文言で「段階5の手順の関数名を段階6の名前にそろえる」と示す。段階6で選ばなかった別の関数の呼び出しは、段階6が任意のため指摘しない。Phase 27 の画面確認後に、直す先の段階と文言が食い違う・選ばなかった関数まで指摘する問題を直した)。
    * 単位の依存の循環・一覧に無い依存先は、段階7の検証のエラー(Phase 26)で止まるので段階8では見ない。シーケンス図にするときの手順の不備は段階5の検証の警告(Phase 29)。
    * 警告(Phase 29): 手順書のテスト観点のスタブの欄が、手順のシーケンス図で SUT から呼ばれないモジュールを挙げている(`STUB_OUTSIDE_SEQUENCE`。軽微・段階5。手順に無い依存。SUT は関数名なら図でそれを呼ぶ矢印の先、トリガーなら最初の呼び出しの先。候補は SUT から呼び出しをたどって届く参加者と SUT 自身。スタブの文とモジュール名は、ファイル名から拡張子・`_`・`-`を除いた小文字で突き合わせる。SUT が図に無ければ判断しない)。
  * **AI の指摘**: 手順書を生成する AI に、設計に無いことを推測で埋めず「未定義」(重要度・対象・内容)として挙げさせ、model に保存する。
  * 決めるときは対象の段階を直す。直した段階は差し戻され(既存の`mark_edited`・承認し直し)、段階8は陳腐化する。手順書に決定を書き込まない。
* **参照の展開(Phase 28)**: `app/detailed_design/procedure_doc_refs.py`(純粋関数)。`unit_context(unit, stages)`が`unit_refs`の参照を、詳細設計書の 05・06 と同じ表(`document/markdown.py`の`procedure_table`・`logic_spec`。05・06 の組み立てと共有)で md に展開し(`expand_ref`。設計に無い参照は None。段階5の手順の参照は、表の後に 05 と同じ Mermaid のシーケンス図を添え、画面向けに SVG も返す。Phase 29)、段階7の 07章 横断事項と開発環境の md を添える。生成の入力と画面の単位の詳細(`GET /design-stages/units/{unit_id}/context`)が同じ関数を使い、Phase 30 の AI 向けの出力も使う(バックエンドだけに置き、画面へは API で渡す)。
* **生成**: 人が選んだ単位だけ、1単位につき LLM を1回、1回に5件まで(段階5・6と同じ形)。入力は、その単位が参照する設計の該当箇所だけ(01〜07章の全文は渡さない)と、実装ルール(段階4・07章)。`NAMING_RULES`を足す。概要・前提・一覧・完了条件は決定的に組み立てる。
  * 実装(Phase 28): `generate_procedure_docs`。対象は本文`{unit_ids?}`(省略すると、段階7の単位のうち手順書の無いもの。手順書の有無は単位の ID とタスク名の両方が合うかで決める。`documented_unit_ids`・`generation_targets`)。対象は保存した model でなく承認済みの段階7から決める。受け付けで、対象が空・段階7に無い単位・5件超(`MAX_PROCEDURE_DOC_TARGETS`)を409`DESIGN_STAGE_INVALID`で断る。段階8以外への指定も断る。状態は、対象の単位にもともと手順書があれば`regenerated`。
  * 入出力: `app/detailed_design/procedure_doc_drafting.py`。プロンプトは、設計を書き写さない・推測で埋めず`findings`に挙げる・実装の要点は自明な作業と順序の理由だけ・テストは観点まで(Phase 25-1 決定5・7)。単位の ID とタスク名は書かせず段階7から写す。`fix_stage`は 1〜7 から選ばせ、範囲の外は 8(「段階Nで直す」を出さない)にする。
  * merge(`merge_unit_procedure`): 対象の単位だけを置き換え、段階7の並び順に並べる。段階7に無くなった単位の手順書は消さずに後ろへ置く(`UNIT_MISMATCH`で知らせる)。
  * 承認: バックエンドは最重要の指摘があっても承認を止めない。画面が承認の前に、最重要(検証と AI の両方)の件数を示して確かめる。
* **シーケンス図**: 段階5の手順から決定的に導く読み取り専用のビュー(正本は手順の表)。入れ子は呼び出し中の参加者の積み上げで推測し、表に無い戻りは推測で足す。段階5の行に種別(同期の呼び出し/非同期の呼び出し/戻り)を足す(既存のデータは同期の呼び出しとして読む)。SVG はバックエンドで作り(`app/uml/export/svg.py`の書式を流用。レイアウトエンジンは使わない)、md と AI 向けの版は Mermaid のテキストにする。導出の見本は devex-ui のデモ(`src/features/implementation-procedure/demo/sequenceModel.ts`)。
  * 実装(Phase 29): 導出は`app/detailed_design/sequence.py`(純粋関数。`to_sequence(procedure, dependencies)`が参加者・矢印・注記・指摘を、`to_mermaid`が Mermaid を返す。同期の呼び出しの先が呼び出し中の参加者なら戻りとして描いて指摘し、非同期と同じ参加者の中の呼び出しはスタックに積まない)、SVG は`app/detailed_design/sequence_svg.py`(参加者 = 列・イベント = 行。列の間隔はまたぐラベルが収まる幅に広げ、長いラベルは切り詰める)。導出はバックエンドだけに置き、段階5の検証・05章の md と HTML(`document/markdown.py`の`sequence_block`・`document/views.py`の`procedure_sequence`)・段階8の参照の展開・段階5の画面の API(`DesignStageService.procedure_sequence`)が同じ関数を使う。デモの`sequenceModel.ts`は本体の画面へ移さない。
* **出力**: 詳細設計書・実装計画の zip(`DetailedDesignExportService`)に`implementation_procedure/`(`index.md`・単位ごとの md・AI 向けの版・HTML 1枚)を加える。AI 向けの版と画面の「AI 向けにコピー」は同じ組み立てを使う。
  * 実装(Phase 30): 組み立ては`app/detailed_design/procedure_output/`(純粋関数。依存の向きは source ← markdown ← html)。`document/`の中に置かないのは、参照の展開(`procedure_doc_refs`)が`document.markdown`を使い、`document`の`__init__`から re-export すると循環するため。
    * `source.py`: `procedure_output_source(title, state, stages, model, issues, requirements)`(Phase 31 で`stages`を段階8の土台`basis`に替えた。簡易ドキュメントモードの項を参照)が`ProcedureOutputSource`(段階8の状態・段階7の単位・手順書のある単位の手順書と参照の展開(`unit_context`)・未定義・対象外)を作る。未定義は段階8の検証の指摘(重要度のあるもの)と AI の指摘を重要度の順にまとめる(画面の`collectFindings`と同じ並びと数え方)。対象外は要件定義の 1.4節を`extract_section`で読む。
    * `markdown.py`(`to_index_markdown`・`to_unit_markdown`・`to_ai_markdown`)、`html.py`(`to_procedure_html`。`document/html.py`の`page`(1ページの枠。旧`_page`)と表・バッジを共有)。単位の md の図は`ExpandedRef.mermaid`(参照の展開に足した Mermaid の本文)。
    * zip(`bundle_procedure`・`procedure_files`): 詳細設計書・実装計画とは別の zip。段階8が承認済みでなければ`DesignDocumentNotReadyError`(409)で断る(判定は純粋関数`missing_approvals`。詳細設計書・実装計画の`bundle`も段階1〜7で同じ判定)。中身は`collect(render=False)`の承認済みの内容から組み立てる(図は描かない)。`procedure_files`の「未承認」だけの分岐は、組み立ての側の守りとして残す。
    * 画面のコピー(`DesignStageService.unit_ai_markdown`・`GET /design-stages/units/{unit_id}/ai-markdown`): 保存済みの段階8の行から作り、段階8の状態を md の警告と応答の`state`に入れる。
* **簡易ドキュメントモード(ステージ5の後半)**: 実装計画書のプロンプトを変え、WBS を段階7と同じ縦割り・ID 付きにする。簡易モードのプロジェクトには、入力を4文書にした段階8だけを開く(段階1〜7の行は持たない)。参照先は内部設計書の処理別データフロー・API 一覧・モジュール一覧・3.4節。
  * 実装(Phase 31。経緯は[`textbook/Phase-31/Phase-31-introduction.md`](../textbook/Phase-31/Phase-31-introduction.md)):
    * **段階の入力**(`app/detailed_design/stages.py`): `SIMPLE_STAGE_INPUTS = {8: 4文書}`と`stage_inputs(mode)`。`derive_states`・`current_inputs`はモードの入力を引数で受ける。陳腐化は4文書の表示中の版で決まる(どれかを再生成・復元すると段階8は「古い」)。マイグレーションは無い(`design_stages`の CHECK は 1〜8 のまま)。`DesignStageService`はモードに無い段階の行を読まず、モードに無い段階は`_ensure_stage`で409 にする。簡易モードの`StageSources`は文書だけを持つ(`mode="simple"`)。
    * **WBS の解析**(`app/detailed_design/simple_procedure/wbs.py`の`parse_wbs`。純粋関数): 4.2節を`PlanModel`(段階7と同じ形。横断事項・リスクは持たない)に読み替える。マイルストーンの見出し・ゴール・タスクの行・字下げした欄(処理・依存・モジュール・環境・設定)を、表記の揺れ(全角のコロン・太字・`──`/`--`)を許して読む。ID は並び順から導き(`task_id`)、書かれた ID と違えば`WBS_ID_MISMATCH`(軽微)にして依存先を読み替える。読めない行は`WBS_FORMAT`(中程度。Won't のマイルストーンは軽微で読み飛ばす)。単位が1つも読めなければ`WBS_MISSING`(最重要)だけを返す。開発環境は 4.3節の本文。
    * **内部設計書の解析**(`simple_procedure/internal_design.py`の`parse_internal_design`): 3.3節のモジュール一覧(`ModuleRow`)・`#### DF-<n>`の処理別データフロー(本文と、流れの表の元・先)・API エンドポイント一覧(`api_list.extract_api_endpoints`に節を選ぶ引数を足して共有)、外部設計書 2.6、3.2節のテーブル、3.1・3.4節の本文を`SimpleDesignBook`に集める。
    * **参照と土台**: 参照の種類に`dataflow`を足した(`DesignRefKind`)。`simple_procedure/refs.py`が DF・モジュールの参照を導いて展開する(DF の表とデータ項目に、同じ API の 3.3・2.6 の行と、流れに出てくる 3.2 のテーブルを添える。共通の節は 3.4 と、4.3・3.1)。完了後の調整(31-7): DF のテーブルは DF の本文に識別子として名前の出るものを拾う(表の先が「データベース (`trends` テーブル)」でも拾う。`DataFlow.tables`)。DF を持たない単位には参照の種類`datamodel`(3.2 全体)を添える。モジュールは`module_layer`(一覧の行と完全一致 → 行のパターン(`*`・`{a,b}`)が末尾に一致 → 同じディレクトリ)で層まで照合し、その層の行を展開する。層に当たらないファイルは参照に出さない。段階8の部品は`app/detailed_design/procedure_basis.py`の`procedure_basis(mode, stages, documents)`が作る`ProcedureBasis`(作業単位`plan`・参照`refs`/`context`・文言`labels`・実装前提`environment`/`rules`)から作業単位と参照を受け取る(詳細設計モードは今までの`unit_refs`・`unit_context`)。簡易モードの WBS のモジュールは、段階7の下書きと同じ規則(`normalize_plan`)でモジュール一覧のパスにそろえる。
    * **検証**(`validate_procedure_doc`の簡易モードの分岐): エラーは両モード共通(形・`DUPLICATE_UNIT`・`UNIT_MISMATCH`。文言の作業単位の出どころは`labels`)。警告は直す先を文書`fix_document`で持つ(`fix_stage`は 8)── 実装計画書: WBS の指摘・`UNKNOWN_DEPENDENCY`/`FORWARD_DEPENDENCY`・`FEATURE_WITHOUT_DATAFLOW`・`UNKNOWN_DATAFLOW`(中程度)・`UNPLANNED_DATAFLOW`(軽微)。内部設計書: `NO_MODULE_LIST`(最重要)。モジュール・ファイルの指摘(`UNKNOWN_MODULE`・`MODULE_NOT_FILE`・`UNKNOWN_FILE`)は完了後の調整(31-7)で簡易モードから外した(一覧が層ごとのまとめた行のため。詳細設計モードは変えない)。`StageIssue`・`AiFinding`・`UnitFinding`・API の`StageIssueRead`に`fix_document`を足した。
    * **生成**: `generate_procedure_docs`が土台から作業単位と参照を取り、簡易モードは`build_simple_procedure_doc_messages`(参照は内部設計書・関数の契約と手順が無いので決められないことは`findings`に挙げ、手順の要る単位は詳細設計モードを勧める)と`SimpleProcedureDocGenerationOutput`(指摘の直す先`fix_document`)で下書きする。対象の単位は WBS から決める。偽 LLM への登録は Phase 32。
    * **出力**: `procedure_output_source`は土台を受け取り、文言(作業単位の出どころ・実装前提の小見出し・直す先の列)を`labels`から書く(`fix_target_text`)。zip は`bundle_procedure`が`collect`(詳細設計書の組み立て)を通らずに、承認済みの段階8と土台から作る(`procedure_source`)。`bundle`・`collect`は詳細設計モードでなければ409。

### 6. ヒアリングと上流の構造化(ステージ6)

[外部設計書](external_design.md) 2.9節の内部の方針(Phase 33で確定)。経緯は[`textbook/Phase-33/Phase-33-2.md`](../textbook/Phase-33/Phase-33-2.md)。意味モデル・API・マイグレーションの詳細は各実装 Phase で確定する。

* **観点の定義はコードに持つ**: 観点のキー・名前・種類(機能面 / 非機能)・場面で聞く問いの例・規模ごとの必須を、コードの表で持つ(テンプレートや DB には持たない)。完了の判定・次に聞く観点・画面の表示は、この表と`hearing_points`から決定的に導く。
* **判定の LLM の役割を狭める(Phase 34 で実装)**: `ChatService.judge_points`が、利用者側の発言に`[#n]`の番号を付け、今の観点の表と一緒に LLM に渡す。LLM は観点ごとの状態・決めたこと・根拠の番号と規模を返す(`HearingPointsJudgement`)。コードが番号を`chat_histories.id`に直し、根拠の無い「決定」を捨てて表に取り込む(`app/hearing/points.py`の`merge_judgement`)。「十分」はコードが決める。未決の必須の観点は、規模を先頭に定義の順で3つまで、返信を作る LLM に渡す。発言の回数の下限(3回)は外した。画面には`GET /projects/{id}/hearing-points`で表を返す。
* **選択肢カード**: AI の問いを構造化(観点・問い・選択肢・選択肢ごとの結果・おすすめ)して、チャットのストリーミングとは別のイベントで返す。カードは1回の返信で数枚まとめて出す(独立した観点だけ。規模は単独で先に)。選択はコードがその場で`hearing_points`を`adopted`にする(LLM は呼ばない)。まとめた選択は1つの利用者の発言として`chat_histories`に残し、判定と返信はまとめて1回だけ回す(Phase 33 完了後に決定)。
  * **Phase 35 で実装した部分**: カードは`chat_histories.cards`(AI の行)に持ち、選ばれた選択肢も同じ JSON に書く。送信の処理の順は「回答を確かめる(最新の AI の発言のカードか・未回答か・番号の範囲。`app/hearing/cards.py`の`resolve_answers`)→ 選んだ内容と文を1つの発言として保存(`compose_answer_message`)→ 選ばれた観点を`adopted`(決めたこと = 選んだ選択肢、根拠 = その発言。`apply_card_answers`)にして表に保存 → 判定の LLM(表には採用が入った状態で渡る)→ 返信」。カードにしてよい観点はコードが決める(`card_targets`: 規模が未決なら規模だけ、決まっていれば未決の必須の先頭3つ)。返信は本文とカードの構造化出力(`HearingReplyOut`)を`invoke_with_retry`で1回呼び、候補の外・壊れたカードは`sanitize_cards`で捨てる。規模のカードは LLM に作らせず、コードが決まった選択肢で出し(`scale_card`)、選ばれたら`projects.hearing_scale`に入れる。返信をトークンごとに流すのはやめた(本文は1回の`delta`で届く)。AI の発言を LLM に見せるときは、カードの問いと選択肢を文にして後ろに足す。
  * **Phase 35 完了後の調整**: AI の最初の発話にも規模のカードを付ける(`generate_opening_reply`。LLM の呼び出しは1回のまま)。返信のプロンプトの「まだ確認できていない観点」に、一覧が残っている間は「要件がそろった・生成のボタンを押す」と書かないよう足した(`_MISSING_POINTS_NOTE`)。行き詰まりの逃げ道として、利用者が画面で未決の観点を「対象外」にできる(`ChatService.mark_point_not_applicable`)。この状態は根拠の発言を持たない(判定の LLM の取り込み規則「根拠の無い決定は取り込まない」は LLM の出力にだけ掛ける。利用者の画面の操作は、それ自体が利用者の決定のため)。
  * **Phase 35 完了後の調整(2回目)**: `_record_user_turn`は最新の AI の発言のカードと今回の回答を返し、`carry_over_cards`(`app/hearing/cards.py`)が、答えなかったカードのうち観点がまだ未決のものを id を振り直して次の返信に付け直す(付け直す観点は LLM のカードの候補から外す)。返信にカードが無く、本文に問いも無く、聞くべき観点が残っていれば、`_ensure_question`が先頭の観点の問いを本文に足す。必須がそろった後は、`continue_optional`または任意の観点のカードへの回答があり、未決の任意(`open_optional`)が残っているときだけ、未決の任意の先頭3つを候補にして返信を作る(それ以外はまとめ)。完了判定は必須だけで決めるので、任意を続けている間も十分のまま。
  * **Phase 35 完了後の調整(3回目)**: `CARD_LIMIT = 1`(1回の返信の問いは1つ)。`_next_targets`が次に聞く観点を1つ選び(必須が未決なら`card_targets`、そろっていれば未決の任意)、前の返信で答えなかったカードがあればそれを付け直す(`_compose_reply`の`code_card`。LLM にはカードを作らせず、`_CODE_CARD_NOTE`で前置きだけを書かせる)。`sanitize_cards`は既定で1枚まで。`generate_opening_reply`は先に`judge_points`で初期入力・添付資料を判定し(失敗しても続ける)、判定後の表で次の観点の問いを付ける(最初の発話も構造化出力)。`stream_reply`は、送信に文が無く(カードの回答だけ・「任意を続ける」だけ)、判定が済んでいる(`hearing_check`があり、観点の表の行がある)ときは`judge_points`を呼ばず、記録後の表から完了を判定する。
  * **Phase 39 の効果測定で直した部分**: 観点の定義(`PointDef`)に「決まったと言える条件」(`done_when`)を持たせ、判定の表と返信のカードの指示に渡す(技術スタックは言語・フレームワークと置き場所、AI を使うなら LLM。DB の名前だけでは未決。環境は利用者の端末・ブラウザで、サーバーの技術は含めない。セキュリティはログインの要否と方法も)。`merge_judgement`は「採用」と、チャットで確かめる観点(`confirm_in_chat` = 規模・技術スタック)の未決以外を、根拠に利用者の発言(sender='user')があるときだけ取り込む(初期入力・添付から推し量らない。規模のカードは必ず最初に出る)。判定のプロンプトには直前の AI の問いの観点を添える(カードの観点、文の問いなら前の表から`_next_targets`で同じ計算。最新の答えの取りこぼしを防ぐ)。技術スタックの`summary`は挙がった名前を落とさない(要件定義書の生成が要約を読むため)。自由回答は AI の例と似ていても`decided`。未決の必須が残る間は、返信から完了を宣言する文をコードが除く(`_drop_completion_claims`)。要件定義書の生成は、ログインが要るなら認証の機能要件を Must で書き、技術・外部サービスを会話の原文から拾う。測定と判断の経緯は[`textbook/Phase-39/Phase-39-introduction.md`](../textbook/Phase-39/Phase-39-introduction.md)。
  * **Phase 40 で直した部分**(Phase 39 の測定で見つけた小さな不具合): `_ensure_question`は、本文に「？」が無くても依頼・問いの言い切り(「〜ください。」「〜ますか。」など)があれば問いとみなし、同じ観点の問いを二重に足さない(`_has_question`)。要件定義書の出どころの上限(`cap_source`)は、制約(CON)の行に限って規模の観点も根拠に数える(規模そのものを述べる制約が、利用者がカードで選んでも「推測」になっていたため。機能・非機能の行は従来どおり規模だけでは上げない)。外部設計書の API は、本文の要らない POST・PUT・PATCH の本文の欄に「なし」(`NO_BODY`)と書かせ、検証(`API_BODY_MISSING`)は空欄だけを警告する。自由記述の文書(内部設計書・実装計画書)は、生成の時点で見出しの記号の重なり(`### ### 1.`)を1つにまとめる(手順書の index が実装計画書の見出しを写すため)。経緯は[`textbook/Phase-40/Phase-40-introduction.md`](../textbook/Phase-40/Phase-40-introduction.md)。
  * **Phase 47 で足した部分**(ステージ7。聞かれなかった側面): 非機能の観点を4つ足した。可用性(データの保全)`backup`・運用・保守性(データの保持・削除)`data_retention`・セキュリティ(ログ)`logging`・セキュリティ(不正利用)`abuse`。それぞれ大項目の観点のすぐ後ろに置き(続けて聞く)、`PointDef.category` に IPA の大項目を持つ(要件定義書の NFR の大項目は `ipa_category` にそろえ、6大項目のまま)。必須は、データの保全と保持・削除が全規模、ログと不正利用が社内以上。観点の下に側面を構造化する案は、利点が表のまとまりだけで、DB・判定・カード・出どころ・API・画面のすべてが変わるため採らなかった。DB・API・devex-ui は変えていない(`point_key` は文字列、表のラベルは API から返す)。要件定義書の検証(`REQUIRED_POINT_OPEN`)は、その版の `point_statuses` に記録した観点だけで数える(以前の版に、後から足した観点の指摘を付けない)。経緯は [`textbook/Phase-47/Phase-47-introduction.md`](../textbook/Phase-47/Phase-47-introduction.md)。
* **要件定義書・外部設計書の意味モデル**: ステージ4の段階と同じく「構造化出力 → Pydantic の model → md を組み立てる」。要件定義書は要件の行(`FR`/`NFR`/`CON`の ID・優先度または大項目・本文・出どころ`user`/`adopted`/`assumed`・観点のキー)と、1.1〜1.3 の本文。外部設計書は画面・API・外部連携の行(関係する要件ID を持つ)と、本文の節。model の置き場(`generated_documents`の列にするか)と、再生成したときの ID の扱いは Phase 36 で決める。
  * **Phase 36 で実装した部分(要件定義書)**: `app/documents/requirements`(`model`・`assemble`・`markdown`・`validation`・`drafting`)。model は`generated_documents.model`に版ごとに持つ。生成(`DocGeneratorService._generate_requirements`)は、会話・観点の表(「key|名前|状態|決めたこと」)・前の版の要件(「ID|本文」)を入力に構造化出力(`RequirementsGenerationOutput`)を1回呼び、`build_model`で model にし、`render_requirements`で md を組み立てる。**ID**: AI には書かせず、前の版の同じ要件を`prev_id`で指させる。前の版に在る同じ種別の ID だけを引き継ぎ、それ以外は種別ごとの次の番号(`next_seq`。消えた ID は使い回さない)。**出どころ**: AI が付けた値に、根拠の観点の状態で上限をかける(決定 → user、採用 → adopted、未決・対象外・観点なし → assumed。規模だけでは上げない)。**付録と検証**は model に写した生成時点の観点の状態(`point_statuses`・`scale`)を読む。**検証**は警告だけ(`NO_MUST_REQUIREMENT`・`REQUIRED_POINT_OPEN`(中程度)、`REQUIREMENT_ON_NOT_APPLICABLE_POINT`・`ASSUMED_REQUIREMENTS`(軽微))。文書の応答(`GeneratedDocumentRead.requirements`)に出どころの件数・推測の要件・指摘を付ける(`document_read`)。手順書の対象外(`out_of_scope_lines`)は 1.4 の表の行(優先度が Should / Could / Won't)も読む。構造化出力の呼び出しは`llm_retry.invoke_structured`(段階の生成と共有)、観点の表の読み出しは`HearingPointRepository.load_states`(チャットと共有)。
  * **Phase 37 で実装した部分(外部設計書)**: `app/documents/external_design`(`model`・`assemble`・`markdown`・`validation`・`drafting`)。model は要件定義書と同じく`generated_documents.model`に版ごとに持つ(列は増やさない)。生成(`DocGeneratorService._generate_external_design`)は、要件定義書の md と前の版の画面(「ID|画面名」)を入力に構造化出力(`ExternalDesignGenerationOutput`)を1回呼び、`build_model`で model にし、`render_external_design`で md を組み立てる。**画面ID**: AI には仮の画面ID を書かせ、前の版に在る ID だけを引き継ぎ、それ以外は次の番号(`next_seq`)。API の関連画面も同じ対応表で付け替える。採番は要件ID と共有する`app/documents/ids.py`(`carry_over_ids`)。**API**: メソッドを大文字にそろえ、形の違う行と同じ API(`endpoint_key`)の2行目を捨てる。**要件の照合**: 同じ生成の要件定義書の model から、要件ID の一覧と Must の機能要件ID を model に写す(`known_req_ids`・`must_fr_ids`。写しが空なら照合しない)。**検証**は警告だけ(`MUST_REQUIREMENT_UNCOVERED`・`API_BODY_MISSING`(中程度)、`UNKNOWN_REQUIREMENT_ID`・`UNLINKED_ROWS`・`UNKNOWN_SCREEN_REF`(軽微))。指摘の型は要件定義書と共有する`app/documents/issues.py`の`DocumentIssue`(応答は`DocumentIssueRead`)。文書の応答(`GeneratedDocumentRead.external_design`)に行数と指摘を付ける。2.6 の列名(メソッド・パス・概要・関連画面)は以前のままにしたので、`api_list.extract_api_endpoints`(段階1・簡易モードの段階8)は変えていない。
* **後続は md を読む**: 段階・自己診断・簡易モードの後続の文書は、model から組み立てた md を今と同じく入力にする。要件ID は md に出るので、段階1の下書き・WBS がそれを参照できる。
* **要件 → 処理**: 段階1の機能の行に`req_ids`を足す(`FunctionRow`)。段階1の検証に、処理の無い Must の機能要件(中程度)・要件の無い処理(軽微)・要件定義書に無い要件ID(軽微)を足す。要件定義書に model が無いプロジェクトは「要件ID が無い」の軽微な指摘だけにする。簡易モードは`simple_procedure/wbs.parse_wbs`が WBS の「要件」の行を読む。
  * **Phase 38 で実装した部分**: 追跡の純粋関数は`app/detailed_design/requirement_trace.py`(`RequirementIndex`・`index_from_requirements`・`index_from_external_design`・`api_req_ids`・`normalize_req_id`・`unit_req_ids`・`requirement_trace`・`constraint_rows`)。段階1の処理を読むので`app/documents`でなく`app/detailed_design`に置いた。`FunctionRow.req_ids`・`FunctionDraft.req_ids`、`merge_draft`の`api_req_ids`(外部設計書の model の API 行を`endpoint_key`で引き、在れば写す。再生成で前の版の`req_ids`は引き継がない)。`StageSources.document_models`(入力の文書の表示中の版の model。`DesignStageService._sources`が詰める)。段階1の検証は外部設計書の model の写し(`known_req_ids`・`must_fr_ids`)と照らすので、段階1の入力(fingerprint)は増えない。`PlanTask.req_ids`は簡易モードの WBS の「要件」欄だけが埋め(`parse_wbs`。「要件ID」も可、`fr-1`は`FR-001`にそろえ、形の違う値は`WBS_FORMAT`の軽微)、`normalize_plan`も引き継ぐ。`ProcedureBasis.functions()`・`unit_req_ids()`(詳細設計モードは単位の処理の段階1の要件から導く)。`ProcedureOutputSource`は要件定義書の model から`requirements_available`・`unit_reqs`・`trace`・`constraints`・`requirement_texts`を持ち、index の md・HTML が「要件との対応」と非機能要件・制約の表を組み立てる。`DesignStageRead.unit_req_ids`(段階8だけ)。検証のコード: 段階1 `MUST_REQUIREMENT_UNPROCESSED`・`UNLINKED_FUNCTION`・`UNKNOWN_REQUIREMENT_ID`・`REQUIREMENT_IDS_MISSING`(すべて警告)、簡易モードの段階8 `MUST_REQUIREMENT_UNPLANNED`(中程度)・`UNLINKED_UNIT`・`UNKNOWN_REQUIREMENT_ID`・`REQUIREMENT_IDS_MISSING`(軽微)。詳細設計モードの段階8には足さない(段階1の検証と段階7の計画の漏れで追える)。

### 7. 変更影響分析・変更管理(ステージ7)

[外部設計書](external_design.md) 2.10節の内部の方針(Phase 41で確定)。経緯は[`textbook/Phase-41/Phase-41-2.md`](../textbook/Phase-41/Phase-41-2.md)。テーブル・API・マイグレーションは Phase 42 以降の着手時に決める(未確定事項は[`textbook/Phase-41/Phase-41-5.md`](../textbook/Phase-41/Phase-41-5.md))。

* **要素と参照は model から導く(純粋関数)**: 要件・画面・API(`endpoint_key`)は文書の model、処理・要約・CRUD・モジュール・手順・処理ロジック・作業単位・横断事項・単位の手順書は段階1〜8 の model から、要素(キー・置き場)と「A が B を参照する」辺(種類つき)を作る。本文の文字列からは辺を作らない。モジュールとテーブルの辺は、段階5の手順の行(呼び出し先と DB 欄が同じ行)から導く。グラフは標準ライブラリで足りる(外部のグラフライブラリは使わない)。
* **たどり方**: 「処理を軸」の規則(外部設計書 2.10)。改名は直接の参照元だけ。理由は辺の種類から決まる文。LLM は呼ばない。
* **横断事項の要件ID**: 段階7の横断事項に`req_ids`を足す(Phase 38 の案2。影響分析が使う)。
* **作業単位の安定キー**: 段階7の`PlanTask`に並べ替えで変わらないキーを持たせ、段階8の`UnitProcedure`(今は位置で決まる`unit_id`をキーにしている)と影響の記録はそのキーで指す。
* **Phase 42 で実装した部分**(経緯は[`textbook/Phase-42/Phase-42-introduction.md`](../textbook/Phase-42/Phase-42-introduction.md)):
  * **安定キー**: `PlanTask.key`(`U-001`…)と`PlanModel.next_unit_seq`。`assign_unit_keys`がキーの無い・重複したタスクに次の番号を振る(段階7の保存時と生成時)。作り直しは`carry_over_unit_keys`でタスク名が同じ単位のキーを引き継ぐ(Phase 49 で、処理・要件の重なりと似たタスク名でも引き継ぐようにした。下の「Phase 49 で直した部分」)。段階8は`UnitProcedure.unit_key`で単位に付き、表示の`unit_id`は`relabel_units`が今の並び順から付け直す(検証・出力・画面の応答・生成の前)。キーの無い単位(簡易モードの WBS)は単位の ID をキーにする(`PlanUnit.key`)。改名(タスク名の不一致)は今までどおり`UNIT_MISMATCH`。既存データは Alembic `d4e5f6a7b8c0`(段階7に並び順でキーを振り、段階8を今の`unit_id`で突き合わせる。状態と版は変えない)。単位の間の`depends_on`は表示の ID のまま。
  * **横断事項の要件ID**: `CrossCuttingRow.req_ids`。横断事項の生成(構造化出力)が要件定義書の ID を書き(形をそろえ、形の違う値は捨てる)、検証は外部設計書の model の要件ID の一覧と照らして`UNKNOWN_REQUIREMENT_ID`(警告)。画面の横断事項の表に「要件」の列。
  * **要素と参照・たどり方**: `app/detailed_design/impact/`(`elements`・`trace`。純粋関数)。`DesignModels.from_dicts(stages, documents, er_tables)` → `build_elements` → `impact_of(elements, Change(key, kind))` → `ImpactItem(key, path, reason)`。辺は12種(デモの11種に、手順書が参照する手順・処理ロジックの`implements`を足した。手順書の参照は段階8の`unit_refs`と同じ規則)。モジュールとテーブルの辺は、手順の行の DB 欄(`parse_db_tables`。段階3 の CRUD・ER に在る名前だけ)と同じ行の呼び出し先から作る。API・画面・写しはまだ無い(Phase 43・44)。
* **差分**: 段階は直前の承認時の model の写し(1件)と今の model を、要素のキーで比べる。文書は`generated_documents.model`の版同士を比べる。今の陳腐化(`app/detailed_design/stages.py`の`derive_states`。段階単位・版数の比較)は変えず、その上に要素の印と「確認済み」を重ねる。
* **Phase 43 で実装した部分**(経緯は[`textbook/Phase-43/Phase-43-introduction.md`](../textbook/Phase-43/Phase-43-introduction.md)):
  * **写し**: `design_stages.approved_model`(承認時だけ撮る)。段階3は ER のテーブル定義を`er_snapshot`で添える(ER は段階の model の外の図のため。テーブルの要素の内容に列と説明を入れる)。
  * **差分**: `app/detailed_design/impact/diff.py`の`diff_elements`。要素の内容`Element.body`(キーの欄・CRUD の下書きの印を除いた正規化した JSON)を比べ、辺は比べない。同じ種類・同じ内容で1対1なら改名(ID が名前そのものの種類だけ)。改名に合わせて参照の文字列を書き換えただけの変更は変わったものに入れない。`to_trace_changes`で`impact_of`の`Change`にする(増えた要素は除く。消えた要素は前のキー)。
  * **印の記録**: 段階の承認時(写しと比べる)と、文書の表示中の版の切り替え時(生成・復元。前に表示していた版と比べる。詳細設計モードの要件定義書・外部設計書だけ)に、`app/detailed_design/impact/marks.py`の`marks_for`で印を求め、届いた段階(一度でも承認した段階だけ)の`design_stages.impact`に`record`で足す。前後の要素を合わせたグラフでたどる(消えた要素・改名の前のキーを、まだ参照している要素から見つけるため)。文書の要素と変わった要素そのものには付けない。同じ要素に新しい変更が届いたら未確認に戻す。写しが1件だけなので、その場で差分を取らず変わった時に記録する(上流を承認し直すと写しが置き換わるため)。
  * **承認し直し**: 他の段階・文書から届いた未確認の印があれば承認は409(`DESIGN_STAGE_UNREVIEWED_IMPACT`)。自分の承認で付いた印(同じ段階の中の依存)は止めない。承認でその段階の印は消える。
  * **API**: `GET /design-stages/impact`(記録した印と、承認前の編集の pending の印・再生成の候補)・`POST /design-stages/{stage}/impact/review`。`DesignStageRead.impact_open`・`impact_reviewed`。画面は Phase 44。
* **Phase 44 で実装した部分**(画面。経緯は[`textbook/Phase-44/Phase-44-introduction.md`](../textbook/Phase-44/Phase-44-introduction.md)。devex-api は変えていない):
  * **状態**: devex-ui の詳細設計画面のストアが影響(`impact`)と強調する行(`highlight: {stage, key}`)を持つ。影響は、印か承認の後の編集がある詳細設計モードのときだけ、段階の一覧の後に取る。要素のキーは`src/features/detailed-design/impactOps.ts`の`elementKey`で、devex-api の`elements.py`と同じ形に組み立てる。
  * **「変更の影響」パネル**: 作業領域の上に全幅で置く(変わったもの → 段階ごとの印 → 再生成の候補)。確認済みは行ごとと段階ごと。pending の印は確認済みにできない。文書の要素には印を出さない。承認し直しを止めるのはサーバーの409だけで、画面は件数と案内を出す。
  * **表の印と強調**: 段階1〜8 の表の行(段階3の CRUD 図はセル)に印を出し、「表で見る」と「段階Nで直す」で移った先の行を強調する。「段階Nで直す」の直す先(LLM が書く文字列)は、処理ID・テーブル名・パス・関数名・単位の ID・横断事項の項目を段階の model と照合して要素のキーにする。
  * **部分再生成**: 再生成の候補のキーを生成の引数に変える(段階5は処理ID、段階6はモジュールと関数、段階8は単位のキーから今の表示の ID)。段階ごとにまとめて選び、その段階へ移ってから生成を呼ぶ。再生成しても印は確認済みにしない。
* **簡易モード**: 内部設計書・実装計画書を意味モデルにする(要件定義書・外部設計書と同じ「構造化出力 → model → md」)。段階8が読む今の解析(`app/simple_procedure/`)は model を読むようにする。
* **Phase 45 で実装した部分**(簡易モードの文書の model。経緯は[`textbook/Phase-45/Phase-45-introduction.md`](../textbook/Phase-45/Phase-45-introduction.md)):
  * **内部設計書**: `app/documents/internal_design`(`model`・`assemble`・`markdown`・`validation`・`drafting`)。model はテーブル(列)・API エンドポイント一覧・モジュール一覧(段階4と同じ`ModuleRow`)・処理別データフロー(トリガー・流れの行・データ項目)の行と、3.1・3.2 の概要・3.3 の分割方針・3.4 の本文。md は以前のプロンプトと同じ見出し(`### テーブル:`・`### モジュール一覧`・`#### DF-<n>:`)で組み立て、本文の見出しは太字にする(節の切り出しが切れないように)。**処理別データフローの ID**: AI には書かせず、前の版に同じ処理(同じ API の`endpoint_key`・同じバッチ名)があればその ID、無ければ次の番号(`next_dataflow_seq`。消えた ID は使い回さない。`DF-1`の形はそのまま)。**照合の写し**: 同じ生成の外部設計書の model の API(`external_apis`)。**検証**(警告だけ): `NO_MODULE_LIST`(最重要)・`API_WITHOUT_DATAFLOW`(中程度。外部設計書の API に処理別データフローが無い)・`DATAFLOW_API_UNLISTED`・`DATAFLOW_EMPTY`(軽微)。
  * **実装計画書**: `app/documents/implementation_plan`(同じ5つ)。model はマイルストーン・タスク・リスクを段階7の型(`Milestone`・`PlanTask`・`Risk`)で持ち、`to_plan()`で段階7と同じ`PlanModel`にする。4.1・4.3 は本文。md は以前の WBS の書式。依存先は AI の書いた ID を並び順の ID に読み替える(`plan.renamed_task_ids`。WBS の解析と共有)。**キー**: 前の版の model からタスク名で引き継ぎ(`carry_over_unit_keys`)、残りに次の番号。**照合の写し**: 内部設計書の model の処理の ID(`known_dataflow_ids`)、要件定義書の要件ID・Must の機能要件ID。**検証**(警告だけ): `NO_TASKS`(最重要)、`FEATURE_WITHOUT_DATAFLOW`・`UNKNOWN_DATAFLOW`・`UNKNOWN_DEPENDENCY`・`FORWARD_DEPENDENCY`・`MUST_REQUIREMENT_UNPLANNED`(中程度)、`UNPLANNED_DATAFLOW`・`UNLINKED_UNIT`・`UNKNOWN_REQUIREMENT_ID`(軽微)。段階8の検証も同じ書き落としを単位ごとに出す(文書の検証は同じ種類を1件にまとめてプレビューに出す)。
  * **生成**: 4文書とも構造化出力になり、md をそのまま書かせる経路(`_DOC_TYPE_PROMPTS`・`_generate_one`)は消した。入力の文書(`_DOC_TYPE_INPUTS`)は変えていない。文書の応答に`internal_design`・`implementation_plan`(`DocumentSummaryRead`。行数と指摘)。
  * **段階8**: `procedure_basis`に`document_models`を渡し、簡易モードは内部設計書・実装計画書の model があれば model から読む(`simple_procedure.book_from_model`・`to_plan`)。model の無い以前の版は今までどおり md を解析する。model から読んだ単位は安定キー(`U-001`)を持つ(以前の版は単位の ID がキー)。
  * 既存の文書は移していない(再生成で model を持つ)。
* **Phase 46 で実装した部分**(簡易モードの変更の影響。経緯は[`textbook/Phase-46/Phase-46-introduction.md`](../textbook/Phase-46/Phase-46-introduction.md)):
  * **要素**: `app/detailed_design/impact/simple.py`(`SimpleModels.from_dicts(stage8, documents)` → `build_simple_elements`)。置き場0に要件・画面・API(詳細設計モードと共有の`add_document_elements`)、処理別データフロー`df:DF-1`(種類`dataflow`。→ トリガーの API・本文に名前の出るテーブル)、テーブル`table:`・モジュール一覧の行`module:`、実装計画書のタスク`task:U-001`(→ DF・要件・モジュール)。置き場8に単位の手順書`unit:U-001`(→ タスク・DF・モジュール)。計画とモジュールは段階8と同じ規則(`book_from_model`・`normalize_plan`・`simple_unit_refs`・`module_layer`)。内部設計書 3.3 の API 行は要素にしない。
  * **たどり方**: `trace.py`の軸の判定(`_is_axis`)を、処理・DF・文書のタスク(置き場0)に広げた。詳細設計モードの挙動は変えていない。
  * **記録**: `record_document_change`が簡易モードも扱う(`IMPACT_DOCUMENTS`をモードごとにし、簡易モードは4文書)。`_impact_by_stage`・`_record_impact`は要素の列を受け、組み立てはモードで切り替える。承認前の編集の pending の印は詳細設計モードだけ。
  * **画面**: devex-ui の`mayHaveImpact`は、簡易モードでは記録した印があるときだけ影響を取る。詳細設計画面は簡易モードでも「変更の影響」パネルを出す(段階8の単位の行の印は Phase 44 の部品のまま)。

* **Phase 48 で実装した部分**(段階3・5 の書き落とし。経緯は[`textbook/Phase-48/Phase-48-introduction.md`](../textbook/Phase-48/Phase-48-introduction.md)):
  * **段階3**: DFD の下書きのプロンプト(`DFD_SYSTEM_PROMPT`)に、処理 → データストアの線は作成・更新・削除する処理にだけ描く規則を足した。`merge_crud`は、DFD に書き込みの線があるのに AI の C/U/D が無いセルに`infer_write_ops`(処理の名前から推定)の文字を足し、`CrudCell.inferred`の印を付ける(真のときだけ保存する。印の無いセルの保存の形は変えない)。検証の警告 `DFD_WRITE_INFERRED`、`DFD_WRITE_MISSING`の文に DFD を直す案内を足した。人が書き換える(devex-ui の`setCellOps`)か承認(`confirm_drafts`)で印は外れる。変更の影響の差分では、`draft`と同じく内容に入れない。
  * **段階5**: 生成のスキーマの`GeneratedStep`から`is_branch`・`branch`を外し、`branches: list[GeneratedBranch(condition, result)]`にした。`to_procedure_draft`が元の手順の直後に分岐の行を並べ、`merge_procedure`が空の行を捨てた後に`link_branch_refs`で参照(「2a へ」、複数は「2a へ、2b へ」)を並びから振る(AI の書いた参照は消す)。保存の model(`ProcedureStep`)・画面・既存データは変えていない。ステージ6の測定の stage5.json に当てると、`MISSING_BRANCH_TARGET` は 15 → 0・4 → 0。

* **Phase 49 で直した部分**(効果測定で基準に届かなかった分。経緯は[`textbook/Phase-49/Phase-49-introduction.md`](../textbook/Phase-49/Phase-49-introduction.md)):
  * **たどり方**(`trace.py`): テーブルの変更は処理まで上らず、読み書きする要素と、その手順を実装する処理ロジック・手順書まで。文書の要素の変更では、届いた処理の CRUD と作業単位(段階7のタスク。簡易モードの軸のタスクは除く)を示さず、要件・画面の変更では要約も示さない。画面は、変わった要素そのもののときだけ通る(要件が共有の画面を通って別の処理へ広がらない)。辺を1種足した: `receives`(手順の最初の呼び出し先のモジュール → 処理のトリガーの API)。API の変更で、API を受ける入口のモジュールが直接の参照元になる。非機能要件 → 横断事項の対象のモジュールを使う手順(ベースラインの S2)は、ID の辺では届かないので範囲の外とした。
  * **差分の再生成**(`app/documents/revision.py`と4文書の`drafting`・`assemble`): 再生成では、AI に前の版の行(1行1つの JSON)と、上流の文書で前の版から変わった行(`DocGeneratorService.upstream_changes`。要件定義書の上流は会話)を見せ、変えない行を`unchanged`と答えさせる。組み立てが前の版の同じ行(要件ID・画面ID・API・テーブル名・モジュールのパス・処理別データフローのトリガー・タスクのキー)をそのまま使う。実装計画書のタスクは`prev_key`で前の版のタスクのキーを指させる(依存先は並び順の ID なので今回の並びのもの)。
  * **単位のキーの引き継ぎ**(`carry_over_unit_keys`): 前のキーを持つタスク → タスク名が同じタスク → 種別が同じで処理・要件の重なり(Jaccard)が大きい順、重なりが無ければタスク名が似ている(`difflib`の比 0.6 以上)もの、の順に1対1。
  * **タスクの要素の内容**(`elements.task_body`): 依存先を単位のキーに読み替えて比べる(マイルストーンの並べ替え・挿入で表示の ID がずれただけのタスクを変わったものにしない)。

---

### 8. AI 設計レビュー + テスト設計(ステージ8)

[外部設計書](external_design.md) 2.11節の内部の方針(Phase 51で確定)。経緯は[`textbook/Phase-51/Phase-51-2.md`](../textbook/Phase-51/Phase-51-2.md)。テーブル・API・マイグレーションは Phase 52 以降の着手時に決める(未確定事項は[`textbook/Phase-51/Phase-51-5.md`](../textbook/Phase-51/Phase-51-5.md))。

* **LLM の取得を役割で分ける**(ステージ9 で「ユーザーと用途 → LLM」の解決に替える。9項): 生成は今の`get_gemini_llm()`。レビューは`get_review_llm()`(Claude Sonnet)、狭い判定は`get_judge_llm()`(Claude Haiku)。モデル名は設定で替えられる。`langchain-anthropic`を依存に足し、`ANTHROPIC_API_KEY`を設定に足す。構造化出力は`method="json_schema"`(Sonnet 5.5 はツール呼び出しの強制による構造化出力を推奨しない)。偽 LLM にレビューの応答を足す。
* **レビューの入力と出力**: 入力は文書の md・観点の表・決定的な検証の指摘(Phase 51 の測定の (d) と同じ組み立て。`appendix/stage8-baseline/review.py`)。出力は指摘の一覧(構造化出力)。プロンプトキャッシュは使わず、回にキャッシュの読み書きのトークンを記録して、Phase 58 の測定で入れるかを決める(Phase 52・53 の着手時の決定)。
* **データ**: レビューの回(プロジェクト・区切り・対象の文書の版・モデル・状態(成功・失敗)・トークン)と指摘(重要度・原因・対象・観点のキー・問題・引用・理由・改善案・採否)を持つ。ユーザーにレビューの設定(初期値オフ)を持たせ、実効値は`is_superuser and 設定`でサーバーが判定する。
* **区切り**: 文書の生成(`DocGeneratorService`)の終わりで、実効値がオンならレビュー、オフなら今の自己診断。段階6・7 のレビューはボタンで流す(`app/review/gates.py`。Phase 53)。段階の区切りは、要件・外部の表示中の版の md と、詳細設計書の md(段階6は01〜06章、段階7は01〜07章 + 実装計画書の md。詳細設計書の出力と同じ組み立て)を渡し、段階の検証の指摘も既知として渡す。回の`targets`は文書の版と段階の承認した版(`{doc_type: 版, "stage:N": 承認した版}`)。区切りの状態は「文書がまだ無い(段階が承認されていない)/ 未レビュー / 実行中 / レビュー済み / 失敗」で、最新の回の`targets`が今の版と一致しなければ未レビュー(承認し直した・文書を作り直した後)。
* **指摘の関連文書**(Phase 53 の完了後の調整): 指摘に`documents`(直すときに書き換える文書の種類、上流から)を持たせる。レビューのモデルが返し(構造化出力の必須の欄)、その回に渡した文書だけに絞って保存する(`review_findings.documents` JSON。列を足す前の指摘は null で、画面が対象の書き方から推定する)。
* **API**(Phase 52・53): `PUT /users/me/review-settings`(superuser 以外は403)・`GET /projects/{id}/reviews`(モードの区切りごとの`{gate, ready, status, run}`)・`GET /projects/{id}/reviews/{gate}`(最新の回、`is_current`付き)・`POST /projects/{id}/reviews/{gate}`(受け付けて202、実行はバックグラウンド。403/409/429/502)・`PUT /projects/{id}/reviews/findings/{finding_id}`(採否`{decision: pending/adopted/rejected/held}`。他のプロジェクトの指摘は404)。チャットには件数の一行の知らせだけを出し、指摘はレビューのパネルで見る。
* **失敗と上限**: レビューの例外は生成を失敗にしない。失敗の回を記録し、自己診断を出す。1日の回数の上限は既存のレート制限(Redis)の仕組みで数える。
* **差し戻し**: 採用した設計・不整合の指摘から再生成の指示の文をコードが組み立て、今の再生成(文書・段階の部分再生成)に渡す。採用したヒアリングの指摘は`hearing_points`の観点を`open`に戻し、チャットの最初の問いかけに指摘をまとめる(Phase 54。詳細は次の4項目)。
* **再生成の指示**(Phase 54): `POST /projects/{id}/generate`と`POST /projects/{id}/design-stages/{stage}/generate`の本文に`finding_ids`(採用した、ヒアリングが原因でない指摘。違えば409 `SENDBACK_FINDING_INVALID`、無ければ404)。文書は作り直す文書ごとに関連する指摘だけを`## 修正指示`の節に入れ(`app/review/sendback.py`)、`REVISION_RULE`の変更のきっかけに【修正指示】を足す。段階は生成の全呼び出しの最後の人のメッセージに足す。
* **聞き直し**(Phase 54): `POST /projects/{id}/reviews/rehearing {finding_ids}`(採用した、ヒアリングが原因の、観点のキーのある指摘)。観点を`open`にし、聞き直しの発言(AI の発言としてコードが組み立てる)の id を`hearing_points.reopened_after`に記録する。判定はその発言より後の利用者の発言を根拠にしないと、観点を決まったことに戻さない。完成したプロジェクトは`revising`にし、完了判定は表から作り直す。判定のプロンプトに「公開サービスでは、アクセス制御が分かるまで security を決めない」を足した。
* **判断を委ねられたとき**(Phase 59): 利用者が「おすすめでよい」のように委ねても、直前の AI の提案に具体的な値・方式が無ければ、判定は観点を`open`に残す(判定のプロンプトの規則。`adopted`の要約には同意した値・方式を書かせる)。委ねる発言(`_DELEGATION`)の後の返信には、コードが「次の観点を具体的な値・方式の選択肢カード1枚で聞く」指示(`_DELEGATED_NOTE`)を添える。要件定義書の再生成は、観点の表の決めたことが前の版の要件と食い違えば、その観点の要件を`unchanged`にせず書き直す(聞き直しで決め直した値を写すため)。
* **採用した指摘の追跡**(Phase 54、決定的・費用なし): 指摘の関連文書を回の版のキーに読み替え(詳細設計書は段階1〜6、実装計画書(詳細)は段階7)、今の版(文書は表示中の版、段階は内容の版)と比べる。変わっていなければ`unaddressed`、変わったが対象の行(文書は`revision.py`の行、段階は`impact`の要素。対象の文字で結ぶ)が同じなら`target_unchanged`、それ以外は`changed`(`app/review/followup.py`)。段階の区切りの回は、レビューした段階の内容の写し(`review_runs.snapshots`)を持つ。`ReviewFindingRead.followup`、区切りの`adopted_before`(前の回で採用した指摘)で返す。
* **「直ったか」の判定**(Phase 54、シャドーモード): `changed`の採用した指摘を、`get_judge_llm()`(Claude Haiku。`JUDGE_MODEL`)に、指摘と、対象の行のレビューしたときの内容・今の対象の行と足した / 変えた行(結べなければレビューの引用と今の文書の本文)で判定させ、`review_fix_checks`(判定したときの版・`fixed / partial / not_fixed / unsure`・理由・トークン)に記録する。文書の生成の後と段階の承認の後に、レビューがオンのアカウントだけ・今の版で1回・1回10件・1日200回。画面は今の版についての判定だけを`ReviewFindingRead.fix_check`で返す。
  * **重複の防止**(Phase 59): 承認を続けると判定がバックグラウンドで並行に走り、どれも「今の版で未判定」と見る。判定の前に (指摘, 判定する版) の予約札を Redis に`SET NX EX 600`(`fix_check:{指摘}:{版のハッシュ}`)で置き、置けた処理だけが判定する。版が変われば鍵も変わる。渡す内容が無く判定しなかったとき・回数の上限で止めたときは札を消す。
* **テスト仕様書**: model(構造化出力)→ md をコードが組み立てる(要件定義書と同じ)。レビューには渡さない。決定的な検証で、Must の要件にテストが無い・存在しない要件 ID や API を指す・異常系のテストが1件も無い API を指摘する。
  * **パッケージ**(Phase 56): `app/documents/test_spec/`(`model`・`obligations`(必要なテストの一覧)・`links`(API → 処理 → 単位)・`assemble`・`markdown`・`validation`・`drafting`)。`generated_documents`の`doc_type="test_spec"`(列は文字列なので Alembic は要らない。版は3件まで)。`DOC_TYPES_BY_MODE`には入れない(レビュー・区切り・自己診断・段階の入力に入らないように。`TEST_SPEC`は別の定数)。
  * **model**: `TestSpecModel(policy, integration, system, known_req_ids, req_priorities, must_fr_ids, known_apis, known_screens, inputs)`。テストは`SpecCase(id, level, target, viewpoint, precondition, steps, expected, design_gap, req_ids, screens, functions, units)`。ID(`IT-001`・`ST-001`)は生成のたびに並び順で振る(後続から参照されないので引き継がない)。結合テストの対象は外部設計書の同じ API(`endpoint_key`で照合)の書き方にそろえる。
  * **生成**: `DocGeneratorService.generate`の最後(`generation_targets`が簡易は4文書の後に必ず足し、詳細は`start_from="test_spec"`のときだけ)。入力は要件定義書の md・外部設計書の画面(UI 仕様の本文を除く)と API の行・必要なテストの表。`record_document_change`(影響の印)・自己診断・設計レビューには渡さない。詳細の前提は`DesignStageService.approved_stages(project, (1, 7))`(承認済みで古くない段階の版と内容)。
  * **今の版と「古い」**(Phase 57): `app/services/test_spec_state.py`の`current_test_spec`(今の版・model・古いか)と`spec_inputs`(入力の今の版)。`GET /test-spec`と詳細設計書の zip が共用する(`doc_generator_service`は`review_service`経由で zip のサービスを読むので、循環を避けて別のモジュールにした)。
  * **検証の指摘**: `MUST_REQUIREMENT_UNTESTED`(major)・`UNKNOWN_REQUIREMENT`(major)・`UNKNOWN_API`(major)・`UNKNOWN_SCREEN`(minor)・`API_WITHOUT_ERROR_TEST`(minor。テストが0件の API も含む)。写しが空ならその照合はしない。
  * **必要なテストの一覧**(`obligations.required_tests`。Phase 59 で拡張): API ごとに正常1件・エラー欄の HTTP ごとに異常・本文のある API に境界・パスの`{…}`か本文の`…_id`の項目(`body_ids`)ごとにセキュリティ、総合は Must の画面の流れ1件・Must の画面ごとの操作(入力の検証・空の送信・エラーの表示。異常)・非機能要件ごと・Must の機能要件ごと(API に結ばれていても要件の中身を確かめる。文が失敗・中断を書く要件は異常の観点で「失敗の後に保存されない・やり直せる」)。エラー欄のステータスの取り出し`error_statuses`は`app/detailed_design/api_list.py`(簡易の手順書の検証と共有)。
* **実装手順書の決定的な検証**(Phase 55): 実装可能性チェック(段階8の検証。両モード)に、単位が作るファイルの網羅と順序を足した(`app/detailed_design/procedure_coverage.py`。純粋関数)。単位が作るファイルは、段階7(簡易は WBS)のモジュール・環境・設定のファイルと手順書のファイルを合わせたもの。
  * `DEPENDENCY_BUILT_LATER`(中程度・段階7 / 実装計画書): モジュール一覧の行を最初に作る単位をその行の作り手とし、行の依存先(詳細は段階4、簡易は内部設計書のモジュール一覧の`depends_on`)の作り手が依存する単位より後ろ。除くもの: 基盤の単位のファイル(アプリの組み立てなど、後の機能の単位がつなぐ)、依存先を作る単位かそれより後の単位が依存する側のファイルも変更する場合(そこでつなぐ)、外部のライブラリ(一覧の行の`*`だけに当たる依存先は行を指さない)。
  * `NO_TEST_FILE`(軽微・段階8): 手順書にテスト観点があるのに、ファイルにテストのファイル(種類`test`か、`tests/`・`test_*`・`*.test.ts(x)`などのパス)が無い。生成の指示に「tests を書いたら、テストのファイルを files に kind=test で入れる」を足した。
  * `NO_SCHEMA_UNIT`(最重要・全体1件): どの単位もスキーマのファイル(区切りに`models`・`migrations`・`alembic`・`entities`など、または`.sql`・`.prisma`。層の名前は見ない)を作らない。直す先は、モジュール一覧にスキーマの行が無ければ段階4 / 内部設計書、あれば段階7 / 実装計画書。
  * `TABLE_WITHOUT_UNIT`(軽微・段階7 / 実装計画書): スキーマのファイルのパス・責務に名前(単数形も)の出ないテーブル(詳細は段階3の CRUD 図、簡易は内部設計書 3.2節)。テーブル名の出ないスキーマのファイル(`orm.py`のようにまとめたもの)があれば全テーブルを作るとみなす。
  * `NO_ERROR_TEST`(軽微・段階8。簡易モードだけ。Phase 59): 機能の単位の処理(DF)の API の外部設計書 2.6 のエラー欄に HTTP ステータスがあるのに、手順書のテスト観点(観点・SUT・Given / When / Then)にどれも出ず、観点の文に異常系の言葉(エラー・失敗・拒否・異常・不正)も無い。簡易の参照の 2.6 の行にエラー欄を添え、生成の指示に「正常系に加えて、エラー欄のステータスごとに異常系の観点を1つ」を足した。
  * **スキーマの単位を置かせる指示**(Phase 59): 段階4 の構成図にモデル(ORM)のパッケージ、モジュール一覧にリポジトリとは別のモデルのファイル(責務にテーブル名)を置かせ、段階7 の計画に「テーブルを作るタスク(モデルとマイグレーション)を最初のマイルストーンに置く。モデルは一覧から modules、マイグレーションは config_files」を足した。

### 9. 使い勝手とアカウント・モデル設定(ステージ9)

[外部設計書](external_design.md) 2.12節の内部の方針(Phase 61で確定)。経緯は[`textbook/Phase-61/Phase-61-1.md`](../textbook/Phase-61/Phase-61-1.md)。テーブル・API の細部は各 Phase の着手時に決める(未確定事項は[`textbook/Phase-61/Phase-61-3.md`](../textbook/Phase-61/Phase-61-3.md))。

* **認証ページの proxy**: refresh cookie は API のオリジン(`path=/api/v1/auth`)にあり、アクセストークンはメモリにしかないため、UI の proxy からはログインの状態が見えない。UI のオリジンにログインの印の cookie(値は意味を持たない印。秘密を入れない)を置き、`src/proxy.ts`(Next.js 16 で `middleware.ts` から改名)で `/login`・`/register` を `/dashboard` へ振り分ける。印は認証の判定に使わない(判定は今のまま API)。印は `devex_logged_in=1`(`Path=/`・`SameSite=Lax`・https なら `Secure`・寿命は refresh と同じ14日で、login・refresh のたびに付け直す)。付け外しは `auth-store` に集める(`login()`・`refreshTokens()` の成功で付け、`logout()`・`refreshTokens()` の失敗で消す。`apiFetch` の 401 もここを通る)。メニューのログアウト(読み込み直し)は、読み込み直す前に消す。戻り先は `safeRedirectPath`(`//`・`/\` で始まるものを断る)で確かめ、ログインの後の遷移(`LoginForm`)と共有する(Phase 63)。
* **プロジェクトの削除**(Phase 64 で確定): `DELETE /projects/{id}`(所有者だけ。他人・無いものは404)。**生成中も削除できる**。
  * **削除の印 → 後で物理削除**: 文書の生成・段階2〜4 の生成・「直ったか」の判定は、LLM を呼ぶ間もトランザクションを開いたままにする。そのため、子の行を書いた後は親の行に外部キーのロック(FOR KEY SHARE)を持ち、物理的な`DELETE FROM projects`はジョブが終わるまで(数分)待たされる。そこで削除の要求は`projects.deleted_at`に印を付けるだけで、すぐに 204 を返す(キーでない列の更新はそのロックとぶつからない)。`ProjectRepository.get_by_id`・`list_for_user`は印の付いた行を返さないので、`/projects/{id}/...`はすべて404になる。Redis の生成の進み具合の鍵(`doc_generation:{id}`)も削除の要求で消す。
  * **物理削除**(`app/services/project_deletion.py`の`purge_deleted_projects`): 印の付いた行を`FOR UPDATE SKIP LOCKED`で取り、`DELETE`で消す(子・孫の行は DB の CASCADE)。子の行のロックは`lock_timeout`3秒まで待ち、取れなければ次の機会に回す。DELETE の BackgroundTask と、バックグラウンドの処理の4つの入口(`generate_documents`・`execute_review`・`run_fix_checks`・`run_design_stage_generation`)の終わりに試す。消し残った行は印があるので画面には出ない。
  * **バックグラウンドの処理の規則**: 入口でプロジェクトが無いか印があれば終える。失敗の記録の前(rollback の後)に確かめ、消えていれば失敗の通知も状態の戻しも書かない。成功・失敗の commit は`commit_if_live`を通す(生きていれば書いて commit、消えていれば rollback。書き込み・commit で外部キーの違反・行の無い更新(`IntegrityError`・`StaleDataError`)が出たときも、消えていれば同じ)。記録はログ(`project_deleted_during_job`)だけ。確かめてから commit するまでに印が付いたときは、結果は印の付いたプロジェクトに入り、後の物理削除で消える。
* **一覧**: `GET /projects?q=&mode=&status=&page=` は`{items, total}`を返す(1ページ10件。**レスポンスの形が配列から変わる**)。`q`はタイトルの部分一致(大文字・小文字を区別しない)。
  * **Phase 65 で確定**: `status`は繰り返して複数を受け、どれかに一致(OR)。条件どうしは AND。`q`は前後の空白を落とし(空なら絞らない)、`ILIKE`の`%`・`_`は文字として扱う(エスケープする)。並びは`updated_at`の降順、同じ時刻は`id`の降順(ページの境目を安定させる)。`total`は条件に合う全件数(別の`count()`)。最後より後の`page`はエラーにせず、空の`items`と本当の`total`を返す。不正な値(知らない`status`・`mode`、`page < 1`、101文字以上の`q`)は 422。`ProjectRepository.list_for_user`は`search_for_user`に置き換えた。
  * **UI**: 条件とページは URL(`/dashboard?q=&mode=&status=&page=`。既定値は書かない)に持ち、`useSearchParams`で読む(ページ側で`Suspense`に包む)。`dashboard-store`の cache(20秒)は、条件の文字列を鍵にして最後の1つだけ持ち、鍵が同じときだけ効く。待つ間に条件が変わった古い応答は捨てる。削除(`removeProject`)はカードを外して`total`を1減らし、cache を切って今のページを取り直す(次のページの先頭が繰り上がる)。取り直してページが最後より後なら、最後のページへ URL を置き換える。
* **アカウント**: `users.full_name` を `user_name` に改名する(Alembic の列の改名。データは残す)。`PATCH /users/me`(ユーザーネーム)、メール・パスワードの変更は今のパスワードで確かめる(メールの重複は409)。パスワードを変えたら、その人の refresh(Redis の`refresh_token:{user_id}:*`)を全部失効させる。
  * **Phase 66 で確定**: API は操作ごとに3つに分ける(`PATCH /users/me`・`PUT /users/me/email`・`PUT /users/me/password`。確かめの要否と副作用が操作ごとに違うため)。今のパスワードの不一致は **400** `CURRENT_PASSWORD_MISMATCH`(401 にすると、画面の`apiFetch`がセッション切れとみなしてログアウトするため)。今のパスワードの試行は、ログインと同じ上限(`AuthRateLimiter.enforce_login`。IP と今のメール)で数える。新しいパスワードの規則(8〜128文字・大文字・小文字・数字・ASCII の記号)は`app/core/password_policy.py`に置き、変更の API だけが課す(登録の API には課さない。既存のアカウントと、規則より前のテストのパスワードを断らないため)。パスワードの変更は、ハッシュを替えて commit → `AuthService.revoke_all_refresh_tokens`(SCAN で鍵を探して消す)→ 今の端末に access と refresh を出し直す(`app/api/refresh_cookie.py`の`set_refresh_cookie`。ログインと共有)。アクセストークン(30分)は失効させない(ほかの端末も、次の refresh で切れる)。同じメールへの変更は何もせずに成功を返す。
* **モデルと API キー**: 新しいテーブル2つ ── 用途ごとのモデル(ユーザー・用途(`chat`・`generation`・`review`・`judge`)・provider・モデル。`user_id`が null の行がシステムの既定値)と、provider ごとの API キー(ユーザー・provider・暗号文・末尾の数文字。キーは Fernet で暗号化し、鍵は環境変数 `ENCRYPTION_KEY`)。鍵が無いときはキーの登録の API だけ 503 にする。選べるモデルは API 側の静的なカタログ(provider → model ID の表)に置き、カタログに無いモデルは保存で断る。キーは保存のときにモデルの一覧の取得で確かめる(無効なら422)。`scripts/seed.py` は `.env` のモデル(`GEMINI_MODEL`・`REVIEW_MODEL`・`JUDGE_MODEL`)を既定値の行として登録する(値を seed に書かない)。キー自体は既定値として環境変数に残し、DB には入れない。
  * **Phase 67 で確定**: 用途ごとに1行のテーブル(`user_model_settings`)と provider ごとのキーのテーブル(`user_api_keys`)(3.2節 ⑫⑬)。seed は実行のたびに `.env` の値で既定値の行を上書きする(`.env` が正)。**superuser でないユーザーが既定のキーで選べるのは、既定値と同じ provider だけ**(チャット・生成は Gemini、レビュー・判定は Claude。ただしレビューは決定5のとおり superuser だけ)。それ以外の provider は、今の鍵で復号できる自分のキーがあるときだけ保存できる。superuser は既定のキーで何でも選べる。キーを消しても選択の行は消さず、読み出しで`key_missing`を返す(Phase 68 の解決で既定値に読み替える)。キーの確かめは`httpx`で直接モデルの一覧を1件だけ取り(Gemini は`x-goog-api-key`、Anthropic は`x-api-key`と`anthropic-version`。キーを URL に載せない)、400・401・403 は無効、タイムアウト・429・5xx・接続の失敗は確かめられない(どちらも保存しない)。`E2E_FAKE_LLM`のときは確かめを飛ばす。暗号の鍵は`ENCRYPTION_KEY`にカンマ区切りで複数持て、`MultiFernet`が先頭で暗号化して全部で復号する(鍵を回すときは新しい鍵を先頭に足し、古い鍵を後ろに残す)。どの鍵でも復号できないキーは`needs_reregister`とし、選べる provider の根拠にしない。
* **LLM の解決**: 今の取得関数(`get_gemini_llm()`・`get_review_llm()`・`get_judge_llm()`。`lru_cache`でプロセスに1つ)を「ユーザーと用途 → LLM」の解決に替える。キャッシュの鍵は (provider, モデル, キー)。用途ごとに provider を入れ替えられるので、provider に固有の処理(本文の取り出し・構造化出力の方式・出力の上限・再試行の 429 の判定)を両方の provider で通す。PDF の取り込みは用途にせず、Gemini の解決(自分の Gemini キー、無ければ既定)で読む。レビューの実効値は`is_superuser and 設定`から「(superuser、またはレビューの用途の provider の自分のキーがある)かつ設定」に改める。モデルごとのタイムアウトと、混雑(503・504)を待つ再試行は Phase 68 の着手時に決める(Phase 60 の申し送り「生成のモデルと Gemini の無料枠」)。

## 3.4 例外処理・エラーハンドリング・ログ設計

### 1. 共通エラーレスポンス形式

API全体で一貫したエラーハンドリングを行うため、エラー発生時は以下のJSONフォーマットでレスポンスを返却する。

```json
{
  "detail": "ユーザー向けの詳細なエラーメッセージ",
  "code": "ERROR_CODE_STRING"
}
```

**(Phase 2-5で確定)** 当初案の`{"error": {"code","message","details"}}`という入れ子形式は採用していない。`devex-api`のスターターテンプレートが既に`{"detail": "..."}`という形(FastAPI/Pydanticの標準的なエラー形にも合わせた形)でエラーレスポンスを返す設計になっており(`app/core/errors.py`の`AppError`・`app/api/error_handlers.py`)、`devex-ui`側の`client.ts`もこの形を前提に実装済みだったため、既存の動いている契約を壊さずに済むよう`code`フィールドを追加する形にした。`code`は該当する場合のみ含まれ(下記コード一覧に対応する例外にのみ設定)、未設定のエラーは`{"detail": "..."}`のみを返す。

主なエラーコード例：
* `RESOURCE_NOT_FOUND`: 指定されたプロジェクトやドキュメントが存在しない(`ProjectNotFoundError`/`DocumentNotFoundError`)
* `LLM_API_ERROR`: 外部LLMプロバイダー（Gemini等）との通信エラーが規定回数のリトライ後も解消しない場合(`GenerationFailedError`)
* `LLM_QUOTA_EXCEEDED`: Gemini Flash-Lite無料枠のトークン上限超過。ユーザーには「本日の利用上限に達しました」等の分かりやすいメッセージを表示する（`LLMQuotaExceededError`。[実装計画書](implementation_plan.md) 4.4リスク3参照）
* `TOO_MANY_FILES`: 初期ヒアリングの添付ファイルが上限(3件)を超えている(`TooManyFilesError`)
* `UNSUPPORTED_FILE_TYPE`: 添付ファイルがtxt/Markdown/PDF以外の形式である(`UnsupportedFileTypeError`)
* `INVALID_PROJECT_NAME`: プロジェクト名が空白だけ、または40文字を超えている(`InvalidProjectNameError`。ゴール3後の調整)
* `FILE_TOO_LARGE`: 添付ファイルが1ファイルあたりの上限(5MB)を超えている(`FileTooLargeError`)
* `UML_SOURCE_DOCUMENT_MISSING` / `UML_GENERATION_IN_PROGRESS`(409)、`UML_SUBJECT_NOT_FOUND` / `ER_SCOPE_REQUIRED` / `TOO_MANY_SUBJECTS`(400): UML図のAI生成の受け付け時の検証(ステージ3、Phase 10)
* `LLM_TOKEN_LIMIT` / `LLM_INVALID_OUTPUT`: UML図のAI生成で、トークン上限超過/構造化出力の解釈失敗(バックグラウンド実行中に発生するため、HTTPレスポンスではなく生成履歴`uml_generation_runs`の`reason_code`として記録する。Phase 10)
* `DOC_GENERATION_IN_PROGRESS`(409): 設計書の生成中に、生成を再度要求した(Phase 15)
* `DESIGN_STAGES_NOT_AVAILABLE` / `DESIGN_STAGE_LOCKED` / `DESIGN_STAGE_NOT_APPROVABLE`(409): 詳細設計モードの段階(Phase 15)。段階の版の不一致は`VERSION_CONFLICT`(409、UML図と共通)
* `DESIGN_STAGE_INVALID` / `DESIGN_STAGE_GENERATION_NOT_SUPPORTED` / `DESIGN_STAGE_GENERATION_IN_PROGRESS`(409): 段階ごとの検証のエラーがある段階の承認 / 生成に対応していない段階の生成 / 生成中の段階の生成・保存・承認(Phase 16)
* `DESIGN_STAGE_UNREVIEWED_IMPACT`(409): 他の段階・文書の変更から届いた見直しの印が未確認のまま、段階を承認しようとした(ステージ7、Phase 43)
* `CURRENT_PASSWORD_MISMATCH`(400): メール・パスワードの変更で今のパスワードが合わない(ステージ9、Phase 66。メールの重複は既存の409)
* `MODEL_NOT_IN_CATALOG` / `MODEL_PROVIDER_KEY_REQUIRED` / `API_KEY_INVALID`(422)、`API_KEY_CHECK_FAILED`(502)、`ENCRYPTION_UNAVAILABLE`(503): 用途ごとのモデルと API キーの登録(ステージ9、Phase 67。3.3節 9項)プロジェクトの削除(Phase 64)は新しいコードを足さない(他人・無いものは`RESOURCE_NOT_FOUND`)
* `INTERNAL_SERVER_ERROR`: `AppError`以外の予期せぬ例外をキャッチする最終防衛ラインのハンドラが返す(スタックトレース等の詳細はレスポンスに含めずサーバーログにのみ記録)

**`UNAUTHORIZED`について**: 認証境界(`app/api/deps.py`の`get_current_user`)は意図的に`AppError`ではなく生の`HTTPException`を使っており(認証失敗の理由を外部に細かく漏らさないため)、`code`フィールドは付与されない。レスポンス形自体は`{"detail": "..."}`のまま変わらない。

**`FILE_EXTRACTION_FAILED`について**: このエラーはHTTPレスポンスの例外としては送出されない。添付ファイルのテキスト化失敗はヒアリング自体をブロックしない設計のため(2.3節・2.5節5項参照)、`intake_files.status='failed'`・`error_message`として記録され、プロジェクト作成自体は`201 Created`で成功する。

### 2. 例外検知・ログ出力方針

* **ログライブラリ**: `structlog`を使用し、JSON形式でログを出力する(ステージ2診断で`structlog`を採用確定。理由は3参照)。
* **ログレベルの定義**:
  * `DEBUG`: 開発環境での詳細なデバッグ情報（SQLクエリ、LLM呼び出しのレイテンシ・プロンプト文字数など。**プロンプト本文・レスポンス本文は含めない**、下記「プライバシー上の注意」参照）
  * `INFO`: APIリクエストの受付、プロジェクト作成、ドキュメント生成完了などの主要なライフサイクルイベント
  * `WARNING`: 外部APIの応答遅延、バリデーションエラー等の軽微な問題
  * `ERROR`: データベース接続エラー、外部LLMの呼び出し失敗、予期せぬ例外（スタックトレースを必ず記録）
* **例外キャッチとハンドリング**:
  * FastAPIの `exception_handler` を用いて、カスタム例外（例: `AppException`）および未処理の `Exception` をグローバルにキャッチし、適切なHTTPステータスコードと共通エラーレスポンスに変換して返却する。
* **プライバシー上の注意(ステージ2診断で確定)**: 当初案では`DEBUG`ログにプロンプトの内容を含める想定だったが、[要件定義書](requirements.md) 1.5節「入出力データ（機密性の高い要件定義データ）の適切な保護」と矛盾するため撤回した。ログにはプロンプト・レスポンスの**本文は一切出力せず**、project_id・doc_type・文字数・レイテンシ・モデル名等のメタデータのみを記録する。プロンプト本文のデバッグが必要な場合も、常時有効なDEBUGログの一部にはしない(将来必要になった場合は`E2E_FAKE_LLM`と同様、本番環境で誤って有効化されないようガードされた専用フラグとして別途検討する)。

### 3. 監視方針(ステージ2、個人開発規模を前提とする)

* **エラー追跡**: `sentry-sdk`(既に間接依存として`uv.lock`に存在)を使い、環境変数`SENTRY_DSN`が設定されている場合のみ初期化する(未設定時は完全にno-op)。本番のConoHa VPS上でのみ設定し、無料枠で例外の集約・通知を受け取る。
* **死活監視**: 新規のアプリケーションコードは不要。既存の`/health`エンドポイント([外部設計書](external_design.md)、`app/main.py`)を外部の無料アップタイム監視サービス(例: UptimeRobot)から定期的に叩く運用とする(`devex-api/OPERATIONS.md`に手順を記載)。
* **意図的に採用しないもの**: Prometheus/Grafana等の自前メトリクス基盤、OpenTelemetryによる分散トレーシングは、個人開発・単一VPS構成の規模に見合わないため採用しない。
