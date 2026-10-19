# Phase-62-1: ヘッダーのリンクとログアウトの処理

## この章の目的

ヘッダーの「Devex」は見出しの文字だけで、押してもトップページへ戻れなかった。ログアウトは、ストアの `logout()` と API の `POST /auth/logout` はあったが、押すボタンが無かった。この章では、タイトルをトップページへのリンクにし、メニューから呼ぶログアウトの処理(`useLogout`)を作る。ログアウトの項目そのものは [62-2](./Phase-62-2.md) のメニューで置く。

自動実装モード: on([introduction](./Phase-62-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/components/layout/Menu.module.css`](../samples/frontend/src/components/layout/Menu.module.css) | 更新 | `.titleLink`(タイトルのリンク。下線なし) |
| [`src/components/layout/Header.tsx`](../samples/frontend/src/components/layout/Header.tsx) | 更新 | タイトルを `next/link` の `href="/"` で包む |
| [`src/components/auth/useLogout.ts`](../samples/frontend/src/components/auth/useLogout.ts) | 新規 | 失効の API を呼んでから、トップページを読み込み直すフック |
| [`src/components/layout/__tests__/Header.test.tsx`](../samples/frontend/src/components/layout/__tests__/Header.test.tsx) | 新規 | タイトルのリンクの先 |
| [`src/components/auth/__tests__/useLogout.test.tsx`](../samples/frontend/src/components/auth/__tests__/useLogout.test.tsx) | 新規 | API を呼ぶ・読み込み直す・ストアを先に消さない |

`Header.tsx` と `Menu.module.css` はテンプレート由来で、これまで samples に無かった。触ったので samples に作った(冒頭は「更新」だけ。#29)。

## 1. タイトルのリンク(`Header.tsx`・`Menu.module.css`)

責務(`Header`): 固定のヘッダー(メニューの開閉・タイトル・テーマの切り替え)。

```tsx
// src/components/layout/Header.tsx
<H3 flexShrink={1} minWidth={0} fontSize="$7" $md={{ fontSize: "$9" }}>
  <Link href="/" className={styles.titleLink}>
    Devex
  </Link>
</H3>
```

- 見出し(`H3`)の大きさと太さはそのままにして、中身だけをリンクにした。`.titleLink` は `color: inherit`・下線なしで、見た目を変えない。
- CSS は既存の `Menu.module.css`(メニューのリンクの `.navLink` がある)に足した。ヘッダーのためだけに CSS のファイルを増やさないため。

## 2. ログアウトの処理(`useLogout.ts`)

責務: メニューの「ログアウト」で呼ぶ処理を返す。

```ts
// src/components/auth/useLogout.ts
export function useLogout(): () => Promise<void> {
  return useCallback(async () => {
    await apiFetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/");
  }, []);
}
```

- **ストアの `logout()` を使わない理由**: 計画では「`router.push("/")` してから `logout()`」の予定だった。ブラウザで確かめると、保護ページ(ダッシュボード)でログアウトしたとき、遷移が終わる前にストアのトークンが消えた。そのため `RequireAuth` が「ログインが必要です」のダイアログを一瞬出した。そこで、ストアには触れずに API で refresh トークンを失効させ、トップページを**読み込み直す**形に改めた。読み込み直せばメモリのトークンは消え、起動時の復元(`AuthBootstrap` → `refreshTokens()`)は失効した cookie では失敗して未ログインになる。
- 読み込み直すと、前の利用者のデータを持つ他のストア(ダッシュボードの 20秒の cache・ヒアリングの会話)もメモリから消える。SPA の遷移のままだと、これらは残る。
- **API を待ってから読み込み直す**: 待たずに読み込み直すと、失効の前に起動時の復元が走り、cookie でログインの状態に戻ってしまう。
- API の失敗はベストエフォート(今までのストアの `logout()` と同じ)。失敗しても読み込み直す。その場合はサーバーの cookie が残るので、復元でログインの状態に戻る。サーバーがログアウトしていないことを、そのまま画面に映す形になる。
- アクセストークンを失効させる仕組みは無い(最大30分は有効のまま。[`stage9-10-plan.md`](../../appendix/concept-history.md#stage9-10) 1.2節)。メモリから消えるので、実害は小さい。

## テスト観点

用語: SUT = テストする対象、ドライバ = SUT を呼ぶもの、スタブ = SUT が呼ぶ外部の代わり。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `Header.test.tsx`(新規) | `Header` | Testing Library の `render` | `@tamagui/next-theme`(テーマの切り替えボタンが読む。jsdom で `next/script` を解決できないため) |
| `useLogout.test.tsx`(新規) | `useLogout` | `renderHook` | `fetch`(`stubFetch`)と `window.location`(jsdom は画面の遷移を実装していないため `assign` を差し替える) |

- `useLogout` のテストは、API の URL・メソッド・`assign("/")` に加えて、**ストアのトークンが残ること**を確かめる。ストアを先に消すとダイアログが出る、という上の判断をテストに残すため。API が 500 でも読み込み直すことも確かめる。
- 作成・更新したファイルは、この章のテストがすべて import する(`Menu.module.css` は `Header.tsx` 経由)。import に前方 import は無い(`apiFetch` は既存)。
