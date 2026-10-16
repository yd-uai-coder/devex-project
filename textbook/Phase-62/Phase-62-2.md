# Phase-62-2: メニューの組み直しと出し分け

## この章の目的

メニューの木(`MENU_TREE`)は「Devex」の1グループに4項目(ダッシュボード・新規プロジェクト作成・ユーザー登録・ログイン)だった。この章では、木を TOP / CONTENTS / Authentication / Guide の4つに組み直し、Authentication をログインの状態で出し分ける(ログイン中はログアウトだけ、未ログインはログイン・ユーザー登録だけ)。ログアウトは遷移ではなく処理なので、項目の型に「処理の項目」を足す。同じ木を使う3か所(サイドメニュー・トップページ・404)は、項目を描く共通の部品(`MenuEntry`)に揃える。

自動実装モード: on([introduction](./Phase-62-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/lib/menu-tree.ts`](../samples/frontend/src/lib/menu-tree.ts) | 更新 | 項目の型(`MenuLink`・`MenuAction`)・4グループの木・`visibleMenuTree`・`menuItemKey` |
| [`src/components/layout/Menu.module.css`](../samples/frontend/src/components/layout/Menu.module.css) | 更新 | `.groupLink`(TOP)・`.navButton`(ログアウト) |
| [`src/components/layout/useMenuTree.ts`](../samples/frontend/src/components/layout/useMenuTree.ts) | 新規 | 今のログインの状態に合わせた木を返すフック |
| [`src/components/layout/MenuEntry.tsx`](../samples/frontend/src/components/layout/MenuEntry.tsx) | 新規 | 項目1つを描く部品(遷移はリンク、処理は button) |
| [`src/components/layout/HierarchicalMenu.tsx`](../samples/frontend/src/components/layout/HierarchicalMenu.tsx) | 更新 | 絞った木を描く。TOP はアコーディオンにしない |
| [`src/app/page.tsx`](../samples/frontend/src/app/page.tsx) | 更新 | トップページのカード。TOP を除く |
| [`src/components/errors/NotFoundContent.tsx`](../samples/frontend/src/components/errors/NotFoundContent.tsx) | 更新 | 404 の一覧。TOP は見出しをリンクに |
| [`src/lib/__tests__/menu-tree.test.ts`](../samples/frontend/src/lib/__tests__/menu-tree.test.ts) | 新規 | 木の並び・出し分け・key |
| [`src/components/layout/__tests__/Menu.test.tsx`](../samples/frontend/src/components/layout/__tests__/Menu.test.tsx) | 更新 | グループ・出し分け・ログアウト・復元中 |
| [`src/components/errors/__tests__/NotFoundContent.test.tsx`](../samples/frontend/src/components/errors/__tests__/NotFoundContent.test.tsx) | 新規 | TOP の見出しのリンク・出し分け |
| [`src/app/__tests__/page.test.tsx`](../samples/frontend/src/app/__tests__/page.test.tsx) | 新規 | TOP のカードを出さない |

本体のトップページは `src/app/(pages)/page.tsx`(samples は route group を省く)。`HierarchicalMenu.tsx`・`page.tsx`・`NotFoundContent.tsx` はテンプレート由来で、触ったので samples に作った。

## 1. 項目の型と木(`src/lib/menu-tree.ts`)

責務: メニューの木(共有データ)と、ログインの状態で絞る純粋関数。

```ts
// src/lib/menu-tree.ts
export type MenuLink = { kind: "link"; label: string; href: string; auth?: MenuAuth };
export type MenuAction = { kind: "action"; label: string; action: "logout"; auth?: MenuAuth };
export type MenuItem = MenuLink | MenuAction;
export type MenuGroup = { label: string; href?: string; children: MenuItem[] };
export type MenuAuth = "guest" | "user";

export const MENU_TREE: MenuGroup[] = [
  { label: "TOP", href: "/", children: [] },
  { label: "CONTENTS", children: [/* ダッシュボード・新規プロジェクト作成 */] },
  { label: "Authentication", children: [
      { kind: "link", label: "ログイン", href: "/login", auth: "guest" },
      { kind: "link", label: "ユーザー登録", href: "/register", auth: "guest" },
      { kind: "action", label: "ログアウト", action: "logout", auth: "user" },
  ] },
  { label: "Guide", children: [{ kind: "link", label: "作成予定", href: "/guide" }] },
];

export function visibleMenuTree(tree: MenuGroup[], auth: MenuAuth | null): MenuGroup[]
export function menuItemKey(item: MenuItem): string   // link は href、action は "action:<名前>"
```

- **遷移と処理の区別**(着手時の未確定事項): `kind` で分ける判別共用体にした。描画側は `kind` で分岐し、TypeScript が `href` の有無を確かめる。処理の中身(`useLogout`)は木に持たせない。木は純粋なデータのままにして、テストとトップページ・404 から同じように読めるようにするため。
- **出し分け**: 項目に `auth`(guest = 未ログインのときだけ、user = ログイン中だけ)を付け、`visibleMenuTree` が絞る。`auth` が `null`(状態の確認中)なら、`auth` を付けた項目をどちらも出さない。確認が終わったときに、ログイン・ユーザー登録がログアウトへ入れ替わって見えるのを避けるため。項目がすべて消えたグループは除く(Authentication が消える)。リンクのグループ(TOP)は残す。
- **TOP** は `href` を持ち、子を持たないグループにした。仕様の階層([外部設計書](../../docs/external_design.md) 2.12節)では TOP に子が無いため。
- **Guide** は仮のリンク `/guide`(ページは作らない。開くと 404)。
- **マイページ**は、画面を作る Phase 66 で CONTENTS に足す(着手時の決定)。それまでリンク切れの項目を置かないため。

## 2. ログインの状態(`useMenuTree.ts`)

責務: 今のログインの状態に合わせた木を返す。

```ts
// src/components/layout/useMenuTree.ts
export function useMenuTree(): MenuGroup[] {
  const mounted = useHasMounted();
  const accessToken = useAuthStore((s) => s.accessToken);
  const status = useAuthStore((s) => s.status);
  let auth: MenuAuth | null = null;
  if (mounted && status !== "loading") auth = accessToken ? "user" : "guest";
  return visibleMenuTree(MENU_TREE, auth);
}
```

- `RequireAuth` と同じ判断の仕方(マウント前と `status === "loading"` の間は決めない)にした。ストアの初期値は `loading` で、`AuthBootstrap` の復元が終わると `success` か `idle` になる。マウント前に決めないのは、SSR とハイドレーションの最初の描画を一致させるため(サーバーはログインの状態を知らない)。

## 3. 項目の部品(`MenuEntry.tsx`)

責務: 項目1つを描く。サイドメニュー・トップページ・404 で共有する。

```tsx
// src/components/layout/MenuEntry.tsx
export function MenuEntry({ item, fontSize, onSelect }: {
  item: MenuItem; fontSize: FontSizeTokens; onSelect?: () => void;
}) {
  const logout = useLogout();
  if (item.kind === "link") {
    return <Text fontSize={fontSize} color="$color11" onPress={onSelect}>
      <Link href={item.href} className={styles.navLink}>{item.label}</Link>
    </Text>;
  }
  return <Text fontSize={fontSize} color="$color11">
    <button type="button" className={styles.navButton}
      onClick={() => { onSelect?.(); void logout(); }}>{item.label}</button>
  </Text>;
}
```

- 処理の項目は素の `<button>` にした。Tamagui の `Text` に `role="button"` と `onPress` を付ける形では、キーボードの Enter で押せないため。見た目は `.navButton`(枠・背景を消し、下線を付ける)でリンクにそろえる。
- 3か所は文字の大きさだけが違う(`$4`・`$5`・`$3`)ので、`fontSize` を受ける。`onSelect` はサイドメニューが閉じるために使う。

## 4. 3つの消費者(`HierarchicalMenu.tsx`・`page.tsx`・`NotFoundContent.tsx`)

- **サイドメニュー**: `useMenuTree()` の木を描く。`href` のあるグループ(TOP)は、アコーディオンにせずにリンクの行(グループの見出しと同じ太さ。`.groupLink`)にする。開いているグループの初期値(今の URL を含むグループ)は、`kind === "link"` の項目だけを見る。
- **トップページ**: TOP のカードを出さない(自分へのリンクのため)。残り3枚は3列のグリッドにちょうど並ぶ。
- **404**: TOP は見出し(`H4`)をリンクにする。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `menu-tree.test.ts`(新規) | `MENU_TREE`・`visibleMenuTree`・`menuItemKey` | vitest | スタブ不要 ── 純粋なデータと関数で、外部を呼ばない |
| `Menu.test.tsx`(更新) | `Menu`(→ `HierarchicalMenu`・`MenuEntry`・`useMenuTree`) | Testing Library + `userEvent` | `next/navigation` の `usePathname`、`fetch`(`stubFetch`)、`window.location`(ログアウトの読み込み直し)。ログインの状態はストアに直接置く |
| `NotFoundContent.test.tsx`(新規) | `NotFoundContent` | `render` | スタブ不要 ── ログインの状態はストアに置くだけで、外部を呼ばない |
| `page.test.tsx`(トップページ・新規) | `Home` | `render` | スタブ不要(同上) |

- 出し分けの規則(復元中は出さない・空のグループを除く・リンクのグループは残す)は純粋関数のテストで確かめ、画面のテストでは「未ログイン・ログイン中・復元中」の3つの状態を1回ずつ通す。
- `Menu.test.tsx` のログアウトは、押すと API を呼び、`location.assign("/")` し、メニューを閉じることを確かめる。
- 作成・更新したファイルは、この章のテストがすべて import する(`menu-tree.ts` は直接、`useMenuTree`・`MenuEntry`・`HierarchicalMenu` は `Menu` 経由、`Menu.module.css` は `MenuEntry` 経由)。実 import 監査: `MenuEntry` → `useLogout`(62-1)、`useMenuTree` → `useHasMounted`・`useAuthStore`(既存)・`visibleMenuTree`(この章)。前方 import は無い。
