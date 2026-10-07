// 作成：Phase-25-2
// 実装手順書のデモの仮データ。appendix/implementation-procedure-sample/ の見本と同じ中身
// (題材は、ゴール3で Devex 自身を題材に生成した段階1〜7)。設計の中身(DEMO_SOURCES)は生成物から書き写した。
import type { DesignSources, Finding, ProjectContext, Unit } from "./procedureDocModel";

export const DEMO_CONTEXT: ProjectContext = {
  name: "Devex",
  scope: "段階7のマイルストーン M-01〜M-04(すべて Must)、処理 F-01〜F-11 を実装する。",
  rules: [
    "技術スタック: Python 3.13、FastAPI、Next.js (App Router) + Tamagui、PostgreSQL、Redis、Docker Compose、pytest。",
    "層は 入口 → ユースケース → 永続化 / 外部連携 の向きにだけ依存する(段階4)。",
    "ルート(api/routes/*)は、リポジトリ・外部連携を直接呼ばない(段階4)。",
    "例外は各エンドポイントで一括して HTTP に変換する。入力 400 / 認証 401 / 無い 404 / 想定外 500(07章)。",
    "書き込みはリポジトリでトランザクションを管理し、成功したら commit、例外なら rollback(07章)。",
    "パスワード・トークンをログに出さない(07章)。",
    "外部サービスの呼び出しは、タイムアウトとレート制限を考えて例外処理とリトライを行う(07章)。",
  ],
};

const M01 = "M-01 環境構築と認証・横断事項の実装";
const M02 = "M-02 プロジェクト管理と参考資料アップロード機能の実装";
const M03 = "M-03 AI対話ヒアリングとSSEストリーミングの実装";
const M04 = "M-04 4種設計書の自動生成と自己診断・閲覧機能の実装";

const feature = (id: string, milestone: string, title: string, fn: string, dependsOn: string[]): Unit => ({
  id,
  kind: "feature",
  milestone,
  title,
  functionIds: [fn],
  dependsOn,
  detail: null,
});

// 段階7の並び順(改修後の見本 stage7-recut.md)。依存順に並べ替えるのは sortUnitsByDependency。
export const DEMO_UNITS: Unit[] = [
  {
    id: "M-01-T01",
    kind: "base",
    milestone: M01,
    title: "開発環境と横断事項の土台",
    functionIds: [],
    dependsOn: [],
    detail: {
      purpose:
        "Docker Compose で開発環境が起動し、どの機能の単位からも使う横断事項(例外の HTTP への変換・ログ・Redis への接続)がそろった状態にする。",
      refs: [
        { kind: "environment", key: "" },
        { kind: "module", key: "cache/redis_client.py" },
        { kind: "crosscutting", key: "例外と HTTP" },
        { kind: "crosscutting", key: "ログ" },
        { kind: "crosscutting", key: "レート制限" },
      ],
      files: [
        { path: "docker-compose.yml", responsibility: "backend・frontend・PostgreSQL・Redis の起動", basis: "段階7 環境・設定のファイル(例)" },
        { path: "Dockerfile", responsibility: "backend のイメージ", basis: "同上" },
        { path: "frontend/package.json", responsibility: "frontend の依存", basis: "同上" },
        { path: "cache/redis_client.py", responsibility: "Redis への接続(レート制限と、トークンの失効で使う)", basis: "段階4" },
        { path: "main.py", responsibility: "アプリの組み立てと、例外から HTTP への共通の変換", basis: "07章 例外と HTTP(段階4に無い)" },
        { path: "tests/unit/test_errors.py", responsibility: "例外の種類ごとに、07章のステータスになることのテスト", basis: "手順書で決める" },
      ],
      notes: [
        "環境のファイルを先に作り、compose で起動できることを確かめてから、横断事項に進む。",
        "この単位では機能を作らない。例外の変換は、テスト用のダミーの例外で確かめる。",
      ],
      tests: [
        {
          id: "TC-01",
          viewpoint: "例外の種類ごとに、07章のステータスになる",
          sut: "例外から HTTP への変換",
          driver: "結合テスト(テスト用のルートを足したアプリを httpx で呼ぶ)",
          stub: "スタブ不要 ── 変換は外部依存を呼ばないため",
        },
      ],
      gwt: [],
      verify: ["docker compose up で全コンテナが起動する。", "上のテストが通る。"],
    },
  },
  {
    id: "M-01-T02",
    kind: "feature",
    milestone: M01,
    title: "新規ユーザー登録を行う",
    functionIds: ["F-01"],
    dependsOn: ["M-01-T01"],
    detail: {
      purpose: "利用者が SCR-002 でメールアドレスとパスワードを入力し、アカウントを作れるようにする。",
      refs: [
        { kind: "procedure", key: "F-01" },
        { kind: "module", key: "repositories/user_repository.py" },
        { kind: "module", key: "services/auth_service.py" },
        { kind: "module", key: "api/routes/auth.py" },
        { kind: "module", key: "frontend" },
        { kind: "crosscutting", key: "例外と HTTP" },
        { kind: "crosscutting", key: "認証" },
        { kind: "crosscutting", key: "トランザクション" },
      ],
      files: [
        { path: "repositories/user_repository.py", responsibility: "ユーザーの保存と、メールアドレスでの検索", basis: "段階4" },
        { path: "services/auth_service.py", responsibility: "登録の業務ルール(重複の確認・パスワードのハッシュ化)", basis: "段階4・07章 認証" },
        { path: "api/routes/auth.py", responsibility: "POST /api/v1/auth/signup と、例外から HTTP への変換", basis: "段階1 F-01・07章 例外と HTTP" },
        { path: "frontend", responsibility: "SCR-002 の入力と送信", basis: "段階4(ファイルが決まらない)" },
        { path: "tests/unit/test_auth_service_signup.py", responsibility: "登録の業務ルールの単体テスト", basis: "手順書で決める" },
        { path: "tests/integration/test_signup_api.py", responsibility: "登録 API の結合テスト", basis: "手順書で決める" },
      ],
      notes: [
        "マイグレーションを1本足す(ユーザーのテーブルの新規作成。中身は段階3が決まってから)。",
        "依存されるものから作る: リポジトリ → サービス → ルート → 画面。",
      ],
      tests: [
        { id: "TC-01", viewpoint: "登録できる", sut: "auth_service の登録", driver: "単体テスト(pytest)", stub: "user_repository をフェイク。DB に依存せず業務ルールだけを見るため" },
        { id: "TC-02", viewpoint: "登録済みのメールアドレスでは登録できない", sut: "同上", driver: "同上", stub: "同上" },
        { id: "TC-03", viewpoint: "API で登録でき、DB に1行入る", sut: "POST /api/v1/auth/signup", driver: "結合テスト(httpx)", stub: "スタブ不要 ── 外部サービスを呼ばず、DB はテスト用の本物を使うため" },
      ],
      gwt: [
        "TC-01: Given 未登録のメールアドレス / When 登録 / Then フェイクに1件保存され、パスワードはハッシュになっている。",
        "TC-02: Then はエラーの形 ── 未定義(重複時の応答)が決まってから書く。",
      ],
      verify: ["上の単体・結合テストが通る。", "開発環境で SCR-002 から登録し、ログイン(M-01-T03)に進める。"],
    },
  },
  feature("M-01-T03", M01, "ログインを行う", "F-02", ["M-01-T02"]),
  feature("M-01-T04", M01, "ログアウトを行う", "F-03", ["M-01-T03"]),
  { id: "M-01-T05", kind: "base", milestone: M01, title: "自動デプロイ", functionIds: [], dependsOn: ["M-01-T01"], detail: null },
  feature("M-02-T01", M02, "プロジェクトを作成し参考資料をアップロードする", "F-05", ["M-01-T03"]),
  feature("M-02-T02", M02, "プロジェクト一覧を取得する", "F-04", ["M-02-T01"]),
  feature("M-02-T03", M02, "プロジェクト詳細を取得する", "F-06", ["M-02-T01"]),
  {
    id: "M-03-T01",
    kind: "feature",
    milestone: M03,
    title: "チャットメッセージを送信する",
    functionIds: ["F-07"],
    dependsOn: ["M-02-T03"],
    detail: {
      purpose: "利用者が SCR-005 でメッセージを送ると、AI の応答が SSE で少しずつ表示されるようにする。",
      refs: [
        { kind: "procedure", key: "F-07" },
        { kind: "logic", key: "L-01" },
        { kind: "module", key: "repositories/project_repository.py" },
        { kind: "module", key: "external/gemini_client.py" },
        { kind: "module", key: "services/ai_service.py" },
        { kind: "module", key: "api/routes/projects.py" },
        { kind: "module", key: "frontend" },
        { kind: "crosscutting", key: "例外と HTTP" },
        { kind: "crosscutting", key: "認証" },
        { kind: "crosscutting", key: "外部サービスの呼び出し" },
        { kind: "crosscutting", key: "レート制限" },
      ],
      files: [
        { path: "repositories/project_repository.py", responsibility: "プロジェクトの存在確認と、チャット履歴の読み書き", basis: "段階4。L-01 疑似コード1" },
        { path: "external/gemini_client.py", responsibility: "Gemini とのストリーミングの対話", basis: "段階4。F-07#3" },
        { path: "services/ai_service.py", responsibility: "AIservice.stream_chat: 存在確認 → 対話 → SSE の形に変えて順に返す", basis: "L-01" },
        { path: "api/routes/projects.py", responsibility: "POST /api/v1/projects/{id}/chat: 検証して stream_chat を呼び、SSE で返す", basis: "F-07#1・#2" },
        { path: "frontend", responsibility: "SCR-005 の送信と、応答の逐次表示", basis: "段階4(ファイルが決まらない)" },
        { path: "tests/unit/test_ai_service_stream_chat.py", responsibility: "stream_chat の単体テスト", basis: "手順書で決める" },
        { path: "tests/integration/test_chat_api.py", responsibility: "チャット API の結合テスト", basis: "手順書で決める" },
      ],
      notes: [
        "依存されるものから作る: リポジトリ・外部連携 → サービス → ルート → 画面。サービスまでは単体テストで確かめられるので、ルートと画面より先に終える。",
        "認証済みの利用者を得る部品は、M-01-T03 で作ったものを使う(既存の部品の再利用)。",
      ],
      tests: [
        { id: "TC-01", viewpoint: "応答が SSE の形で順に返る", sut: "AIservice.stream_chat", driver: "単体テスト(pytest)", stub: "GeminiClient・project_repository をフェイク。外部 API と DB に依存せず、変換の順序だけを見るため" },
        { id: "TC-02", viewpoint: "無いプロジェクトでは例外になる", sut: "AIservice.stream_chat", driver: "単体テスト(pytest)", stub: "TC-01 と同じ" },
        { id: "TC-03", viewpoint: "API が text/event-stream で応答する", sut: "POST /api/v1/projects/{id}/chat", driver: "結合テスト(httpx)", stub: "GeminiClient だけをフェイク。外部 API を呼ばないため" },
        { id: "TC-04", viewpoint: "送信すると応答が少しずつ表示される", sut: "SCR-005 のチャット", driver: "画面のテスト(vitest + Testing Library)", stub: "SSE の受信をモック。バックエンドに依存しないため" },
      ],
      gwt: [
        "TC-01: Given 存在するプロジェクト / When stream_chat(id, \"こんにちは\") / Then フェイクのチャンクが、SSE の data: 行として同じ順に出る。",
        "TC-02: Given 無いプロジェクト / When stream_chat / Then ValueError(L-01 の例外)。",
      ],
      verify: ["上の単体・結合・画面のテストが通る。", "開発環境で SCR-005 を開き、メッセージを送ると応答が少しずつ表示される。"],
    },
  },
  feature("M-04-T01", M04, "ヒアリング結果を承認し設計書生成をトリガーする", "F-08", ["M-03-T01"]),
  feature("M-04-T02", M04, "生成された設計書一覧を取得する", "F-09", ["M-04-T01"]),
  feature("M-04-T03", M04, "特定の設計書内容と自己診断結果を取得する", "F-10", ["M-04-T02"]),
  feature("M-04-T04", M04, "設計書の自己診断を実行する", "F-11", ["M-04-T03"]),
];

export const DEMO_FINDINGS: Finding[] = [
  { severity: "critical", source: "check", unitId: null, target: "段階3", message: "テーブルが0件。どの単位もテーブルを参照できない", stage: 3 },
  { severity: "major", source: "check", unitId: null, target: "段階4 frontend", message: "モジュールがディレクトリで、作るファイルが決まらない", stage: 4 },
  { severity: "major", source: "ai", unitId: null, target: "段階1", message: "要件定義 Must の「設計書のプレビュー、コピー、ダウンロード」に当たる処理が無い", stage: 1 },

  { severity: "critical", source: "ai", unitId: "M-01-T01", target: "07章 例外と HTTP", message: "変換する場所が「各エンドポイント」とあるだけで、共通のハンドラにするかが決まっていない", stage: 7 },
  { severity: "major", source: "check", unitId: "M-01-T01", target: "段階4", message: "main.py が段階4のモジュール一覧に無い。共通の例外ハンドラを置く場所として、段階4に足すかを決める", stage: 4 },
  { severity: "major", source: "ai", unitId: "M-01-T01", target: "07章 レート制限", message: "上限の値(何秒に何回)が無い", stage: 7 },

  { severity: "critical", source: "check", unitId: "M-01-T02", target: "段階5 F-01", message: "手順が無い(段階5で F-01 を選んでいない)", stage: 5 },
  { severity: "critical", source: "ai", unitId: "M-01-T02", target: "段階3 / F-01", message: "保存する項目(メールアドレス・パスワードのハッシュなど)が無い", stage: 3 },
  { severity: "critical", source: "ai", unitId: "M-01-T02", target: "外部設計 2.6 / F-01", message: "メールアドレスが登録済みのときの応答(ステータスとエラーの形)が無い", stage: 1 },
  { severity: "major", source: "ai", unitId: "M-01-T02", target: "07章 認証", message: "パスワードの強度の条件(長さ・文字種)が無い", stage: 7 },
  { severity: "major", source: "check", unitId: "M-01-T02", target: "段階6", message: "services/auth_service.py の関数が無い(段階6で選んでいない)", stage: 6 },

  { severity: "critical", source: "ai", unitId: "M-03-T01", target: "F-07#1〜#4 / 段階4 repositories/project_repository.py", message: "チャット履歴を、いつ・どのテーブルに保存するかが無い", stage: 5 },
  { severity: "critical", source: "ai", unitId: "M-03-T01", target: "07章 例外と HTTP / F-07#4", message: "ストリーミングの途中で外部サービスが失敗したときの応答が無い(SSE はヘッダを送った後)", stage: 7 },
  { severity: "critical", source: "ai", unitId: "M-03-T01", target: "F-07#1 / 07章 認証", message: "他人のプロジェクトにメッセージを送ったときの扱い(認可)が無い", stage: 7 },
  { severity: "major", source: "check", unitId: "M-03-T01", target: "F-07#4", message: "呼び出し先 frontend が、呼び出し元 services/ai_service.py の依存先に無い(層の飛び越し)", stage: 5 },
  { severity: "major", source: "check", unitId: "M-03-T01", target: "F-07#1", message: "分岐「3a へ」の行が無い(F-07 にあるのは 1a だけ)", stage: 5 },
  { severity: "major", source: "ai", unitId: "M-03-T01", target: "段階4 services/ai_service.py / F-07#3", message: "LangGraph の制御をどこが持つかが食い違う(段階4は ai_service、手順は GeminiClient.invoke_lang_graph)", stage: 4 },
  { severity: "major", source: "ai", unitId: "M-03-T01", target: "L-01 疑似コード4", message: "「自己診断の結果や4種設計書の逐次生成データをストリームに含める」は F-08 の責務に見える", stage: 6 },
  { severity: "minor", source: "ai", unitId: "M-03-T01", target: "07章 レート制限", message: "チャットの送信をレート制限の対象にするかが無い", stage: 7 },
];

export const DEMO_SOURCES: DesignSources = {
  procedures: {
    "F-07": {
      id: "F-07",
      name: "チャットメッセージを送信する",
      trigger: "POST /api/v1/projects/{id}/chat",
      steps: [
        { no: "1", route: "frontend → api/routes/projects.py", call: "post_chat", data: "プロジェクトID(id), チャットメッセージ", action: "チャットメッセージ送信リクエストを受け付ける", result: "SSEストリーミングレスポンス", db: "—", branch: "3a へ" },
        { no: "1a", route: "—", call: "—", data: "—", action: "リクエストパラメータまたは認証の検証に失敗した場合", result: "ValidationError → 400", db: "—", branch: "—" },
        { no: "2", route: "api/routes/projects.py → services/ai_service.py", call: "AIservice.stream_chat → 詳細: L-01", data: "プロジェクトID(id), チャットメッセージ", action: "LangGraphによるチャットメッセージ処理とストリーミングの実行を依頼する", result: "ストリーミングジェネレーター", db: "—", branch: "—" },
        { no: "3", route: "services/ai_service.py → external/gemini_client.py", call: "GeminiClient.invoke_lang_graph", data: "チャットメッセージ, 過去の対話履歴", action: "LangGraph制御に基づくGemini Flash-Lite APIとの対話処理を実行する", result: "対話ストリーミングデータ", db: "—", branch: "—" },
        { no: "4", route: "services/ai_service.py → frontend", call: "—", data: "SSEストリーミングデータ", action: "生成されたチャット応答をSSE形式でフロントエンドに返却する", result: "SSEストリーミング応答", db: "—", branch: "—" },
      ],
    },
  },
  logics: {
    "L-01": {
      id: "L-01",
      fn: "AIservice.stream_chat",
      module: "services/ai_service.py",
      rows: [
        ["シグネチャ", "async def stream_chat(self, id: str, message: str) -> AsyncGenerator[str, None]"],
        ["引数", "id: プロジェクトID / message: チャットメッセージ"],
        ["戻り値", "SSEフォーマットに則ったストリーミングジェネレーター"],
        ["例外", "ValueError: プロジェクトが存在しない場合 / Exception: 外部サービスでのエラー時"],
        ["事前条件", "プロジェクトIDが有効であり、かつ該当プロジェクトが存在すること"],
        ["事後条件", "LangGraphを通じた対話制御とSSEストリーミングが実行されること"],
      ],
      pseudo: [
        { text: "プロジェクトの存在確認を行う", sub: ["project_repositoryを使用してプロジェクトIDを検証する", "存在しない場合はエラーを送出する"] },
        { text: "LangGraphによる対話制御のグラフを初期化する", sub: ["document_repositoryから関連するドキュメントを取得する", "グラフの状態を設定する"] },
        { text: "gemini_clientを呼び出してストリーミング処理の準備をする", sub: ["チャットメッセージをクライアントに入力として渡す"] },
        { text: "SSEフォーマットに変換しながらレスポンスを順次生成する", sub: ["自己診断の結果や4種設計書の逐次生成データをストリームに含める"] },
      ],
    },
  },
  modules: {
    "frontend": { path: "frontend", layer: "入口", responsibility: "Next.jsとTamaguiによる画面描画、プレビュー、操作インターフェースを提供する。", dependsOn: ["api/routes/auth.py", "api/routes/projects.py", "api/routes/documents.py"] },
    "api/routes/auth.py": { path: "api/routes/auth.py", layer: "入口", responsibility: "サインアップ、ログイン、ログアウトのエンドポイント制御を行う。", dependsOn: ["services/auth_service.py"] },
    "api/routes/projects.py": { path: "api/routes/projects.py", layer: "入口", responsibility: "プロジェクト管理、参考資料アップロード、チャット、承認のエンドポイント制御を行う。", dependsOn: ["services/project_service.py", "services/ai_service.py"] },
    "api/routes/documents.py": { path: "api/routes/documents.py", layer: "入口", responsibility: "設計書の取得、自己診断実行のエンドポイント制御を行う。", dependsOn: ["services/ai_service.py"] },
    "services/auth_service.py": { path: "services/auth_service.py", layer: "ユースケース", responsibility: "JWT発行やパスワードハッシュ化などの認証ビジネスロジックを処理する。", dependsOn: ["repositories/user_repository.py", "cache/redis_client.py"] },
    "services/project_service.py": { path: "services/project_service.py", layer: "ユースケース", responsibility: "参考資料のテキスト抽出、プロジェクト管理のビジネスロジックを実行する。", dependsOn: ["repositories/project_repository.py", "external/gemini_client.py"] },
    "services/ai_service.py": { path: "services/ai_service.py", layer: "ユースケース", responsibility: "LangGraphによる対話制御、SSEストリーミング、4種設計書の逐次生成と自己診断の実行を行う。", dependsOn: ["repositories/project_repository.py", "repositories/document_repository.py", "external/gemini_client.py"] },
    "repositories/user_repository.py": { path: "repositories/user_repository.py", layer: "永続化", responsibility: "PostgreSQL上のユーザー情報の読み書きを行う。", dependsOn: ["PostgreSQL"] },
    "repositories/project_repository.py": { path: "repositories/project_repository.py", layer: "永続化", responsibility: "PostgreSQL上のプロジェクトおよびチャット履歴の読み書きを行う。", dependsOn: ["PostgreSQL"] },
    "repositories/document_repository.py": { path: "repositories/document_repository.py", layer: "永続化", responsibility: "PostgreSQL上の生成文書と自己診断結果（バージョン管理付き）の読み書きを行う。", dependsOn: ["PostgreSQL"] },
    "cache/redis_client.py": { path: "cache/redis_client.py", layer: "外部連携", responsibility: "Redisによるレート制限およびトークン失効管理を行う。", dependsOn: ["Redis"] },
    "external/gemini_client.py": { path: "external/gemini_client.py", layer: "外部連携", responsibility: "Gemini Flash-Lite APIとの通信およびPDFテキスト抽出を行う。", dependsOn: ["Gemini Flash-Lite API"] },
  },
  crosscutting: {
    "例外と HTTP": { topic: "例外と HTTP", policy: "システム内で発生した例外は、APIの各エンドポイントにて一括してハンドリングし、適切なHTTPステータスコードに変換する。入力値の検証エラーは400 Bad Request、認証エラーは401 Unauthorized、リソースが見つからない場合は404 Not Found、予期せぬ内部エラーは500 Internal Server Errorを返却する。" },
    "認証": { topic: "認証", policy: "認証にはJWTを使用し、アクセストークンの有効期限は30分、リフレッシュトークンの有効期限は14日とする。リフレッシュトークンはHttpOnly Cookieに格納して安全に送信し、アクセストークンはAuthorizationヘッダーを通じて検証する。ログアウト時にはRedisを用いてトークンをブラックリストに追加し失効させる。" },
    "トランザクション": { topic: "トランザクション", policy: "データベースへの書き込みおよび更新処理は、永続化層の各リポジトリでトランザクション管理を行う。サービス層におけるビジネスロジックの処理が正常に完了した段階で明示的に commit を実行し、例外発生時には確実に rollback を行うこと。" },
    "ログ": { topic: "ログ", policy: "すべてのAPIリクエストおよびエラー発生時には、処理ID、タイムスタンプ、ユーザーID、エラーメッセージなどの詳細情報を構造化ログとして出力する。セキュリティ上の理由から、パスワードやJWTアクセストークンなどの機密情報はログに出力しないこと。" },
    "レート制限": { topic: "レート制限", policy: "APIの乱用を防ぐため、Redisを活用してリクエストのレート制限（Rate Limiting）を実装する。一定時間内に許容される最大リクエスト数を超過したアクセスに対しては、429 Too Many Requestsを返却する。" },
    "外部サービスの呼び出し": { topic: "外部サービスの呼び出し", policy: "Gemini Flash-Lite APIなどの外部サービスとの通信では、ネットワークタイムアウトやレートリミット超過などの一時的な障害を考慮し、適切な例外処理およびリトライの方針を適用する。" },
  },
  environment: "開発環境としてPython 3.13、FastAPI、Next.js (App Router) + Tamagui、PostgreSQL、Redisを使用する。コンテナ化にはDocker Composeを用い、環境差異を排除する。CI/CDパイプラインにはGitHub Actionsを利用し、mainブランチへのpushをトリガーとしてVPS環境への自動デプロイを行う。自動テストはpytestおよびフロントエンドのテストフレームワークを用いて結合・単体テストを担保する。",
};
