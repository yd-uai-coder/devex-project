// 作成：Phase-118-2
// TOP ページの文言(何が・なぜ)。手順は書かず、使い方は GUIDE のページへ誘導する。
// 内容の正本は devex-project の README(概要・課題・機能)と docs/external_design.md。
import type { GuideSlug } from "@/features/guide/guide-flow";

export const TOP_CATCH = "クライアントとの合意を、設計から実装・テストまでつなぐ。";

export const TOP_LEAD = [
  "Devex は、AI との対話で要件を引き出し、要件定義から設計・実装手順・テストまでを、ID でつながった設計情報として組み立てるアプリです。",
  "作った設計は「合意済みの版」として固定し、仕様を変えたいときは変更要求として影響・説明・クライアントとの合意・反映・再検証までを一巡させます。",
];

// こんな悩みに(よくある課題 → Devex の解決)
export const TOP_PROBLEMS: { problem: string; solution: string }[] = [
  {
    problem: "AI に設計書を書かせても、文書が増えるだけで中身がつながらない",
    solution: "設計の各段階をデータとして持ち、要件 → 画面・処理 → 作業単位 → テストを ID でつなぎます。",
  },
  {
    problem: "ヒアリングで非機能要件やセキュリティを聞き漏れ、設計の後で要件が変わる",
    solution: "観点の表で、何を聞いたか・何が残っているかを記録します。選択肢のカードで答えやすくします。",
  },
  {
    problem: "設計を直すと、どこに影響するか分からない",
    solution: "つながりから影響の範囲を示し、見直しが要る所に「古い」印を付けます。",
  },
  {
    problem: "書かれた設計が実装できるか、作るまで分からない",
    solution: "作業単位ごとの実装手順書を作り、その過程で設計の不足・矛盾を指摘します。生成とは別の AI が設計をレビューします。",
  },
];

// 2つのモードの比較(作成時に選び、後から変えられない)
export const TOP_MODES: { label: string; simple: string; detailed: string }[] = [
  {
    label: "向いている人",
    simple: "まず設計書一式がほしい人。小さめのアプリ・試作",
    detailed: "設計を段階ごとに確かめたい人。クライアントと仕様を合意しながら進める開発",
  },
  {
    label: "作れるもの",
    simple: "要件定義書・外部設計書・内部設計書・実装計画書、テスト仕様書、実装手順書",
    detailed: "要件定義書・外部設計書と、機能一覧 → データフロー → データモデル → ソフトウェア構造 → 処理の手順 → 実装計画 → 実装手順書、詳細設計書(zip)",
  },
  {
    label: "使える機能",
    simple: "ヒアリング・4文書・テスト仕様書・実装手順書と実装可能性チェック・設計レビュー・変更の影響",
    detailed: "左に加えて、段階ごとの承認、UML の編集、合意と変更管理(合意済みの版・変更要求・共有リンク)、確認事項、資料の取り込み",
  },
];

// はじめるまで4ステップ
export const TOP_STEPS: { title: string; body: string }[] = [
  { title: "登録する", body: "メールアドレスか Google アカウントで登録します。" },
  {
    title: "AI を選ぶ(任意)",
    body: "登録しなくても既定の Gemini で試せます。Claude や設計レビューを使うときは、マイページで自分の API キーを登録します。",
  },
  { title: "プロジェクトを作る", body: "ダッシュボードで、簡易ドキュメントか詳細設計のモードを選んで作ります。" },
  { title: "ヒアリングに答える", body: "作りたいものを短く書いて送ると、AI が質問を始めます。" },
];

// 大切にしていること・やらないこと
export const TOP_PRINCIPLES = [
  "AI は下書きと指摘をし、決めるのは人です。各段階の承認・変更の合意は人が行います。",
  "なぜそう決めたかを残します。ヒアリングの根拠・合意の記録・変更の背景を、後からたどれます。",
  "推測で埋めた所は「推測」と示し、確認事項として残します。",
];

export const TOP_NOT_DOING = [
  "コードを完全に自動で書くこと(作るのは、人が実装するための設計と手順です)",
  "プロジェクト管理ツール(課題管理・進捗管理)の置き換え",
];

export const TOP_REPOSITORIES: { name: string; href: string; description: string }[] = [
  {
    name: "devex-project",
    href: "https://github.com/yd-uai-coder/devex-project",
    description: "仕様・開発の記録",
  },
  { name: "devex-api", href: "https://github.com/yd-uai-coder/devex-api", description: "バックエンド" },
  { name: "devex-ui", href: "https://github.com/yd-uai-coder/devex-ui", description: "フロントエンド" },
];

export const TOP_TECH_STACK =
  "Next.js・Tamagui / FastAPI・LangChain(Gemini・Claude)・PostgreSQL・Redis";

export const TOP_GETTING_STARTED: GuideSlug = "getting-started";
