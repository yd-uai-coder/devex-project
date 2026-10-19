// 作成：Phase-33-3
// 構造化した要件定義のデモの仮データ。題材は Devex 自身。
// 観点の表は、ヒアリングの途中(非機能の一部がまだ未決)から始める。
import type { FunctionRow, PointState, QuestionCard, Requirement, UnitRow } from "./hearingPointsModel";

export const DEMO_POINTS: PointState[] = [
  { key: "scale", status: "decided", summary: "個人開発のツール。同時に数人〜十数人", evidence: "発言1" },
  { key: "purpose", status: "decided", summary: "初期フェーズの文書作成の工数と属人化を減らす", evidence: "初期入力" },
  { key: "users", status: "decided", summary: "SE・IT コンサルタント・PM、個人開発者・創業者", evidence: "発言2" },
  { key: "daily_flow", status: "decided", summary: "打ち合わせの後に30分ほどでヒアリングし、その日のうちに見直す", evidence: "発言2" },
  { key: "core", status: "decided", summary: "ヒアリング → 4文書の逐次生成 → 自己診断 → プレビュー、再生成と版", evidence: "初期入力・発言3" },
  { key: "scope", status: "decided", summary: "履歴の画面・テンプレートの選択は Should。コード生成・外部連携は作らない", evidence: "発言3" },
  { key: "exceptions", status: "open", summary: "", evidence: "" },
  { key: "future", status: "decided", summary: "テンプレートの選択、版の履歴の画面、設計図", evidence: "発言3" },
  { key: "tech", status: "decided", summary: "Next.js + Tamagui / FastAPI + LangChain / PostgreSQL / Redis、Gemini Flash-Lite", evidence: "発言4" },
  { key: "schedule", status: "decided", summary: "個人、2〜3か月で MVP", evidence: "発言4" },
  { key: "availability", status: "open", summary: "", evidence: "" },
  { key: "performance", status: "decided", summary: "チャットは最初の文字が数秒、生成は数分まで待てる", evidence: "発言4" },
  { key: "operability", status: "open", summary: "", evidence: "" },
  { key: "migration", status: "not_applicable", summary: "新規。移すものは無い", evidence: "発言4" },
  { key: "security", status: "open", summary: "", evidence: "" },
  { key: "environment", status: "open", summary: "", evidence: "" },
];

// 次の発言の番号(デモの中で答えるたびに増える)
export const DEMO_NEXT_TURN = 5;

export const DEMO_CARDS: QuestionCard[] = [
  {
    point: "availability",
    question: "夜中や休日に Devex が止まっていたら、どのくらいで困りますか?",
    options: [
      { label: "半日〜1日止まっても困らない", consequence: "1台の VPS で足りる。止まったら手で戻す。費用は今のまま", recommended: true },
      { label: "1〜2時間で戻ってほしい", consequence: "死活監視と通知、戻す手順の整備が要る。手間が増える" },
      { label: "止まると困る(業務で常に使う)", consequence: "2台以上やマネージド DB で冗長にする。費用が数倍になる" },
    ],
  },
  {
    point: "security",
    question: "打ち合わせの内容を入れたプロジェクトを、誰に見られたら困りますか?",
    options: [
      { label: "自分以外の全員(本人だけが見られる)", consequence: "ログインした本人のプロジェクトだけを返す。今の範囲で作れる", recommended: true },
      { label: "同じチームの人とは共有したい", consequence: "共有と権限の仕組みが要る。MVP の対象外(マルチテナント)に当たる" },
      { label: "見られても困らない", consequence: "認可の確認を省ける。ただし、後から変えるのは難しい" },
    ],
  },
  {
    point: "exceptions",
    question: "AI の応答が途中で止まったら、送ったメッセージはどうなってほしいですか?",
    options: [
      { label: "理由を出して、送り直せばよい", consequence: "送ったメッセージは保存しない。作りが単純", recommended: true },
      { label: "続きから再開してほしい", consequence: "途中までの応答を保存し、再開の仕組みが要る。手間が大きい" },
    ],
  },
  {
    point: "environment",
    question: "どの端末・ブラウザで使いますか?",
    options: [
      { label: "PC の最新のブラウザ。スマホは読めれば十分", consequence: "画面は PC 向けに作り、スマホは崩れない程度にする", recommended: true },
      { label: "スマホでも同じように使いたい", consequence: "チャットとプレビューをスマホ向けにも作る。画面の手間が増える" },
    ],
  },
  {
    point: "operability",
    question: "止まったことに、誰がどうやって気づけばよいですか?",
    options: [
      { label: "使ったときに自分で気づけばよい", consequence: "監視は置かない。MVP の後で足す", recommended: true },
      { label: "止まったら通知がほしい", consequence: "死活監視とエラー追跡を置く。設定の手間が増える" },
    ],
  },
];

export const DEMO_REQUIREMENTS: Requirement[] = [
  { id: "FR-001", kind: "FR", priority: "Must", text: "メールアドレスとパスワードで登録・ログインできる(JWT)", source: "user", point: "core" },
  { id: "FR-002", kind: "FR", priority: "Must", text: "プロジェクトを作り、一覧から選べる", source: "adopted", point: "core" },
  { id: "FR-003", kind: "FR", priority: "Must", text: "初期入力で参考資料(txt・md・pdf、最大3件)を読み込む", source: "user", point: "core" },
  { id: "FR-004", kind: "FR", priority: "Must", text: "AI が観点ごとに質問するチャットでヒアリングする", source: "user", point: "core" },
  { id: "FR-005", kind: "FR", priority: "Must", text: "サマリを承認すると、4文書を順に生成する", source: "user", point: "core" },
  { id: "FR-006", kind: "FR", priority: "Must", text: "生成した文書をプレビュー・コピー・ダウンロードできる", source: "user", point: "core" },
  { id: "FR-007", kind: "FR", priority: "Must", text: "生成の後に、AI が不足点を3段階で自己診断して示す", source: "user", point: "core" },
  { id: "FR-008", kind: "FR", priority: "Must", text: "チャットで追加の回答をして再生成できる(版は直近3件)", source: "user", point: "core" },
  { id: "FR-009", kind: "FR", priority: "Must", text: "応答の途中で失敗したら理由を示し、再送を促す", source: "user", point: "exceptions" },
  { id: "FR-010", kind: "FR", priority: "Should", text: "版の履歴の閲覧・比較・復元の画面", source: "user", point: "future" },
  { id: "NFR-001", kind: "NFR", text: "止まっても半日なら許容する", source: "adopted", point: "availability" },
  { id: "NFR-002", kind: "NFR", text: "同時の利用者は数人〜十数人。チャットは最初の文字が数秒", source: "user", point: "performance" },
  { id: "NFR-003", kind: "NFR", text: "ログインした本人のプロジェクトだけを読み書きできる", source: "adopted", point: "security" },
  { id: "NFR-004", kind: "NFR", text: "通信は HTTPS で暗号化する", source: "assumed", point: "security" },
  { id: "CON-001", kind: "CON", text: "Next.js + Tamagui / FastAPI + LangChain / PostgreSQL / Redis", source: "user", point: "tech" },
  { id: "CON-002", kind: "CON", text: "LLM は Gemini Flash-Lite(無料枠)", source: "user", point: "tech" },
];

// 段階1の機能(ベースラインの F-01〜F-14 に、要件ID を手で当てたもの)
export const DEMO_FUNCTIONS: FunctionRow[] = [
  { id: "F-01", name: "新規ユーザー登録", reqIds: ["FR-001"] },
  { id: "F-02", name: "ログイン認証", reqIds: ["FR-001"] },
  { id: "F-03", name: "プロジェクト一覧取得", reqIds: ["FR-002"] },
  { id: "F-04", name: "プロジェクト新規作成", reqIds: ["FR-002"] },
  { id: "F-05", name: "参考資料アップロード", reqIds: ["FR-003"] },
  { id: "F-06", name: "チャット履歴取得", reqIds: ["FR-004"] },
  { id: "F-07", name: "ヒアリングチャットメッセージ送信", reqIds: ["FR-004"] },
  { id: "F-08", name: "構造化サマリ取得", reqIds: ["FR-005"] },
  { id: "F-09", name: "サマリ承認・生成トリガー", reqIds: ["FR-005"] },
  { id: "F-10", name: "進捗ステータス確認", reqIds: ["FR-005"] },
  { id: "F-11", name: "設計書の一覧・最新版取得", reqIds: ["FR-006"] },
  { id: "F-12", name: "版一覧取得", reqIds: ["FR-008"] },
  { id: "F-13", name: "追加修正による再生成", reqIds: ["FR-008"] },
  { id: "F-14", name: "自己診断結果取得", reqIds: ["FR-007"] },
  { id: "F-15", name: "管理者の利用統計", reqIds: [] },
];

export const DEMO_UNITS: UnitRow[] = [
  { id: "M-01-T02", functionIds: ["F-01"] },
  { id: "M-01-T03", functionIds: ["F-02"] },
  { id: "M-02-T01", functionIds: ["F-03"] },
  { id: "M-02-T02", functionIds: ["F-04"] },
  { id: "M-02-T03", functionIds: ["F-05"] },
  { id: "M-02-T04", functionIds: ["F-06"] },
  { id: "M-02-T05", functionIds: ["F-07"] },
  { id: "M-02-T06", functionIds: ["F-08"] },
  { id: "M-03-T01", functionIds: ["F-09"] },
  { id: "M-03-T02", functionIds: ["F-10"] },
  { id: "M-03-T03", functionIds: ["F-11"] },
  { id: "M-04-T01", functionIds: ["F-12"] },
  { id: "M-04-T02", functionIds: ["F-13"] },
  { id: "M-04-T03", functionIds: ["F-14"] },
];
