// 更新：Phase-3-1,3-2,3-3,3-4,24(完了後の調整)
export type MenuLeaf = { label: string; href: string };
export type MenuGroup = { label: string; children: MenuLeaf[] };

// (pages)/(sample)配下の実際のディレクトリ階層(data/form-parts/gallery/layout/others)を
// そのまま反映している。ラベルは各ページのBreadcrumb pageTitleに合わせており、
// pageTitleを持たないページ(token-input, layout/accordion)はここで表示用ラベルを
// 補っている(該当ページ自体は変更していない)。HierarchicalMenu(サイドメニュー)・
// トップページ(リンクカード)・404ページ(リンクカラム)の3箇所から参照される共有データ。
export const MENU_TREE: MenuGroup[] = [
  {
    label: "Data",
    children: [
      { label: "チャート", href: "/data/chart" },
      { label: "拡張チャート", href: "/data/advanced-charts" },
      { label: "データ絞り込み・並び替え", href: "/data/data-filter-sort" },
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
];
