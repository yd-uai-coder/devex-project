// 更新：Phase-3-1,3-2,3-3,3-4,24(完了後の調整),24(T2同期),25-2,33-3,40(完了後の調整),41-3,50-3,51-3,60-3,62-2,66-3
// Phase-62-2：更新
// export type MenuLeaf = { label: string; href: string };
// export type MenuGroup = { label: string; children: MenuLeaf[] };
// ↓↓
// 遷移する項目。auth を付けた項目はログインの状態で出し分ける
// (guest = 未ログインのときだけ、user = ログイン中だけ)。
export type MenuLink = { kind: "link"; label: string; href: string; auth?: MenuAuth };
// 遷移でなく処理をする項目(ログアウト)。処理の中身は描画側(MenuEntry)が持つ。
export type MenuAction = { kind: "action"; label: string; action: "logout"; auth?: MenuAuth };
export type MenuItem = MenuLink | MenuAction;
// href を持つグループは、それ自体がリンク(子を持たない TOP)。
export type MenuGroup = { label: string; href?: string; children: MenuItem[] };

export type MenuAuth = "guest" | "user";

// Phase-24(T2同期)：更新(テンプレートのデモページの一覧を、Devex の実ページの一覧に置き換えた)
// // (pages)/(sample)配下の実際のディレクトリ階層(data/form-parts/gallery/layout/others)を
// // そのまま反映している。ラベルは各ページのBreadcrumb pageTitleに合わせており、
// // pageTitleを持たないページ(token-input, layout/accordion)はここで表示用ラベルを
// // 補っている(該当ページ自体は変更していない)。HierarchicalMenu(サイドメニュー)・
// // トップページ(リンクカード)・404ページ(リンクカラム)の3箇所から参照される共有データ。
// export const MENU_TREE: MenuGroup[] = [
//   {
//     label: "Data",
//     children: [
//       { label: "チャート", href: "/data/chart" },
//       { label: "拡張チャート", href: "/data/advanced-charts" },
//       { label: "データ絞り込み・並び替え", href: "/data/data-filter-sort" },
//     ],
//   },
// ↓↓
// Devexの実ページ構成を反映する。HierarchicalMenu(サイドメニュー)・トップページ
// (リンクカード)・404ページ(リンクカラム)の3箇所から参照される共有データ。
// `/projects/[id]/chat`・`/projects/[id]/documents`は動的ルート(プロジェクトIDが
// 必須)のためここには含めない ── ダッシュボードのプロジェクト一覧から遷移する。
export const MENU_TREE: MenuGroup[] = [
  // Phase-62-2:追記
  { label: "TOP", href: "/", children: [] },
  {
    // Phase-62-2：更新
    // label: "Devex",
    // ↓↓
    label: "CONTENTS",
    children: [
      // Phase-62-2：更新
      // { label: "ダッシュボード", href: "/dashboard" },
      // { label: "新規プロジェクト作成", href: "/projects/new" },
      // { label: "ユーザー登録", href: "/register" },
      // { label: "ログイン", href: "/login" },
      // ↓↓
      { kind: "link", label: "ダッシュボード", href: "/dashboard" },
      // mode なしで開くと、作成画面がモード選択ダイアログを出す
      { kind: "link", label: "新規プロジェクト作成", href: "/projects/new" },
      // Phase-66-3:追記
      { kind: "link", label: "マイページ", href: "/mypage" },
    ],
  },
  // Phase-24：削除
  // {
  //   label: "開発用",
  //   children: [
  //     // バックエンド無しで UML 画面の挙動を確かめるデモ(Phase 11 時点)
  //     { label: "UML設計図デモ", href: "/uml-demo" },
  //     // 詳細設計モードの 05・06 章の見せ方の提案(仮データ)
  //     { label: "詳細設計 05・06章デモ", href: "/detailed-design-demo" },
  //   ],
  // },
  // Phase-50-3：削除(デモのページ /change-impact-demo は残す。URL を直接開けば見られる)
  // {
  //   label: "開発用",
  //   children: [
  //     // 変更の影響範囲の見せ方の提案(仮データ)
  //     { label: "変更の影響デモ", href: "/change-impact-demo" },
  //   ],
  // },
  // Phase-60-3：削除(デモのページ /design-review-demo は残す。URL を直接開けば見られる)
  // {
  //   label: "開発用",
  //   children: [
  //     // AI 設計レビューの見せ方の提案(仮データ)
  //     { label: "AI 設計レビューデモ", href: "/design-review-demo" },
  //   ],
  // },
  // Phase-62-2:追記
  {
    label: "Authentication",
    children: [
      { kind: "link", label: "ログイン", href: "/login", auth: "guest" },
      { kind: "link", label: "ユーザー登録", href: "/register", auth: "guest" },
      { kind: "action", label: "ログアウト", action: "logout", auth: "user" },
    ],
  },
  {
    label: "Guide",
    // 仮のリンク(ページはまだ無く、開くと 404)
    children: [{ kind: "link", label: "作成予定", href: "/guide" }],
  },
];

// Phase-62-2:追記
// ログインの状態に合う項目だけを残す。auth が null(状態の確認中)のときは、
// auth を付けた項目をどちらも出さない(確認が終わったときに入れ替わって見えるのを避ける)。
// 項目がすべて消えたグループは除く(リンクのグループは残す)。
export function visibleMenuTree(tree: MenuGroup[], auth: MenuAuth | null): MenuGroup[] {
  return tree
    .map((group) => ({
      ...group,
      children: group.children.filter((item) => item.auth === undefined || item.auth === auth),
    }))
    .filter((group) => group.href !== undefined || group.children.length > 0);
}

// 項目の React の key(link は href、action は処理の名前)
export function menuItemKey(item: MenuItem): string {
  return item.kind === "link" ? item.href : `action:${item.action}`;
}
