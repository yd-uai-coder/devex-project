1. 要件定義書：Devex
1.1 プロジェクトの目的・背景
解決したい課題:
システム開発の初期フェーズ（要件定義〜実装計画）において、ドキュメント作成の工数やスキル不足に悩む開発者やプロジェクトマネージャーが多い。
要件のヒアリングからドキュメント化までのプロセスが属人化しやすく、時間がかかる。
目指すゴール:
AI（LangChain等）を活用した対話型インターフェースを通じて、ユーザーのアイデアや要望を引き出し、高品質な「要件定義」「外部設計」「内部設計」「実装計画」のMarkdownテキストを自動生成・出力するシステム（Devex）を構築する。
1.2 ターゲットユーザー・利用シーン
主なユーザー層:
システムエンジニア、ITコンサルタント、プロジェクトマネージャー
個人開発者、スタートアップ企業の創業者
想定される使用シチュエーション:
新規プロジェクトの立ち上げ時、頭の中にあるアイデアを構造化された設計書に落とし込みたい時。
クライアントからのヒアリング内容をベースに、素早く初期ドキュメントのドラフトを作成したい時。
1.3 システム化の範囲（In Scope / Out of Scope）
今回開発する範囲（In Scope）:
ユーザーとAIによるチャット形式のヒアリング機能
ヒアリング内容に基づく「要件定義」「外部設計」「内部設計」「実装計画」のMarkdownテキスト自動生成機能
生成されたMarkdownテキストの閲覧・コピー・ダウンロード機能
ユーザーセッション管理およびチャット履歴・生成ドキュメントのデータベース保存
今回は開発しない範囲（Out of Scope）:
生成された設計書から自動でコード（Gitリポジトリ等）を生成する機能
外部プロジェクト管理ツール（Jira, Redmine, Notion等）への直接連携機能
マルチテナントによる複雑な企業間権限管理機能
1.4 機能要件（MoSCoW優先度）
Must have（必須機能）:
チャットUI（Next.js）：ユーザーとAIが対話するための画面
LLM連携・プロンプト管理（FastAPI + LangChain）：ヒアリング内容を解析し、各設計ドキュメントをMarkdown形式で生成するロジック
ドキュメント出力・プレビュー機能：生成されたMarkdownを確認・エクスポートできる機能
データ永続化（PostgreSQL）：ユーザー情報、チャット履歴、生成された設計書データの保存
Should have（推奨機能）:
生成されたドキュメントのバージョン管理・履歴保持機能
プロンプトテンプレートの選択機能（Webアプリ向け、API向けなど）
Could have（あると良い機能）:
生成されたMarkdownのリアルタイムプレビュー機能（分割画面）
ユーザーの過去のプロジェクト傾向を学習したパーソナライズヒアリング
Won't have（見送り機能）:
音声入力によるヒアリング機能
リアルタイムでの複数人同時編集機能（ドキュメントの共同編集）
1.5 非機能要件
パフォーマンス・応答性:
チャットの応答速度：一般的なLLMのストリーミング応答に対応し、ユーザーがストレスなく対話できること。
ドキュメント生成処理：ヒアリング完了後の設計書一括生成処理において、タイムアウトを防ぐ非同期処理の導入。
セキュリティ・権限管理:
ユーザー認証・認可の実装（JWT等を用いたセキュアなセッション管理）。
入出力データ（機密性の高い要件定義データ）の適切な保護とプライバシー配慮。
運用・保守・拡張性:
LLMのモデル変更やプロンプトのチューニングがバックエンド（FastAPI + LangChain）で容易に行えるアーキテクチャ設計。
コンテナ化（Docker等）によるデプロイの容易性と拡張性の確保。
1.6 制約条件・前提条件
技術スタックの制約:
フロントエンド: Next.js
バックエンド: FastAPI + LangChain
データベース: PostgreSQL
外部APIの前提:
OpenAI APIなどの外部LLMプロバイダーのAPIキーおよび利用枠が確保されていること。
スケジュールの前提:
MVP（実用最小限の製品）としてのコア機能（チャット〜4種のmd生成）を優先して開発する。
2. 外部設計書
2.1 システム構成概要
Devexは、モダンなWeb技術スタックを用いて構築される対話型ドキュメント自動生成システムです。ユーザー（フロントエンド）からのリクエストを受け、AIによる高度な要件ヒアリングとドキュメント生成をセキュアに処理します。

[ ユーザー (ブラウザ) ]
       │
       ▼ HTTPS (JWT認証)
[ フロントエンド: Next.js (SSR / SPA) ]
       │
       ▼ REST API / WebSocket (ストリーミング)
[ バックエンド: FastAPI + LangChain ]
       ├── (プロンプト制御・非同期処理)
       ├── [ 外部LLM API (OpenAI等) ]
       │
       ▼ SQL (ORM)
[ データベース: PostgreSQL (セッション・履歴・ドキュメント永続化) ]
フロントエンド層 (Next.js): ユーザーインターフェースを提供。SSR（サーバーサイドレンダリング）による高速な初期表示と、チャット画面でのスムーズなクライアントサイド・インタラクションを実現。
バックエンド層 (FastAPI + LangChain): 業務ロジック、LLMとの連携、プロンプト管理を担う。LangChainを用いたエージェント制御により、ユーザーとの対話履歴を踏まえた適切なヒアリングと、構造化されたMarkdown生成を統御。非同期処理によりタイムアウトを防止。
データ層 (PostgreSQL): ユーザーアカウント情報、チャットセッション、対話履歴、生成された各設計書（要件定義、外部設計、内部設計、実装計画）を永続化。
2.2 画面一覧・画面遷移フロー（概要）
画面一覧



画面ID	画面名	主要な役割	優先度 (MoSCoW)
SCR-001	ログイン / ユーザー登録画面	JWTを用いた認証および新規アカウント登録を行う	Must
SCR-002	ダッシュボード画面	過去のプロジェクト一覧の閲覧、新規プロジェクト作成の開始	Must
SCR-003	プロンプト設定・テンプレート選択画面	新規プロジェクト立ち上げ時のテンプレート選択（Webアプリ向け等）	Should
SCR-004	チャットヒアリング画面	AIと対話しながらプロジェクトの要件を詰めていく画面	Must
SCR-005	ドキュメントプレビュー・編集画面	生成された4種のMarkdown（要件定義等）の閲覧、コピー、ダウンロード	Must
SCR-006	バージョン履歴管理画面	過去に生成・編集したドキュメントのバージョン比較・復元	Should
主要な画面遷移の流れ
[SCR-001 ログイン] 
      │ (認証成功)
      ▼
[SCR-002 ダッシュボード] ──(新規プロジェクト作成)──► [SCR-003 テンプレート選択] (※Should)
      │                                                      │
      │◄─────────────────────────────────────────────────────┘
      ▼
[SCR-004 チャットヒアリング] ──(ヒアリング完了 / 生成トリガー)
      │
      ▼ (非同期生成・完了)
[SCR-005 ドキュメントプレビュー] 
      ├── (バージョン履歴確認) ──► [SCR-006 バージョン履歴] (※Should)
      └── (エクスポート) ──► ローカルへDL / クリップボードへコピー
2.3 主要画面のUI/UX仕様
SCR-004: チャットヒアリング画面
画面構成:
ヘッダー: プロジェクト名、現在のフェーズ（ヒアリング中 / 生成中）、ダッシュボードへの戻るボタン、ドキュメント生成ボタン（手動トリガー）。
メインエリア（チャット履歴）: ユーザーのメッセージ（右側吹き出し）とAIからのメッセージ（左側吹き出し、Markdown対応、ストリーミング出力）。
フッター（入力エリア）: テキスト入力欄（複数行対応）、送信ボタン、ファイル添付（将来拡張用としてUIのみ、または無効化）。
主要なアクション:
ユーザーがテキストを入力し送信すると、LLMからのストリーミング応答がリアルタイムで描画される。
AIが「十分な要件が揃いました」と判断した際、またはユーザーが手動で「設計書を生成する」ボタンを押下した際、ローディングインジケーターを表示し、生成処理（SCR-005へ遷移）へ移行する。
SCR-005: ドキュメントプレビュー画面
画面構成:
サイドメニュー: ドキュメント種別の切り替えタブ
要件定義 (requirements.md)
外部設計 (external_design.md)
内部設計 (internal_design.md)
実装計画 (implementation_plan.md)
メインエリア: 選択されたドキュメントのMarkdownプレビュー（および分割画面によるリアルタイムプレビュー対応）。
アクションバー:
「クリップボードにコピー」ボタン
「Markdownファイル(.md)としてダウンロード」ボタン
「チャットに戻る」ボタン
「再生成する」ボタン
主要なアクション:
タブ切り替えによって瞬時に表示ドキュメントを切り替える。
コピーボタン押下時にトースト通知（「コピーしました」）を表示。
2.4 外部システム・API連携仕様
連携する外部サービス／API
LLMプロバイダーAPI (OpenAI API等)
用途: チャットの壁打ち（対話生成）、最終的なMarkdownドキュメント一括生成。
認証方式: Bearer Token (API Key) をFastAPIの環境変数として安全に管理。クライアント側からは直接露出させない。
データ連携タイミング:
ユーザーのチャット送信時（都度呼び出し・ストリーミング）
ヒアリング完了時のドキュメント一括生成時（非同期タスクによるバックグラウンド実行）
2.5 データ入出力仕様
1. ユーザー入力バリデーション (チャットメッセージ)
受付フォーマット: UTF-8 テキスト文字列
バリデーションルール:
必須入力（空文字不可）
最大文字数: 5,000文字 / 1メッセージ
不正なスクリプトタグやインジェクション文字列のサニタイジング（フロント・バックエンド双方で実施）
2. プロンプトテンプレート選択データ (JSON)
データ構造例:
JSON

{
  "template_id": "web_app_standard",
  "name": "Webアプリケーション標準",
  "target": "SaaS・BtoC/BtoB Webサービス",
  "system_prompt": "あなたは優秀なシステムアーキテクトです..."
}
3. ドキュメントエクスポート出力仕様
出力ファイル形式: Markdown (.md)
文字コード: UTF-8 (BOMなし)
ファイル命名規則: {project_name}_{document_type}_{YYYYMMDD}.md
例: devex_app_requirements_20231025.md
3. 内部設計書
3.1 技術スタック選定・アーキテクチャ方針
本システム（Devex）は、要件定義書に定められた制約に基づき、以下の技術スタックを採用する。

1. 技術スタック選定理由
フロントエンド（Next.js）:
SSR/SSGによる初期表示の高速化と、SEOフレンドリーな構成が可能。
App Routerを採用し、チャット画面やプレビュー画面の動的ルーティング、およびServer ActionsやAPI Routesを活用した効率的な状態管理を実現。
バックエンド（FastAPI + LangChain）:
FastAPI: 非同期処理（Async/Await）にネイティブ対応しており、LLMのストリーミング応答やバックグラウンドでのドキュメント生成処理（非同期化）に最適。自動でSwagger/OpenAPIドキュメントが生成されるため、フロントエンドとの連携も容易。
LangChain: チャット履歴の管理、プロンプトテンプレートの構造化、および外部LLM（OpenAI API等）への抽象化されたアクセスレイヤーを提供するため。
データベース（PostgreSQL）:
ユーザー情報、プロジェクトデータ、時系列のチャット履歴、およびバージョン管理されるMarkdownドキュメントといった、リレーショナルな構造とJSONデータの双方を堅牢に管理するため。
インフラストラクチャー（Docker / Docker Compose）:
フロントエンド、バックエンド、データベースをそれぞれコンテナ化することで、開発・検証・本番環境における環境差異を排除し、デプロイの容易性と拡張性を担保。
2. アーキテクチャ方針
バックエンド構成: クリーンアーキテクチャ（またはレイヤードアーキテクチャ）の考え方を導入し、「ルーター（API）」、「サービス（ビジネスロジック・LangChain連携）」、「リポジトリ（DBアクセスマネジメント）」に責務を分離する。これにより、プロンプトのチューニングやLLMモデルの変更に対する拡張性を高める。
非同期・ストリーミング処理: チャットの対話では Server-Sent Events (SSE) または WebSocket を用いたストリーミング応答を実装し、ユーザーの待ち時間を軽減する。また、ヒアリング完了後の「4種の設計書一括生成」では、タスクがタイムアウトしないよう非同期バックグラウンドワーカー（FastAPI BackgroundTasks もしくは Celery）による処理を導入する。
3.2 データモデル定義
1. 主要エンティティ一覧
User（ユーザー）: システムを利用する開発者やPMのアカウント情報を管理。
Project（プロジェクト）: 1つの開発案件（アイデア）単位。チャットセッションや生成ドキュメントの親となる。
ChatHistory（チャット履歴）: ユーザーとAIの間で行われた対話のログ。
GeneratedDocument（生成ドキュメント）: ヒアリング結果を基に生成された4種のMarkdownテキスト（要件定義、外部設計、内部設計、実装計画）およびそのバージョンを管理。
PromptTemplate（プロンプトテンプレート）: ※Should have要件を見据え、WebアプリやAPI向けなどのテンプレート定義を保持。
2. テーブル定義
① users テーブル



カラム名	データ型	制約	説明
id	UUID	PK, DEFAULT gen_random_uuid()	ユーザーID
email	VARCHAR(255)	UNIQUE, NOT NULL	メールアドレス
password_hash	VARCHAR(255)	NOT NULL	パスワードハッシュ
created_at	TIMESTAMP	NOT NULL, DEFAULT CURRENT_TIMESTAMP	作成日時
updated_at	TIMESTAMP	NOT NULL, DEFAULT CURRENT_TIMESTAMP	更新日時
② projects テーブル



カラム名	データ型	制約	説明
id	UUID	PK, DEFAULT gen_random_uuid()	プロジェクトID
user_id	UUID	FK (users.id), NOT NULL	所有ユーザーID
title	VARCHAR(255)	NOT NULL	プロジェクト名 / アイデア概要
status	VARCHAR(50)	NOT NULL, DEFAULT 'interviewing'	状態 (interviewing: ヒアリング中, generating: 生成中, completed: 完了)
created_at	TIMESTAMP	NOT NULL, DEFAULT CURRENT_TIMESTAMP	作成日時
updated_at	TIMESTAMP	NOT NULL, DEFAULT CURRENT_TIMESTAMP	更新日時
③ chat_histories テーブル



カラム名	データ型	制約	説明
id	UUID	PK, DEFAULT gen_random_uuid()	チャット履歴ID
project_id	UUID	FK (projects.id), NOT NULL	プロジェクトID
sender	VARCHAR(20)	NOT NULL	送信者タイプ ('user' or 'ai')
message	TEXT	NOT NULL	メッセージ本文
created_at	TIMESTAMP	NOT NULL, DEFAULT CURRENT_TIMESTAMP	送信日時
④ generated_documents テーブル



カラム名	データ型	制約	説明
id	UUID	PK, DEFAULT gen_random_uuid()	ドキュメントID
project_id	UUID	FK (projects.id), NOT NULL	プロジェクトID
doc_type	VARCHAR(50)	NOT NULL	種別 ('requirement', 'external_design', 'internal_design', 'implementation_plan')
content	TEXT	NOT NULL	生成されたMarkdownテキスト
version	INT	NOT NULL, DEFAULT 1	バージョン番号
created_at	TIMESTAMP	NOT NULL, DEFAULT CURRENT_TIMESTAMP	作成日時
⑤ prompt_templates テーブル（※Should have対応）



カラム名	データ型	制約	説明
id	UUID	PK, DEFAULT gen_random_uuid()	テンプレートID
name	VARCHAR(100)	NOT NULL	テンプレート名 (例: "Webアプリ向け")
target_type	VARCHAR(50)	NOT NULL	対象システム種別
system_prompt	TEXT	NOT NULL	LLMに与えるシステムプロンプト定義
created_at	TIMESTAMP	NOT NULL, DEFAULT CURRENT_TIMESTAMP	作成日時
3.3 バックエンド処理・モジュール設計
1. 主要処理ロジック（ビジネスロジック）の分割方針
FastAPIのアプリケーションディレクトリ構成と責務の分割を以下のように定義する。

Text

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
chat_service.py:
ユーザーからの入力とこれまでの chat_histories をLangChainのメモリ（Memory）にロードし、LLMへ送信。
ヒアリングが十分な状態に達したか（あるいはユーザーが生成を要求したか）を判定するロジックを保持。
doc_generator_service.py:
ヒアリング完了時、チャット全履歴をコンテキストとしてインプットし、「要件定義」「外部設計」「内部設計」「実装計画」のそれぞれに特化したプロンプトを実行。
バックグラウンドタスクとして非同期実行され、進捗や結果をデータベース (generated_documents) に保存。
2. APIエンドポイント一覧



メソッド	パス	概要	認証要否
POST	/api/v1/auth/register	新規ユーザー登録	不要
POST	/api/v1/auth/login	ログイン（JWT発行）	不要
POST	/api/v1/projects	新規プロジェクト（アイデア）作成	必要
GET	/api/v1/projects	ユーザーのプロジェクト一覧取得	必要
GET	/api/v1/projects/{id}	特定プロジェクトの詳細・状態取得	必要
POST	/api/v1/projects/{id}/chat	チャットメッセージ送信・AI応答取得（ストリーミング対応）	必要
GET	/api/v1/projects/{id}/chat	特定プロジェクトのチャット履歴取得	必要
POST	/api/v1/projects/{id}/generate	設計書4種の自動生成トリガー（非同期）	必要
GET	/api/v1/projects/{id}/documents	生成された設計書一覧・内容の取得	必要
GET	/api/v1/projects/{id}/documents/{doc_id}/download	指定Markdownドキュメントのダウンロード	必要
3.4 例外処理・エラーハンドリング・ログ設計
1. 共通エラーレスポンス形式
API全体で一貫したエラーハンドリングを行うため、エラー発生時は以下のJSONフォーマットでレスポンスを返却する。

JSON

{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "ユーザー向けの詳細なエラーメッセージ",
    "details": []
  }
}
主なエラーコード例：

UNAUTHORIZED: 認証トークンが無効または有効期限切れ
RESOURCE_NOT_FOUND: 指定されたプロジェクトやドキュメントが存在しない
LLM_API_ERROR: 外部LLMプロバイダー（OpenAI等）との通信エラーやレートリミット超過
INTERNAL_SERVER_ERROR: 予期せぬサーバーエラー
2. 例外検知・ログ出力方針
ログライブラリ: Python標準の logging モジュール（または構造化ログを出力する structlog）を使用し、JSON形式でログを出力する。
ログレベルの定義:
DEBUG: 開発環境での詳細なデバッグ情報（SQLクエリ、プロンプトの内容など）
INFO: APIリクエストの受付、プロジェクト作成、ドキュメント生成完了などの主要なライフサイクルイベント
WARNING: 外部APIの応答遅延、バリデーションエラー等の軽微な問題
ERROR: データベース接続エラー、外部LLMの呼び出し失敗、予期せぬ例外（スタックトレースを必ず記録）
例外キャッチとハンドリング:
FastAPIの exception_handler を用いて、カスタム例外（例: AppException）および未処理の Exception をグローバルにキャッチし、適切なHTTPステータスコードと共通エラーレスポンスに変換して返却する。
4. 実装計画書：Devex
本実装計画書は、提示された要件定義書および内部設計書に基づき、システム開発プロジェクト「Devex」を安全、確実、かつ効率的に推進するためのロードマップを定義するものである。

4.1 開発フェーズ分割・マイルストーン
プロジェクトの確実な立ち上げとリスク最小化のため、機能を段階的にリリースする2フェーズの開発アプローチを採用する。

フェーズ1：MVP（最小実用製品）開発 ── 【最優先・Must have】
目的: コア機能である「チャットによるヒアリング」「LangChainを用いた4種のMarkdown設計書自動生成」「結果のプレビュー・保存」の動作をエンドツーエンドで検証する。
対象機能:
ユーザー認証（JWTによる登録・ログイン）
プロジェクト管理（作成、一覧・詳細取得）
チャット機能（FastAPI + LangChainによる対話、ストリーミング応答）
設計書一括生成機能（バックグラウンド処理による4種のMarkdown生成）
ドキュメント閲覧・コピー・ダウンロード機能
PostgreSQLによるデータ永続化
マイルストーン1: バックエンドのLLM連携とフロントエンドのチャットUI結合完了（Week 3）
マイルストーン2: MVPリリース・社内/個人検証開始（Week 5）
フェーズ2：機能拡張・品質向上 ── 【Should have】
目的: ユーザビリティの向上および、将来的な運用・拡張を見据えた機能の実装。
対象機能:
生成されたドキュメントのバージョン管理・履歴保持 (generated_documents のバージョンインクリメント)
プロンプトテンプレートの選択機能（Webアプリ向け、API向けなど、prompt_templates の適用）
エラーハンドリングの堅牢化、ログの構造化・監視強化
マイルストーン3: フェーズ2機能実装完了および安定化（Week 7）
4.2 タスク分解（WBS案）
プロジェクト全体を5つのカテゴリに分割し、詳細なタスクを定義する。

1. 要件確認・環境構築タスク
 プロジェクトキックオフ、要件および内部設計の確認
 Gitリポジトリの初期設定（Monorepo構成 または フロント・バック別リポジトリの選定）
 Docker / Docker Compose環境構築（Next.js, FastAPI, PostgreSQLのコンテナ連携確認）
 外部API（OpenAI等）のAPIキー取得および環境変数（.env）の管理方針策定
2. バックエンド開発タスク（FastAPI + LangChain）
 データベース設計・マイグレーション実装: SQLAlchemy / Alembicを用いたテーブル（users, projects, chat_histories, generated_documents, prompt_templates）の構築
 認証基盤の実装: JWT発行・検証ミドルウェア、パスワードハッシュ化 (auth/register, auth/login)
 プロジェクト・チャットAPI実装:
プロジェクトCRUD API
チャットメッセージ送受信・LangChainメモリ連携・ストリーミング応答（SSE）ロジック (chat_service.py)
 ドキュメント生成AIロジック実装:
チャット履歴をコンテキストとした4種設計書生成ロジック (doc_generator_service.py)
バックグラウンドタスク（BackgroundTasks）による非同期生成処理の実装
 ドキュメント閲覧・エクスポートAPI実装: ドキュメント取得・ダウンロード用エンドポイント
 共通エラーハンドリング・ログ出力実装: グローバル例外ハンドラ、JSON構造化ログの導入
3. フロントエンド開発タスク（Next.js）
 プロジェクト初期設定・ルーティング設計: Next.js (App Router) のレイアウト、Tailwind CSS等によるスタイリング基盤構築
 認証画面の実装: 新規登録画面、ログイン画面、JWTのクライアント側保持（Cookie/LocalStorage）と認可ガード
 ダッシュボード画面の実装: プロジェクト一覧表示、新規プロジェクト作成モーダル
 チャットヒアリング画面の実装:
リアルタイムに近い対話UI、メッセージのストリーミング表示対応
ヒアリング完了・生成トリガーボタンの実装
 ドキュメントプレビュー・エクスポート画面の実装:
4種のMarkdownタブ切り替え表示、プレビューエリア（Markdownレンダラー）
クリップボードへのコピー機能、ファイルダウンロード機能
4. 統合テスト・品質保証タスク
 バックエンド単体テスト: Pytestを用いたAPIエンドポイントおよび各サービスのモックテスト
 フロントエンド単体・コンポーネントテスト: 主要UIコンポーネントの動作確認
 E2E（エンドツーエンド）テスト: 「ログイン ➔ プロジェクト作成 ➔ チャットヒアリング ➔ 設計書生成 ➔ ダウンロード」の一連のフロー検証
 パフォーマンス・セキュリティ確認: LLM呼び出しタイムアウト時の挙動確認、SQLインジェクションや不正アクセス対策のレビュー
5. デプロイ・運用準備タスク
 本番環境用Dockerイメージのビルド最適化（マルチステージビルド等）
 クラウドインフラ（例: Render, AWS, Fly.io等）へのデプロイ検証
 運用マニュアル・READMEの整備
4.3 開発環境・CI/CD・事前準備事項
1. 開発に必要なツール・ライブラリ
バージョン管理: GitHub
コンテナ技術: Docker / Docker Compose
バックエンド: Python 3.11+, FastAPI, LangChain, OpenAI SDK, SQLAlchemy, Alembic, Pydantic
フロントエンド: Node.js (LTS), Next.js (App Router), TypeScript, Tailwind CSS, Markdownビューアライブラリ
データベース: PostgreSQL 15+
2. リポジトリ構成案
Text

devex/
├── .github/
│   └── workflows/        # CI/CDパイプライン定義
├── backend/
│   ├── app/              # 内部設計に準拠したソースコード
│   ├── tests/            # Pytest
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/              # Next.js App Router構成
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml    # ローカル開発用一括起動
3. 自動テスト・CI/CD方針
GitHub Actionsを活用したCIパイプライン:
プルリクエスト作成時およびmainブランチへのマージ時に自動実行。
バックエンド: flake8 / black（コードフォーマット・静的解析）および pytest（単体テスト）。
フロントエンド: npm run lint および npm run build（ビルドエラー検知）。
デプロイ方針（MVP段階）:
Dockerコンテナをベースに、主要なクラウドホスティングサービスへ手動またはシンプルなWebhookによる自動デプロイから開始する。
4.4 想定リスクと対策（トレードオフ・後回し候補）
プロジェクト推進にあたって想定されるリスクと、その具体的な対策・トレードオフ方針を以下に整理する。

1. 技術的リスク
リスク1: 外部LLM（OpenAI等）のAPI制限（Rate Limit）やレスポンス遅延
対策: バックエンド側でリトライ処理（指数バックオフ）を実装する。また、ストリーミング応答を適切に処理することで、ユーザー側の体感待ち時間を軽減する。
リスク2: 4種の設計書一括生成時のタイムアウトやメモリ枯渇
対策: 内部設計に示されている通り、FastAPIのBackgroundTasksを用いた完全な非同期処理とし、フロントエンド側はポーリングまたはWebSocket等で進捗・完了通知を受け取るアーキテクチャを徹底する。
2. スケジュール・スコープのトレードオフリスク
リスク3: 開発遅延発生時の対応方針（機能削減の優先順位）
トレードオフ策:
納期遅延が危ぶまれた場合、「フェーズ2（Should have要件）」に含まれる機能（バージョン管理、プロンプトテンプレート選択切り替え）を完全にカットし、フェーズ1（MVP）の必須機能にリソースを集中させる。
リアルタイムプレビュー（分割画面）などのCould have要件についても、通常のタブ切り替え式等への簡素化を即座に判断する。

