# Phase-63-1: ログインの印の cookie

## この章の目的

refresh cookie は API のオリジン(`path=/api/v1/auth`)にあり、アクセストークンはメモリ(Zustand)にしかない。そのため UI のサーバー側(Next.js の proxy)からはログインの状態が見えない。この章では、UI のオリジンに「ログインの印」の cookie を置き、ログインの状態が変わるところで付け外しする。印を読んで認証ページを飛ばす proxy は [63-2](./Phase-63-2.md) で作る。

自動実装モード: on([introduction](./Phase-63-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/lib/auth-flag.ts`](../samples/frontend/src/lib/auth-flag.ts) | 新規 | 印の名前 `LOGIN_FLAG_COOKIE`・`setLoginFlag()`・`clearLoginFlag()` |
| [`src/components/auth/auth-store.ts`](../samples/frontend/src/components/auth/auth-store.ts) | 更新 | `login()`・`refreshTokens()` の成功で付け、`logout()`・`refreshTokens()` の失敗で消す |
| [`src/components/auth/useLogout.ts`](../samples/frontend/src/components/auth/useLogout.ts) | 更新 | 読み込み直す前に印を消す |
| [`src/lib/__tests__/auth-flag.test.ts`](../samples/frontend/src/lib/__tests__/auth-flag.test.ts) | 新規 | 付く・消える・1つだけ |
| [`src/components/auth/__tests__/auth-store.test.ts`](../samples/frontend/src/components/auth/__tests__/auth-store.test.ts) | 更新 | ストアの4か所と、`apiFetch` の 401 で消える |
| [`src/components/auth/__tests__/useLogout.test.tsx`](../samples/frontend/src/components/auth/__tests__/useLogout.test.tsx) | 更新 | API の成功・失敗の両方で消える |

## 1. 印の cookie(`auth-flag.ts`)

責務: UI のオリジンに置く印の名前と、付け外しの関数。

```ts
// src/lib/auth-flag.ts
export const LOGIN_FLAG_COOKIE = "devex_logged_in";
const LOGIN_FLAG_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export function setLoginFlag(): void {
  if (typeof document === "undefined") return;
  document.cookie =
    `${LOGIN_FLAG_COOKIE}=1; Path=/; Max-Age=${LOGIN_FLAG_MAX_AGE_SECONDS}; SameSite=Lax` +
    secureAttribute();
}
```

- **値は意味を持たない印**(`1`)で、秘密を入れない。JS から付け外しするので httpOnly にはできないが、盗まれても何もできない。認証の判定には使わない(判定は今のまま API)。
- **寿命は refresh と同じ14日**(着手時の相談。[61-3](../Phase-61/Phase-61-3.md) の「7日」は誤り)。login・refresh のたびに付け直すので、使っている間は延びる(サイレントリフレッシュは約29分ごと)。セッション cookie にすると、ブラウザを閉じた後は refresh が残るのに印が消え、認証ページを飛ばせない。
- `Path=/`(proxy が `/login`・`/register` の要求で読めるように)・`SameSite=Lax`・https のときだけ `Secure`(dev は http)。
- proxy([63-2](./Phase-63-2.md))も `LOGIN_FLAG_COOKIE` を import するため、`"use client"` を付けない。`document` が無い(サーバーで読まれた)ときは何もしない。

## 2. 付け外しをストアに集める(`auth-store.ts`)

責務(変更点): トークンを持つ・失うところで印を付け外しする。

| 場所 | 印 |
|---|---|
| `login()`(ログインのフォーム) | 付ける |
| `refreshTokens()` の成功(起動時の復元・サイレントリフレッシュ・401 の後の再発行) | 付ける |
| `logout()`(`apiFetch` の 401 でリトライ後も失敗したとき) | 消す |
| `refreshTokens()` の失敗(cookie が無い・期限切れ) | 消す |

- **401 で消す場所**([61-3](../Phase-61/Phase-61-3.md) の未確定事項): 案は `client.ts` の refresh の失敗だった。`apiFetch` の 401 は、再発行に失敗すれば `refreshTokens()` の失敗、再発行の後も 401 なら `logout()` を通る。どちらもストアの中なので、**`client.ts` は変えずに**ストアの4か所だけで足りる。印の付け外しがトークンの出し入れと同じ場所にあれば、ずれない。
- 古い印(refresh が失効したのに印が残る)は、起動時の復元の失敗で消える。

## 3. ログアウトで消す(`useLogout.ts`)

```ts
// src/components/auth/useLogout.ts
await apiFetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
clearLoginFlag();
window.location.assign("/");
```

- [62-1](../Phase-62/Phase-62-1.md) のログアウトはストアの `logout()` を通らない(読み込み直しでメモリごと捨てる)ので、ここで消す。
- **読み込み直す前に消す**([Phase 62](../Phase-62/Phase-62-introduction.md) の申し送り「読み込み直す前に消すか、サーバーの応答で消すか」): 失効の API が失敗しても消してよい。refresh cookie が残っていれば、読み込み直した後の起動時の復元が成功して印が付き直す。サーバーの状態をそのまま映す、62-1 の方針と同じ形になる。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `auth-flag.test.ts`(新規) | `setLoginFlag`・`clearLoginFlag` | このテスト | スタブ不要 ── 書く先の `document.cookie` を jsdom がそのまま持ち、書いた結果を読んで確かめられるため |
| `auth-store.test.ts`(更新) | `useAuthStore`・`refreshTokens`・`apiFetch` | ストアの関数を直接呼ぶ | `fetch`(`stubFetch`) |
| `useLogout.test.tsx`(更新) | `useLogout` | `renderHook` | `fetch`(`stubFetch`)と `window.location` |

- ストアのテストは、4か所それぞれと、`apiFetch` の 401 → 再発行の失敗で印が消えること(セッション切れ)を確かめる。401 の経路は `client.ts` を変えていないことの番人。
- `useLogout` は、API が 204 でも 500 でも印が消えることを確かめる。
- 作成・更新したファイルは、この章のテストがすべて import する。import に前方 import は無い(`auth-flag.ts` は何も import しない。`auth-store.ts`・`useLogout.ts` → `auth-flag.ts` はこの章)。
