// 更新：Phase-3-1,3-2,3-3,3-4
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
  {
    label: "Form Parts",
    children: [
      { label: "カレンダー", href: "/form-parts/calendar" },
      { label: "インライン編集フィールド", href: "/form-parts/editable-text" },
      { label: "入力サジェスト", href: "/form-parts/suggest" },
      { label: "トークン入力", href: "/form-parts/token-input" },
      { label: "入力チェック", href: "/form-parts/validations" },
      // Phase-3-4:追記 ── ファイルアップロードの汎用コンポーネント化に伴うデモページ登録
      { label: "ファイルアップロード", href: "/form-parts/file-upload" },
    ],
  },
  {
    label: "Gallery",
    children: [
      { label: "カルーセル(スライダー)", href: "/gallery/carousel" },
      { label: "ギャラリー", href: "/gallery/gallery" },
    ],
  },
  {
    label: "Layout",
    children: [
      { label: "アコーディオン", href: "/layout/accordion" },
      { label: "カラムレイアウト", href: "/layout/columns" },
      { label: "フォームレイアウト", href: "/layout/form" },
      { label: "グリッドレイアウト", href: "/layout/grid" },
      { label: "ファーストビュー", href: "/layout/hero" },
      { label: "テーブルレイアウト", href: "/layout/table" },
      { label: "タブレイアウト", href: "/layout/tabs" },
    ],
  },
  {
    label: "Others",
    children: [
      { label: "カウント", href: "/others/count" },
      { label: "認証ガード", href: "/others/protected-demo" },
      { label: "サイズ・カラーサンプル", href: "/others/size-color-sample" },
      { label: "シャッフル", href: "/others/shuffle" }
    ],
  },
  {
    label: "Auth",
    children: [
      { label: "ユーザー登録", href: "/register" },
      { label: "ログイン", href: "/login" },
      { label: "ダッシュボード", href: "/dashboard" },
    ],
  },
];
