// 作成：Phase-118-1｜更新：Phase-118(完了後の調整2)
// 使い方の解説(GUIDE)のページの定義。流れの帯・前へ / 次へ・目次・TOP の機能カード・メニューが
// すべてこの1か所を使う(ページを足すときは、ここと app/(pages)/guide/<slug>/page.tsx の2か所)。

export type GuideSlug =
  | "getting-started"
  // Phase-118(完了後の調整2):追記
  | "modes"
  | "projects"
  | "hearing"
  | "documents"
  | "detailed-design"
  | "implementation"
  | "review"
  | "agreement"
  | "materials"
  | "for-clients"
  | "glossary";

export type GuidePage = {
  slug: GuideSlug;
  // ページの見出し
  title: string;
  // 流れの帯・流れ図に出す短い名前
  short: string;
  // 何ができるかの一言(目次のカード・metadata の description)
  summary: string;
  // 関係の深いページ(ページの下の「あわせて読む」)
  related: GuideSlug[];
};

export const GUIDE_PAGES: Record<GuideSlug, GuidePage> = {
  "getting-started": {
    slug: "getting-started",
    title: "はじめに",
    short: "はじめに",
    summary: "登録・ログインと、AI を使うための API キーの登録。費用とキーの扱い。",
    related: ["projects", "glossary"],
  },
  // Phase-118(完了後の調整2):追記
  modes: {
    slug: "modes",
    title: "2つのモードと作る文書",
    short: "モード",
    summary: "簡易ドキュメントモードと詳細設計モードの分かれ目、どちらでも作る文書・片方だけの文書と、その中身。選び方。",
    related: ["projects", "detailed-design", "agreement"],
  },
  projects: {
    slug: "projects",
    title: "プロジェクト",
    short: "プロジェクト",
    summary: "ダッシュボードでプロジェクトを作る・探す・消す。2つのモードの選び方。",
    related: ["getting-started", "hearing"],
  },
  hearing: {
    slug: "hearing",
    title: "ヒアリング",
    short: "ヒアリング",
    summary: "AI がチャットで質問し、要件を引き出す。聞いたこと・残りを観点の表で見る。",
    related: ["documents", "agreement"],
  },
  documents: {
    slug: "documents",
    title: "4文書の生成",
    short: "文書",
    summary: "要件定義書・外部設計書・内部設計書・実装計画書を作り、版の履歴から読み比べる。",
    related: ["hearing", "detailed-design"],
  },
  "detailed-design": {
    slug: "detailed-design",
    title: "詳細設計モード",
    short: "詳細設計",
    summary: "機能一覧から実装計画までを、段階ごとに AI の下書きを確かめて承認しながら組み立てる。",
    related: ["documents", "implementation"],
  },
  implementation: {
    slug: "implementation",
    title: "実装手順書と実装可能性チェック",
    short: "実装手順",
    summary: "作業単位ごとの実装手順書を作り、設計の不足・矛盾の指摘を受けて設計へ戻す。",
    related: ["detailed-design", "review"],
  },
  review: {
    slug: "review",
    title: "設計レビュー・テスト設計・変更の影響",
    short: "レビュー・影響",
    summary: "別の AI による設計レビュー、テスト観点と仕様書、直したときの影響と「古い」印。",
    related: ["implementation", "agreement"],
  },
  agreement: {
    slug: "agreement",
    title: "合意と変更管理",
    short: "合意と変更",
    summary: "合意済みの版を作り、変更要求(CR)で影響・説明・合意・反映・再検証までを一巡させる。",
    related: ["for-clients", "materials", "hearing"],
  },
  materials: {
    slug: "materials",
    title: "資料の取り込み",
    short: "資料",
    summary: "議事録・メールから合意と違う点を拾い、変更要求の下書きにする。",
    related: ["agreement"],
  },
  "for-clients": {
    slug: "for-clients",
    title: "クライアントの方へ",
    short: "クライアントの方へ",
    summary: "共有リンクで届いた変更のご相談を読み、コメント・案の選択・合意をする(ログイン不要)。",
    related: ["agreement", "glossary"],
  },
  glossary: {
    slug: "glossary",
    title: "用語集とよくある質問",
    short: "用語集",
    summary: "合意済みの版・変更要求などの言葉の意味と、費用・データの扱い・対応ファイル。",
    related: ["getting-started", "for-clients"],
  },
};

// 利用の流れの順。流れの帯と前へ / 次へはこの並びを使う
export const GUIDE_FLOW: GuideSlug[] = [
  "getting-started",
  // Phase-118(完了後の調整2):追記
  "modes",
  "projects",
  "hearing",
  "documents",
  "detailed-design",
  "implementation",
  "review",
  "agreement",
  "materials",
];

// 流れの外のページ。帯では流れの分岐元(なければ無し)を今の段として示す
export const GUIDE_BRANCH_FROM: Partial<Record<GuideSlug, GuideSlug>> = {
  "for-clients": "agreement",
};

export const GUIDE_INDEX_HREF = "/guide";

export function guideHref(slug: GuideSlug): string {
  return `${GUIDE_INDEX_HREF}/${slug}`;
}

// 流れの中の位置(1 始まり)。流れの外のページは分岐元の位置、分岐元も無ければ null
export function flowPosition(slug: GuideSlug): { index: number; total: number } | null {
  const own = GUIDE_FLOW.indexOf(slug);
  const from = GUIDE_BRANCH_FROM[slug];
  const at = own >= 0 ? own : from ? GUIDE_FLOW.indexOf(from) : -1;
  return at >= 0 ? { index: at + 1, total: GUIDE_FLOW.length } : null;
}

// 流れの順の前後のページ。流れの外のページは、分岐元を「前」にし、「次」は無い
export function prevNext(slug: GuideSlug): { prev: GuidePage | null; next: GuidePage | null } {
  const at = GUIDE_FLOW.indexOf(slug);
  if (at < 0) {
    const from = GUIDE_BRANCH_FROM[slug];
    return { prev: from ? GUIDE_PAGES[from] : null, next: null };
  }
  return {
    prev: at > 0 ? GUIDE_PAGES[GUIDE_FLOW[at - 1]] : null,
    next: at < GUIDE_FLOW.length - 1 ? GUIDE_PAGES[GUIDE_FLOW[at + 1]] : null,
  };
}

// Devex の全体の流れ(TOP と GUIDE の目次の流れ図)。各段は使い方のページへのリンク
export type ProductStep = { label: string; caption: string; slug: GuideSlug };

export const PRODUCT_FLOW: ProductStep[] = [
  { label: "ヒアリング", caption: "AI の質問に答えて要件を固める", slug: "hearing" },
  { label: "文書", caption: "要件定義書・外部設計書などを作る", slug: "documents" },
  { label: "詳細設計", caption: "段階ごとに確かめて承認する", slug: "detailed-design" },
  { label: "実装手順・テスト", caption: "作業単位の手順とテストを作る", slug: "implementation" },
  { label: "合意済みの版", caption: "クライアントと合意した内容を固定する", slug: "agreement" },
  { label: "変更要求", caption: "変えたい点と影響をまとめる", slug: "agreement" },
  { label: "クライアントと合意", caption: "共有リンクで説明し、合意を記録する", slug: "for-clients" },
  { label: "反映・再検証", caption: "設計へ反映し、影響した所を確かめ直す", slug: "agreement" },
];

// できること(TOP の機能カード)。各カードは使い方のページへ誘導する
export type GuideFeature = { title: string; summary: string; slug: GuideSlug };

export const GUIDE_FEATURES: GuideFeature[] = [
  {
    title: "ヒアリング",
    summary: "AI がチャットで質問し、要件を引き出します。聞いたこと・まだ聞いていないことを表で見られます。",
    slug: "hearing",
  },
  {
    title: "4文書の生成",
    summary: "要件定義書・外部設計書・内部設計書・実装計画書を一括で作ります。版の履歴から前の版にも戻せます。",
    slug: "documents",
  },
  {
    title: "詳細設計モード",
    summary: "機能一覧から実装計画までを、段階ごとに AI の下書きを確かめて承認しながら組み立てます。",
    slug: "detailed-design",
  },
  {
    title: "実装手順書・実装可能性チェック",
    summary: "作業単位ごとの手順書を作り、その過程で設計の不足・矛盾を指摘します。",
    slug: "implementation",
  },
  {
    title: "設計レビュー・テスト設計",
    summary: "生成とは別の AI が設計をレビューし、テスト観点とテスト仕様書を作ります。",
    slug: "review",
  },
  {
    title: "変更の影響",
    summary: "どこかを直すと、どこに効くかを示し、見直しが要る所に「古い」印を付けます。",
    slug: "review",
  },
  {
    title: "合意と変更管理",
    summary: "合意済みの版を作り、変更要求で影響・説明・合意・反映・再検証までを一巡させます。",
    slug: "agreement",
  },
  {
    title: "資料の取り込み",
    summary: "議事録やメールから合意と違う点を拾い、変更要求の下書きにします。",
    slug: "materials",
  },
];
