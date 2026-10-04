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
* **DesignStage（詳細設計の段階、ステージ4）**: 詳細設計モードの段階1〜7ごとの成果物(意味モデル)と承認状態を管理(⑩、Phase 15で新設)。

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
| status | VARCHAR(50) | NOT NULL, DEFAULT 'interviewing' | 状態 (interviewing: ヒアリング中, generating: 生成中, completed: 完了, revising: 修正中。completed後に新規チャットメッセージを送るとrevisingへ遷移する) |
| mode | VARCHAR(20) | NOT NULL, DEFAULT 'simple'（※ステージ4、Phase 15）  | 作成時に選んだモード。`simple`(簡易ドキュメントモード: 4文書の一括生成)/`detailed`(詳細設計モード: 要件定義・外部設計の後に段階1〜7)。作成後は変えない。既存の行は`simple`にする([外部設計書](external_design.md) 2.7節) |
| template_id | UUID | FK (`prompt_templates.id`), NULL可（※ステージ2対応） | SCR-003で選択したテンプレート。クライアント側のプリフィルのみで終わらせず、プロジェクトのライフサイクル全体(ヒアリング再開・再生成時)を通じて選択したテンプレートを保持するためサーバー側に永続化する(⑤`prompt_templates`テーブル参照) |
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
| stage | SMALLINT | NOT NULL, CHECK 1〜7 | 段階番号(1〜7。段階7 実装計画も同じ承認の流れに乗せる) |
| status | VARCHAR(20) | NOT NULL | `draft`(AIの下書き)/`regenerated`(内容のある段階をAIが作り直した・未承認。画面は「再生成済(未承認)」。Phase 16)/`reviewing`(人が保存した)/`approved`。画面の「未着手」(行が無い)と「古い」(入力が承認時から変わった)は保存せず、`app/detailed_design/stages.py`の`derive_states`が導く |
| model | JSONB | NULL可 | 段階の意味モデル(機能一覧・処理概要表・CRUD図・モジュール一覧・手順・処理ロジック等の表)。図(DFD・ER・構成図)は既存の`uml_diagrams`・`data_items`を使う |
| version | INT | NOT NULL | 楽観ロック用バージョン。保存で+1、承認では増やさない(承認済みを保存すると`reviewing`に戻る) |
| approved_version | INT | NULL可 | 最後に承認したときの`version` |
| generation_status | VARCHAR(20) | NULL可 | AIの下書きの生成の状態(`generating`/`completed`/`failed`。NULLはまだ生成していない)。レビューの状態`status`とは別の軸(UML図と同じ)。生成中は、その段階の生成・保存・承認を409(`DESIGN_STAGE_GENERATION_IN_PROGRESS`)にする(Phase 16) |
| generation_error | TEXT | NULL可 | 直近の生成が失敗した理由(ユーザー向けの文言。Phase 16) |
| generation_started_at | TIMESTAMP | NULL可 | 生成を始めた時刻。15分を超えて生成中のままなら、生成の受け付け時と一覧の取得時に`failed`へ戻す(Phase 16) |
| input_fingerprint | JSONB | NULL可 | 承認したとき・AIの下書きを生成したとき(Phase 16)に入力にした前段の版(`{"stage:<n>": 承認済みの版, "doc:<doc_type>": 表示中の版}`)。今の値と「等しくない」ものがあれば「古い」と判定する(Phase 13の`source_doc_versions`と同じ考え方)。承認済みでない段階の今の値は`null`なので、前の段階を編集した時点で後ろの段階が古くなり、古さは後ろへ順に伝わる |
| created_at / updated_at | TIMESTAMP | NOT NULL | 作成・更新日時 |

`UNIQUE(project_id, stage)`。段階ごとの入力は`STAGE_INPUTS`(1: 外部設計 / 2: 段階1+要件定義 / 3: 段階2 / 4: 段階1〜3+要件定義 / 5: 段階2・4 / 6: 段階5 / 7: 段階1〜6+要件定義・外部設計)。入力がそろっていない段階は保存も承認もできない(409 `DESIGN_STAGE_LOCKED`)。前の段階を承認し直しても後ろの段階は自動で作り直さず、陳腐化の表示にとどめる(再生成は人が指示する。古い段階は内容を変えずに「承認し直す」こともできる)。プロジェクトのモードは`projects.mode`(②`projects`テーブル)で持つ。`design_stages`の行を持つのは`mode='detailed'`のプロジェクトだけ。

**段階1の`model`の形(Phase 16で確定)**: `{groups: [機能グループ名], functions: [{id: "F-01", name, kind: "API"|"API+バッチ"|"バッチ"|"画面"|"その他", trigger, screens: [画面ID], group_initial, group, summary}], next_number}`(`app/detailed_design/function_list.py`の`FunctionListModel`)。`kind`の「画面」は、サーバーを呼ばずに画面の中で完結する非自明な演算・描画で、`trigger`は`SCR-005: <操作>`の形。`group_initial`はAPIのパスから決定的に作った初期値(APIでない処理はAIの提案)、`group`は人の確定値。`next_number`は次に振る処理IDの番号で、消えた番号は再利用しない。段階ごとの検証(`app/detailed_design/validation.py`の`STAGE_VALIDATORS`)にエラーがあると承認できない(409 `DESIGN_STAGE_INVALID`)。警告は承認を止めない。検証の結果は保存せず、取得のたびに計算して`issues`で返す([`textbook/Phase-16/Phase-16-2.md`](../textbook/Phase-16/Phase-16-2.md))。

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
  * **`completed → revising`遷移**: `project.status == "completed"`の状態でユーザーが新規チャットメッセージを送信すると、そのメッセージを永続化する前に`project.status`を`revising`(修正中)へ変更する。「チャットに戻る」操作は必ずしも修正指示を意味しないため、この遷移は実際にメッセージを送信した時点で初めて発生させ、チャット画面を開いただけでは発生させない。
* **`doc_generator_service.py`**:
  * ヒアリング完了時、「要件定義」「外部設計」「内部設計」「実装計画」のそれぞれに特化したプロンプトを、この順に**連鎖的に**実行する。要件定義のみチャット全履歴をコンテキストとしてインプットし、以降の3文書は生の対話履歴を再解釈せず、前段で確定した文書だけを入力にする(外部設計は要件定義を、内部設計は要件定義+外部設計を、実装計画は要件定義+内部設計を入力にする)。こうすることで4文書間の記述の一貫性を確保する。
  * バックグラウンドタスクとして非同期実行され、進捗や結果をデータベース (`generated_documents`) に保存。`generate()`開始時点の`project.status`(`interviewing`または`revising`)を保持しておき、`generating`への変更を経て、成功時は`completed`へ、失敗時は保持していた開始時点のステータスへ差し戻す(`revising`からの再生成に失敗した場合に`interviewing`へ戻ってしまい「生成済みだった」という文脈を失うことを防ぐ)。
  * **内部設計書の固定形式の見出し(Phase 10)**: UML図の生成対象を決定的に列挙できるよう、内部設計書プロンプトで3.2節のテーブル見出しを`### テーブル: <テーブル名>`、3.3節の「処理別データフロー」小節の処理見出しを`#### DF-<連番>: <HTTPメソッド> <パス>`(バッチは`<バッチ名>`)に固定する。各処理の下には「元/データ/変換/先」の表と`- データ項目: <名前>(<フィールド…>)`を書かせる。
  * **生成の受け付け・失敗・固着(Phase 15)**: 生成の要求(`POST /generate`)の時点で`generating`にし、生成中なら409(`DOC_GENERATION_IN_PROGRESS`)にする。失敗したときは rollback で途中の版と古い版の削除を取り消してから、状態を戻し、失敗の通知(生の例外の文字列は含めない)だけを commit する。15分を超えて`generating`のままのプロジェクトは、プロジェクトの取得時と生成の要求時に、文書があれば`revising`、無ければ`interviewing`へ戻す(中断の通知をチャットに残す)。
  * **モードごとの生成(ステージ4、Phase 15)**: `projects.mode='simple'`は今と同じく4文書を連鎖生成する。`'detailed'`は要件定義・外部設計の2文書だけを生成し(自己診断つき)、内部設計・実装計画は詳細設計モードの段階(3.3節「4.」)へ引き継ぐ。
  * **外部設計書のAPI一覧(Phase 16)**: 外部設計書プロンプトに「2.6 API一覧」(メソッド/パス/概要/関連画面の表)を求める指示を足す。両方のモードで同じ。詳細設計モードの段階1が、機能グループの初期値をAPIのパスから決め、下書きに漏れたAPIを照合する材料にする。内部設計書プロンプトの3.3節のAPI表は、2.6と同じメソッド・パスを使い、内部の担当の観点で概要を書かせる([`textbook/Phase-16/Phase-16-1.md`](../textbook/Phase-16/Phase-16-1.md))。
  * **モジュール一覧の表(ステージ4、Phase 15)**: 簡易ドキュメントモードの内部設計書プロンプトの3.3節に、ファイル単位の「モジュール一覧」(パス/層/責務/主な依存先)の表を求める指示を足す。詳細設計モードの段階4と同じ列で、簡易ドキュメントモードでもファイル単位の責務が分かるようにする(Phase 14の決定#6)。
  * **自己診断ステップ**: 4文書の生成完了後、生成した文書自体を入力として追加のLLM呼び出しを行い、不足・不明瞭な点を「最重要/中程度/軽微」の3段階に分類して抽出する([要件定義書](requirements.md) 1.4節「ドキュメント自己診断機能」)。抽出結果は`sender='others'`の`chat_histories`行として保存し、ユーザーへの提示は`chat_service.py`側のチャット表示ロジックが担う。

### 2. APIエンドポイント一覧

| メソッド | パス | 概要 | 認証要否 |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/auth/register` | 新規ユーザー登録 | 不要 |
| **POST** | `/api/v1/auth/login` | ログイン（JWT発行） | 不要 |
| **POST** | `/api/v1/projects` | 新規プロジェクト作成(初期ヒアリング入力を`intake`として受け取る。ステージ4では`mode`(`simple`/`detailed`、省略時`simple`)も受け取る。添付ファイル最大3件・txt/md/pdfのみを伴う場合は`multipart/form-data`になる。[外部設計書](external_design.md) 2.5節3項・5項参照) | 必要 |
| **GET** | `/api/v1/projects` | ユーザーのプロジェクト一覧取得 | 必要 |
| **GET** | `/api/v1/projects/{id}` | 特定プロジェクトの詳細・状態取得(添付ファイルのサマリ ── ファイル名・形式・`status` ── を含む。`extracted_text`本文は含めない) | 必要 |
| **POST** | `/api/v1/projects/{id}/chat` | チャットメッセージ送信・AI応答取得（ストリーミング対応）。途中で失敗したときは`event: error`(`data: {code, detail}`)を送って終える(200を返した後のため。発話は保存しない。Phase 15) | 必要 |
| **GET** | `/api/v1/projects/{id}/chat` | 特定プロジェクトのチャット履歴取得 | 必要 |
| **POST** | `/api/v1/projects/{id}/generate` | 設計書の自動生成トリガー（非同期。簡易ドキュメントモードは4種、詳細設計モードは要件定義・外部設計の2種。生成中は409 `DOC_GENERATION_IN_PROGRESS`。Phase 15） | 必要 |
| **GET** | `/api/v1/projects/{id}/documents` | 生成された設計書一覧(doc_typeごとの現在表示中(`is_current`)の版のみ)・内容の取得 | 必要 |
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
| **GET** | `/api/v1/projects/{id}/design-stages` | （※ステージ4、Phase 15）段階1〜7の状態(`state`・`is_open`・`missing_inputs`・`version`・`approved_version`・`model`。Phase 16で`generation_status`・`generation_error`・`issues`を追加)。未着手の段階も含む。止まった生成(15分超)はここで回収する。詳細設計モードでなければ409 `DESIGN_STAGES_NOT_AVAILABLE` | 必要 |
| **PUT** | `/api/v1/projects/{id}/design-stages/{stage}` | （※ステージ4、Phase 15）段階の内容の保存(`{version, model}`。未着手は`version: null`で作る。楽観ロック。承認済みは`reviewing`に戻る。開いていない段階は409 `DESIGN_STAGE_LOCKED`) | 必要 |
| **POST** | `/api/v1/projects/{id}/design-stages/{stage}/approve` | （※ステージ4、Phase 15）段階の承認(`{version}`。下書き・レビュー中・古いが対象。承認時に`input_fingerprint`を記録する。versionは増やさない。承認済みで古くない・内容が空は409 `DESIGN_STAGE_NOT_APPROVABLE`。段階ごとの検証にエラーがあれば409 `DESIGN_STAGE_INVALID`(Phase 16)) | 必要 |
| **POST** | `/api/v1/projects/{id}/design-stages/{stage}/generate` | （※ステージ4、Phase 16）段階のAIの下書きの生成を受け付ける(202。段階は`generating`になり、裏で生成して`draft`・version+1で保存する。画面は一覧をポーリングする)。生成に対応していない段階は409 `DESIGN_STAGE_GENERATION_NOT_SUPPORTED`(Phase 16は段階1だけ)、生成中は409 `DESIGN_STAGE_GENERATION_IN_PROGRESS`、開いていない段階は409 `DESIGN_STAGE_LOCKED` | 必要 |

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
* **ID体系**:
  * 処理ID: `F-01`… 段階1で振り、再生成しても変えない(今の`DF-<n>`が再生成で振り直される問題を避ける)。以降の章はこのIDで互いを参照する。
  * 手順ID: `<処理ID>#<手順番号>`(`F-01#4`、分岐は`F-01#4a`)。文書全体で一意。
  * 処理ロジックID: `L-01`…
* **05と06の紐づけの正本**: 手順の行が持つ`logic`(L-ID)の1か所だけに持つ。06の「呼ばれる手順」、05の索引の「詳細(06)」、06の逆引き表、処理 × モジュールの関与表は、すべてそこから導く。組み立ての前に、手順が参照するL-IDが06に存在することを検証する(参照切れの検出)。
* **関与表の列**: 呼び出し先のうち、段階4のモジュール一覧のパスだけ(利用者・スケジューラ等の外部の役者は含めない)。
* **出力の組み立て**: HTML・Markdownとも、ステージ3のzip出力と同じ層(バックエンドの`app/uml/export`・`uml_sync_service`の並び)で組み立てる。HTMLは全文字をエスケープし、外部を読み込まない。Markdownはリンクを持たない。devex-uiのデモ(`src/features/detailed-design/demo/procedureModel.ts`の`toHtml`・`toMarkdown`)は形式の見本で、本実装はバックエンドへ移す。
* **機能グループ**: 段階1の下書きで、APIのリソース名(`/api/v1/<リソース>`、親の個別の対象に属するものは`/api/v1/<親>/{id}/<リソース>`の子のリソース名)から決定的に初期値を作り、人が確定する。APIのパスは外部設計書の「2.6 API一覧」から取る(Phase 16)。
* **段階1の下書き(Phase 16)**: AIには外部設計書から処理を列挙させるだけにし、処理IDと機能グループの初期値はコードで決める。再生成では、前の版の行とトリガー(メソッド+正規化したパス。APIでなければ名称)で突き合わせ、一致した行は処理IDと人が確定した機能グループを引き継ぐ。生成は受け付けとバックグラウンドの実行に分ける(`app/services/design_stage_generation_service.py`。UML図の生成と同じ形)。
* **段階2 データフロー(Phase 17)**:
  * `design_stages.model`(段階2)は`{dfd_groups, summaries}`(DFD を描く機能グループ・全処理の処理概要表`{function_id, input, process, output}`)だけ。DFD は`uml_diagrams`(notation=dfd、subject=機能グループ名)、データ辞書は`data_items`が正本で、model に複製しない(`app/detailed_design/data_flow.py`)。
  * 下書きは、処理概要表(LLM 1回)→ 選んだグループごとの DFD(1グループ LLM 1回、5グループまで)を順に呼び、段階・DFD・データ項目を1トランザクションで書く(失敗したらまとめて取り消す)。DFD の処理の箱は処理IDで、AIには`function_id`だけを書かせ、ステージ3の出力スキーマ`DfdGenerationOutput`に組み替えて写像(`app/uml/generation/mapper.py`)を再利用する(`app/detailed_design/data_flow_drafting.py`)。再生成では`dfd_groups`を引き継ぎ、選んだグループの DFD は同じ行を上書きする(承認はやり直し)。
  * 検証(`STAGE_VALIDATORS[2]`)は、承認済みの段階1の内容と DFD の要約を`StageSources`で受け取る。エラー: 処理概要表の過不足・重複、グループの上限・重複・不明、選んだグループの DFD が無い・生成中・未承認。警告: 処理概要表の空欄、DFD の処理とグループの過不足。
  * 段階の外の正本の編集: 詳細設計モードで DFD を保存・自動レイアウトする、またはデータ項目を作成・更新・削除すると、承認済みの段階2を`reviewing`・version+1 に戻す(`DesignStageService.mark_edited`)。段階3が段階2の承認した版で陳腐化を判定するため。
* **CRUD図**: 段階2のDFDの線の向きから、R(ストア → 処理)とW(処理 → ストア)を決定的に作る。Wの C/U/D の区別と、DFDに描いていない処理の分は、AIが処理概要表から下書きし、人が確定する。
* **段階3 データモデル(Phase 18)**:
  * `design_stages.model`(段階3)は`{cells: [{function_id, table, ops, draft}]}`(CRUD 図のセル)だけ。`ops`は C・R・U・D をこの順に並べた文字列、`draft`は AI の下書きのまま人が確定していない印。ER は`uml_diagrams`(notation=er、subject=`''`の1枚)、テーブル定義は ER の列の`constraints`・`description`とテーブルの`description`が正本で、model に複製しない(`app/detailed_design/data_model.py`)。
  * R/W の導出: 段階2で DFD を描くと選んだグループの DFD について、データストア → 処理 を R、処理 → データストア を W とする。データストアと ER のテーブルは名前で突き合わせる(前後の空白を除いて小文字)。`merge_crud`は、読みの線のセルに R を足し、書き込みの線のセルは C/U/D が無くても空で残す(検証のエラーで人に決めさせる)。
  * 下書き: ER(LLM 1回。入力は DFD のデータストア名・データ辞書・処理概要表。出力スキーマは段階3専用で制約・説明つき)→ CRUD 図(LLM 1回。DFD の R/W を「決まったもの」として渡す)を順に呼び、ER と段階を1トランザクションで書く。再生成は置き換え(前の版の人の確定は引き継がない)。ER は同じ行を上書きし承認はやり直し(`app/detailed_design/data_model_drafting.py`、`_save_diagram`)。
  * 検証(`STAGE_VALIDATORS[3]`)は、ER の要約(`ErDiagramSummary`)と DFD の R/W(`DfdDiagramSummary.accesses`)を`StageSources`で受け取る。エラー: ER が無い・生成中・未承認、ER のテーブル名の重複(CRUD 図のセルを引く鍵のため)、セルの処理ID・テーブルが不明・重複、操作の形が不正、DFD の読みに R が無い・書き込みに C/U/D が無い。警告: 下書きのセルが残っている、DFD のデータストアが ER に無い、どの処理も触れないテーブル、主キーの無いテーブル。
  * 承認で`draft`をすべて外す(承認 = 人の一括確定。version は増やさない)。段階の一覧(`DesignStageRead`)の段階3は、DFD から決まる R/W を`dfd_accesses`で返す(画面で導き直さないため)。
  * 段階の外の正本の編集: 詳細設計モードで ER を保存・自動レイアウトすると、承認済みの段階3を`reviewing`・version+1 に戻す(`UmlDiagramService._reopen_stage`。記法 → 段階の対応表で DFD と共通)。
* **段階4 ソフトウェア構造(Phase 19)**:
  * `design_stages.model`(段階4)は`{modules: [{path, layer, responsibility, depends_on, functions, all_functions}]}`(ファイル単位のモジュール一覧)だけ。`functions`は関わる処理の処理ID(機能一覧の順)、`all_functions`は全処理が通る横断のモジュールの印(文書では「全処理」)。構成図は`uml_diagrams`(notation=component、subject=`''`の1枚。箱はパッケージ単位、要素の`layer`が層のレーン)が正本で、model に複製しない。構成図とモジュール一覧は層の名前でつなぐ(`app/detailed_design/structure.py`)。
  * 下書き: 構成図(LLM 1回。入力は要件定義の全文(技術スタック)・機能一覧・処理概要表・ER のテーブル名。出力スキーマと写像はステージ3の`ComponentGenerationOutput`・`to_component`を再利用し、プロンプトだけ段階4専用)→ モジュール一覧(LLM 1回。構成図の要素と層・依存の向き、CRUD 図、ER のテーブル名を渡す。層は構成図の層から選ばせる)を順に呼び、構成図と段階を1トランザクションで書く。再生成は置き換え。構成図は同じ行を上書きし承認はやり直し(`app/detailed_design/structure_drafting.py`、`_save_diagram`)。「関わる処理」は CRUD 図から決定的には作らない(テーブルとモジュールの対応は名前の推測になるため)。
  * 検証(`STAGE_VALIDATORS[4]`)は、構成図の要約(`ComponentDiagramSummary`: 状態と層)を`StageSources`で受け取る。エラー: 形が不正、モジュールが0件、構成図が無い・生成中・未承認、パスが空・重複(段階5の手順の呼び出し先と関与表の列の鍵のため)、関わる処理の処理IDが機能一覧に無い。警告: 責務が空、層が構成図のレーンに無い、どのモジュールにも現れない処理(`all_functions`の行は数えない)、依存先がパスの形(`/`を含む)なのに当たるモジュールが一覧に無い。依存先の照合は区切り単位の部分一致(`module_ref_matches`。「/」で区切った単位の列が、パスの単位の列のどこかに連続して現れれば一致。末尾の拡張子は除き、パスの`{a,b}`は展開、`*`はどの単位とも一致。ディレクトリ`app/services`や短い書き方`services/auth`は一致し、`app/ser`や`app/models`→`app/models_old.py`は一致しない。Phase 19 の画面確認後に変更)。
  * 段階の外の正本の編集: 詳細設計モードで構成図を保存・自動レイアウトすると、承認済みの段階4を`reviewing`・version+1 に戻す(`_STAGE_OF_NOTATION`に component を足した)。
* **下書きの表記の規則(Phase 19 の画面確認後)**: 詳細設計モードの全段階の下書きの system プロンプトの末尾に、共通の規則`NAMING_RULES`(`app/detailed_design/prompt_rules.py`)を足す。簡易ドキュメントモードのプロンプトには入れない。
  * 名称・説明・責務・層の名前・注釈は日本語で書く。英語の識別子を説明の代わりに使わない(必要なら「日本語の名称(識別子)」と併記。構成図の箱は「サービス(services)」の形)。
  * ファイル・ディレクトリのパス、テーブル名・列名、クラス名・関数名・変数名などの識別子は、技術スタックの命名規則に従って英語で書く(ユーザーの規則「新規のディレクトリ名・ファイル名は日本語を基本とし、互換性に問題がある場合は英語」の互換性の条件が、Python・TypeScript などのパスでは常に当てはまるとみなした)。
  * フレームワーク・ライブラリ・外部サービス・プロトコルの正式名称と、環境変数・設定キー・コマンド・パッケージ名は原文のまま。
  * 入力にある名前(処理ID・テーブル名・パス・層の名前・データ項目の名前)は変えない(後の段階が名前で突き合わせるため)。
* **簡易ドキュメントモードとの関係**: 簡易ドキュメントモードの内部設計書にも、段階4と同じ列のモジュール一覧の表を足す(3.3節1.の`doc_generator_service.py`参照)。それ以外の簡易ドキュメントモードの挙動は変えない。
  > **[Phase 16 で確定 ── 〈外部設計書の構成は簡易ドキュメントモードでも変える〉]** 当初〈モジュール一覧の表のほかは、簡易ドキュメントモードの挙動を変えない〉→ 外部設計書の「2.6 API一覧」は両方のモードで出す。理由〈ユーザーの選択。API仕様は実務でも外部設計(基本設計)に置くことが多く、プロンプトをモードで分けずに済む。重なる内部設計書3.3節のAPI表は、2.6と同じメソッド・パスを使わせてそろえる〉。

---

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
* `FILE_TOO_LARGE`: 添付ファイルが1ファイルあたりの上限(5MB)を超えている(`FileTooLargeError`)
* `UML_SOURCE_DOCUMENT_MISSING` / `UML_GENERATION_IN_PROGRESS`(409)、`UML_SUBJECT_NOT_FOUND` / `ER_SCOPE_REQUIRED` / `TOO_MANY_SUBJECTS`(400): UML図のAI生成の受け付け時の検証(ステージ3、Phase 10)
* `LLM_TOKEN_LIMIT` / `LLM_INVALID_OUTPUT`: UML図のAI生成で、トークン上限超過/構造化出力の解釈失敗(バックグラウンド実行中に発生するため、HTTPレスポンスではなく生成履歴`uml_generation_runs`の`reason_code`として記録する。Phase 10)
* `DOC_GENERATION_IN_PROGRESS`(409): 設計書の生成中に、生成を再度要求した(Phase 15)
* `DESIGN_STAGES_NOT_AVAILABLE` / `DESIGN_STAGE_LOCKED` / `DESIGN_STAGE_NOT_APPROVABLE`(409): 詳細設計モードの段階(Phase 15)。段階の版の不一致は`VERSION_CONFLICT`(409、UML図と共通)
* `DESIGN_STAGE_INVALID` / `DESIGN_STAGE_GENERATION_NOT_SUPPORTED` / `DESIGN_STAGE_GENERATION_IN_PROGRESS`(409): 段階ごとの検証のエラーがある段階の承認 / 生成に対応していない段階の生成 / 生成中の段階の生成・保存・承認(Phase 16)
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
