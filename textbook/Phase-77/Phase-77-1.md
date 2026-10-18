# Phase-77-1: パスワードの設定と出し分け

## この章の目的

Google だけで登録した人(パスワードを持たない人)のマイページを作る。`GET /users/me` の `has_password` を見て、パスワードの「変更」の代わりに「設定」(`POST /users/me/password`)を出し、今のパスワードが要るメールの変更は出さない。設定できたら、読み直さずにパスワードを持つ人の表示へ切り替える([外部設計書](../../docs/external_design.md) 2.13節「マイページ」)。

自動実装モード: on([introduction](./Phase-77-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/mypage/api/accountApi.ts`](../samples/frontend/src/features/mypage/api/accountApi.ts) | 更新 | `AccountRead` に `has_password`・`google_linked`。`setPassword(newPassword)` |
| [`src/features/mypage/schemas.ts`](../samples/frontend/src/features/mypage/schemas.ts) | 更新 | `passwordSetSchema`・`PasswordSetValues` |
| [`src/features/mypage/components/PasswordSetForm.tsx`](../samples/frontend/src/features/mypage/components/PasswordSetForm.tsx) | 新規 | パスワードの設定のフォーム(新しいパスワードと確認) |
| [`src/features/mypage/components/AccountSection.tsx`](../samples/frontend/src/features/mypage/components/AccountSection.tsx) | 更新 | `has_password` での出し分け |
| [`src/features/mypage/api/__tests__/accountApi.test.ts`](../samples/frontend/src/features/mypage/api/__tests__/accountApi.test.ts) | 更新 | `setPassword` のメソッド・パス・本文 |
| [`src/features/mypage/__tests__/schemas.test.ts`](../samples/frontend/src/features/mypage/__tests__/schemas.test.ts) | 更新 | `passwordSetSchema` の規則 |
| [`src/features/mypage/components/__tests__/PasswordSetForm.test.tsx`](../samples/frontend/src/features/mypage/components/__tests__/PasswordSetForm.test.tsx) | 新規 | 設定・断られたとき・確認の不一致 |
| [`src/features/mypage/components/__tests__/AccountSection.test.tsx`](../samples/frontend/src/features/mypage/components/__tests__/AccountSection.test.tsx) | 更新 | Google だけの人の出し分けと、設定の後の切り替え |
| [`src/features/mypage/components/__tests__/EmailForm.test.tsx`](../samples/frontend/src/features/mypage/components/__tests__/EmailForm.test.tsx) | 更新 | フィクスチャに2つの項目(型を合わせるだけ) |
| [`src/app/mypage/__tests__/page.test.tsx`](../samples/frontend/src/app/mypage/__tests__/page.test.tsx) | 更新 | 同上 |

## 1. 読む値と API

```ts
// src/features/mypage/api/accountApi.ts(抜粋)
export type AccountRead = {
  id: string; email: string; user_name: string | null;
  has_password: boolean;
  google_linked: boolean;
};

export function setPassword(newPassword: string): Promise<AccessTokenResponse> {
  return apiFetch<AccessTokenResponse>("/api/v1/users/me/password", { method: "POST", body: ... });
}
```

- **`has_password`・`google_linked`**: Phase 75 で `UserRead` に足した2つの真偽値。パスワードやGoogle の識別子そのものは返さない。
- **設定と変更は同じパスでメソッドが違う**: 変更は `PUT`(今のパスワードが要る)、設定は `POST`(要らない。パスワードを持つ人は 409 `PASSWORD_ALREADY_SET`)。応答はどちらも `AccessToken` で、ほかの端末のログインを切り、この端末には出し直す([75-1](../Phase-75/Phase-75-1.md))。

## 2. 設定のスキーマとフォーム

```ts
// src/features/mypage/schemas.ts(抜粋)
export const passwordSetSchema = z
  .object({ newPassword: newPasswordSchema("新しいパスワード"), confirmPassword: ... })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], ... });
```

- **変更のスキーマから今のパスワードを除いた形**: 新しいパスワードは登録と同じ規則(`newPasswordSchema`)、確認の欄との一致も同じ。
- **`PasswordSetForm` は `PasswordForm` と同じ形**: `FormGeneral` + `handleBeforeSubmit` の Promise。成功で `useAuthStore.getState().login(access_token)`(サイレントリフレッシュも張り直す)→ トースト「パスワードを設定しました」(ほかの端末のログインは切れました)→ `onPasswordSet()`。
- **エラーは API の文をそのまま**: 欄に結び付くエラー(今のパスワードの不一致など)が無いので、全部をフォームの下に出す。409 `PASSWORD_ALREADY_SET` は、ほかの端末で先に設定したときなど、画面の状態が古いときだけ来る。
- **説明の文**: 「Google でログインしています。パスワードを設定すると、メールアドレスとパスワードでもログインでき、メールアドレスの変更と Google との連携の解除ができるようになります。」── 設定すると何が増えるかを先に伝える。

## 3. 出し分け

```tsx
// src/features/mypage/components/AccountSection.tsx(抜粋)
{account.has_password ? (
  <>
    <EmailForm account={account} onUpdated={setAccount} />
    <PasswordForm />
  </>
) : (
  <PasswordSetForm onPasswordSet={() => setAccount({ ...account, has_password: true })} />
)}
```

- **メールの変更は出さない**: 今のパスワードで確かめる操作なので、パスワードが無いと使えない(API も 409 `PASSWORD_NOT_SET` で断る)。ユーザーネームは今までどおり出す。
- **読み直さずに切り替える**: 設定の成功で分かるのは `has_password` が true になったことだけなので、手元の値を書き換える。メールの変更が `onUpdated(返った値)` で手元を書き換えるのと同じ考え方。
- `GoogleLinkSection`(77-2)も同じ `account` を受け取る。設定の後は、連携の枠にも解除のボタンが出る。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `accountApi.test.ts`(更新) | `setPassword` | 各テスト | `stubFetch`(送ったメソッド・パス・本文を見る) |
| `schemas.test.ts`(更新) | `passwordSetSchema` | 各テスト(`safeParse`) | スタブ不要 ── スキーマは純粋で、外部の依存を呼ばないため |
| `PasswordSetForm.test.tsx`(新規) | `PasswordSetForm` | React Testing Library + userEvent | `stubFetch`・トーストの `vi.mock`。`useAuthStore` は本物(入れ直されることが検証の対象) |
| `AccountSection.test.tsx`(更新) | `AccountSection`(`PasswordSetForm` も通す) | React Testing Library + userEvent | `stubFetch`・トーストの `vi.mock` |

- API: `POST /api/v1/users/me/password` に `{new_password}`。
- スキーマ: 今のパスワードを求めない / 新しいパスワードに登録と同じ規則 / 確認の不一致は確認の欄のエラー。
- フォーム: 今のパスワードの欄が無い / 成功で access を入れ直し、トースト、`onPasswordSet` / 409 は API の文を出し、ストアと呼び出し側は変えない / 確認の不一致では API を呼ばない。
- 節: パスワードの無い人には設定を出し、変更とメールの変更を出さない / 設定の後、読み直さずに(リクエストは2件のまま)メールの変更・パスワードの変更・連携の解除(77-2)が出る。
- `EmailForm.test.tsx`・マイページの `page.test.tsx` は、フィクスチャに `has_password: true`・`google_linked: false` を足しただけ(テストの中身は変えない)。
- 作成・更新したファイルは、この章のテストが import する(`accountApi.ts`・`schemas.ts`・`PasswordSetForm.tsx`・`AccountSection.tsx`)。前方 import は無い(`AccountSection.tsx` の `GoogleLinkSection` の import は 77-2 で足した)。
