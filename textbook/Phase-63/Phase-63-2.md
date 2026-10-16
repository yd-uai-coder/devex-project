# Phase-63-2: 認証ページの proxy

## この章の目的

ログイン済みで `/login`・`/register` を開くと、フォームがそのまま出ていた。この章では、Next.js 16 の proxy(`src/proxy.ts`。`middleware.ts` から改名)で [63-1](./Phase-63-1.md) の印を読み、ログイン済みなら画面を出さずにダッシュボード(戻り先があればその先)へ送る。戻り先を確かめる規則は、ログインした後の遷移(`LoginForm`)と共有する。

自動実装モード: on([introduction](./Phase-63-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/lib/redirect-path.ts`](../samples/frontend/src/lib/redirect-path.ts) | 新規 | `safeRedirectPath`(同じオリジンの相対パスだけを通す) |
| [`src/proxy.ts`](../samples/frontend/src/proxy.ts) | 新規 | 印があれば `/login`・`/register` から送る |
| [`src/features/auth/components/LoginForm.tsx`](../samples/frontend/src/features/auth/components/LoginForm.tsx) | 更新 | ログインの後の戻り先を `safeRedirectPath` で確かめる |
| [`src/lib/__tests__/redirect-path.test.ts`](../samples/frontend/src/lib/__tests__/redirect-path.test.ts) | 新規 | 通すもの・断るもの |
| [`src/__tests__/proxy.test.ts`](../samples/frontend/src/__tests__/proxy.test.ts) | 新規 | matcher の対象・印の有無・戻り先 |
| [`src/features/auth/components/__tests__/LoginForm.test.tsx`](../samples/frontend/src/features/auth/components/__tests__/LoginForm.test.tsx) | 更新 | `//evil.example.com` → `/dashboard` |

## 1. 戻り先の確かめ(`redirect-path.ts`)

責務: `?redirect=` の値が同じオリジンの相対パスなら返し、そうでなければ `null`。

```ts
// src/lib/redirect-path.ts
export function safeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}
```

- 戻り先を尊重するのは着手時の相談の決定(推奨どおり)。ログイン必須ダイアログは `/login?redirect=<今のパス>` へ案内するので、印があればその先へ戻すのが、ログインした後の遷移と揃う。
- **`LoginForm` も同じ関数に置き換えた**(#17。proxy という実在の消費者が同じ規則を要する)。前の `startsWith("/")` だけの判定は、`//evil.example.com` を通していた。ブラウザはこれを別のオリジンと読む(開いたリダイレクト)。`/\` で始まるものも、ブラウザが `\` を `/` と読むので断る。

## 2. proxy(`proxy.ts`)

責務: ログイン済み(印がある)で認証ページを開いたら、画面を出さずに送る。

```ts
// src/proxy.ts
export function proxy(request: NextRequest) {
  if (!request.cookies.get(LOGIN_FLAG_COOKIE)?.value) return NextResponse.next();

  const target = safeRedirectPath(request.nextUrl.searchParams.get("redirect")) ?? DEFAULT_AFTER_LOGIN;
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  matcher: ["/login", "/register"],
};
```

- **`matcher` は2つのパスだけ**([61-3](../Phase-61/Phase-61-3.md) の未確定事項)。matcher が無いと、proxy は静的ファイル(`_next/static`)を含むすべての要求で動く。対象を絞れば、他の画面の表示に何も足さない。
- 印は推し量るだけの楽観的な確認(Next.js の文書の「optimistic checks」)。**古い印**のときは、送り先の保護ページで `RequireAuth` がログイン必須ダイアログを出し、起動時の復元の失敗で印が消える(63-1)。次に `/login` を開けば、フォームが出る。1回だけ遠回りするが、閉じ込められない。
- 送るときに出すメッセージは無い(外部設計書 2.12節)。
- proxy は既定で Node.js のランタイムで動く(`runtime` の設定は置けない)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `redirect-path.test.ts`(新規) | `safeRedirectPath` | このテスト | スタブ不要 ── 純粋関数で外部依存を呼ばないため |
| `proxy.test.ts`(新規) | `proxy` と `config.matcher` | `new NextRequest(...)` と `next/experimental/testing/server` | スタブ不要 ── proxy は要求の cookie と URL だけを読み、外部を呼ばないため |
| `LoginForm.test.tsx`(更新) | `LoginForm` | Testing Library | `fetch`(`stubFetch`)と `next/navigation`(既存) |

- `proxy.test.ts` は jsdom でなく Node の環境で動かす(先頭の `// @vitest-environment node`)。`NextRequest` は Node の `Request` を使うため。
- matcher は `unstable_doesMiddlewareMatch` で確かめる(`/login`・`/register` は一致、`/`・`/dashboard`・`/projects/3`・`/login/extra`・`/_next/static/…` は不一致)。同梱の文書は `unstable_doesProxyMatch` と書くが、16.3.6 が公開しているのは旧名だけだった(作業中に分かった)。
- 送り先は `getRedirectUrl`(応答の `location`)で確かめる: 印なし → 通す / 印あり → `/dashboard` / 戻り先が相対パス → その先 / `//evil.example.com` → `/dashboard` / 値が空の印 → 通す。
- 作成・更新したファイルは、この章のテストがすべて import する。import に前方 import は無い(`proxy.ts` → `auth-flag.ts`(63-1)・`redirect-path.ts`(この章)。`LoginForm.tsx` → `redirect-path.ts`)。
