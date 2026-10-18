# Phase-77-2: 「Google の連携」の枠

## この章の目的

マイページのアカウントの節に「Google の連携」の枠を置く。連携していなければ Google のボタンで credential を受け、今のパスワードをダイアログで聞いてから `POST /users/me/google` で連携する。連携していれば、パスワードがあるときだけ、確認のダイアログの後に `DELETE /users/me/google` で解除する([外部設計書](../../docs/external_design.md) 2.13節「マイページ」)。ボタンとダイアログは Phase 76 の部品を使う。

自動実装モード: on([introduction](./Phase-77-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/mypage/api/accountApi.ts`](../samples/frontend/src/features/mypage/api/accountApi.ts) | 更新 | `linkGoogle(credential, currentPassword)`・`unlinkGoogle()` |
| [`src/features/auth/components/GoogleSignInButton.tsx`](../samples/frontend/src/features/auth/components/GoogleSignInButton.tsx) | 更新 | `GoogleButtonText` に `"continue_with"` |
| [`src/features/auth/components/GoogleLinkDialog.tsx`](../samples/frontend/src/features/auth/components/GoogleLinkDialog.tsx) | 更新 | 省略可能な `description`・`submitLabel`(既定はログインの文言) |
| [`src/features/mypage/components/GoogleLinkSection.tsx`](../samples/frontend/src/features/mypage/components/GoogleLinkSection.tsx) | 新規 | 連携・解除の出し分け、連携のダイアログ、解除の確認 |
| [`src/features/mypage/components/AccountSection.tsx`](../samples/frontend/src/features/mypage/components/AccountSection.tsx) | 更新 | 最後に `GoogleLinkSection` |
| [`src/features/mypage/api/__tests__/accountApi.test.ts`](../samples/frontend/src/features/mypage/api/__tests__/accountApi.test.ts) | 更新 | 2つの関数のメソッド・パス・本文 |
| [`src/features/auth/components/__tests__/GoogleSignInButton.test.tsx`](../samples/frontend/src/features/auth/components/__tests__/GoogleSignInButton.test.tsx) | 更新 | `continue_with` を渡せる |
| [`src/features/auth/components/__tests__/GoogleLinkDialog.test.tsx`](../samples/frontend/src/features/auth/components/__tests__/GoogleLinkDialog.test.tsx) | 更新 | 文言の差し替え |
| [`src/features/mypage/components/__tests__/GoogleLinkSection.test.tsx`](../samples/frontend/src/features/mypage/components/__tests__/GoogleLinkSection.test.tsx) | 新規 | 連携・不一致・衝突・キャンセル・解除・出し分け |
| [`src/features/mypage/components/__tests__/AccountSection.test.tsx`](../samples/frontend/src/features/mypage/components/__tests__/AccountSection.test.tsx) | 更新 | 枠が出る・設定の後に解除が出る |

## 1. API とボタンの文言

```ts
// src/features/mypage/api/accountApi.ts(抜粋)
export function linkGoogle(credential: string, currentPassword: string): Promise<AccountRead> { ... POST ... }
export function unlinkGoogle(): Promise<AccessTokenResponse> { ... DELETE ... }
```

- **応答の形が違う**: 連携は `UserRead`(トークンは変わらない)、解除は `AccessToken`(ほかの端末を切り、この端末に出し直す。[75-2](../Phase-75/Phase-75-2.md))。解除の後は access をストアに入れ直す。
- **`continue_with`**: Google のボタンの文言は「ログイン」「登録」のほかに「続行」がある。マイページは既にログインしているので、「Google でログイン」より「Google で続行」が合う。型に1つ足すだけで、部品の処理は変わらない。

## 2. ダイアログの共有

```tsx
// src/features/auth/components/GoogleLinkDialog.tsx(抜粋)
description = LOGIN_DESCRIPTION,
submitLabel = "連携してログイン",
...
<Dialog.Description>{description}</Dialog.Description>
<StyledButton aria-label={submitLabel} ...>{submitLabel}</StyledButton>
```

- **コピーせず共有する(#17)**: ログインの連携とマイページの連携は「credential を持ったまま、パスワードで本人を確かめる」同じ形。今これを駆動する消費者は `GoogleLinkSection`。違うのは文とボタンの文言だけなので、省略可能な2つの props にした。既定値は 76 の文言で、ログインの画面は何も変えない。
- **欄のラベルは変えない**: 「このアカウントのパスワード」はマイページでも意味が通る。マイページの「今のパスワード」の欄(メール・パスワードの変更)と `getByLabel` で重ならない利点も、76 と同じく残る。

## 3. 連携の枠

```tsx
// src/features/mypage/components/GoogleLinkSection.tsx(抜粋)
{account.google_linked ? (
  account.has_password ? <StyledButton theme="red" onPress={() => setConfirmingUnlink(true)}>連携を解除する</StyledButton>
                       : <Text>パスワードを設定すると、連携を解除できます。</Text>
) : googleAvailable ? (
  <GoogleSignInButton text="continue_with" onCredential={handleCredential} onError={...} />
) : (
  <Text>この環境では Google との連携を使えません。</Text>
)}
<GoogleLinkDialog key={pendingCredential ?? "closed"} open={pendingCredential !== null} ... />
<ConfirmDialog open={confirmingUnlink} title="Google との連携を解除しますか" ... />
```

- **置き場はアカウントの節の中**(ユーザー決定): ログインの手段はアカウントの事柄で、解除を出すかがパスワードの有無で決まる。`AccountSection` が持つ1つの `account` を、パスワードのフォームと連携の枠で共有する。見た目は `FormGeneral` の枠(線・角丸・余白)に合わせた。
- **ボタンの後にパスワードを聞く**(ユーザー決定): Google の描くボタンは押せない状態にできない。先にパスワードの欄を置くと、空のまま押されうる。ログインの連携(76-2)と同じ順にした。
- **エラーの出し分け**: 400 `CURRENT_PASSWORD_MISMATCH` はダイアログの中に「今のパスワードが正しくありません」(打ち直せば済む)。409 `GOOGLE_ACCOUNT_CONFLICT`・400 `GOOGLE_EMAIL_NOT_VERIFIED`・502・503 などは、打ち直しても変わらないので、ダイアログを閉じて枠に API の `detail` を出す。ポップアップの失敗は 76-2 と同じ「Google でのログインを完了できませんでした」。
- **ダイアログを credential ごとに作り直す(`key`)**: `GoogleLinkDialog` はキャンセルのときだけ入力を消す(76-2)。ログインの画面は成功すれば画面を移るので困らないが、マイページは同じ画面に残る。衝突で閉じた後に Google を押し直すと、前のパスワードが入ったままになる(偽のモードの手動確認で気づいた)。`key` を credential にすると、開くたびに作り直され、入力が残らない。開いたときに消す `useEffect` は、76-2 と同じく ESLint に当たるので使わない。
- **解除の確認**(ユーザー決定): 既存の [`ConfirmDialog`](../samples/frontend/src/components/ui/layout-blocks/ConfirmDialog.tsx) で「解除すると、ほかの端末ではログインし直しになります。この後は、メールアドレスとパスワードでログインします。」と伝える。成功で access を入れ直し、トースト(ほかの端末のログインは切れました。パスワードの変更と同じ文)、`onUpdated({...account, google_linked: false})`。
- **パスワードが無い人に解除を出さない**: どちらでもログインできなくなるのを防ぐ(API も 409 `PASSWORD_NOT_SET`)。代わりに、設定すれば解除できると伝える(設定のフォームは同じ節の上にある)。
- **クライアント ID が無い環境**: ボタンの部品は何も出さないので、ボタンの代わりに文で伝える。連携済みの人の解除は、ID が無くても出す(解除は Google を呼ばない)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `accountApi.test.ts`(更新) | `linkGoogle`・`unlinkGoogle` | 各テスト | `stubFetch` |
| `GoogleSignInButton.test.tsx`(更新) | `GoogleSignInButton` | React Testing Library | `@react-oauth/google` の mock(渡した `text` を見る)・`vi.stubEnv` |
| `GoogleLinkDialog.test.tsx`(更新) | `GoogleLinkDialog` | React Testing Library + userEvent | スタブ不要 ── 入力と props の呼び出しだけで、外部依存を呼ばないため |
| `GoogleLinkSection.test.tsx`(新規) | `GoogleLinkSection` | React Testing Library + userEvent | `stubFetch`・トーストの `vi.mock`・`vi.stubEnv` で偽のモード(本物のボタンは外部のスクリプトが要るため)。`useAuthStore` は本物(解除で入れ直されることが検証の対象) |
| `AccountSection.test.tsx`(更新) | `AccountSection`(`GoogleLinkSection` も通す) | React Testing Library + userEvent | `stubFetch`・トーストの `vi.mock` |

- API: `POST /api/v1/users/me/google` に `{credential, current_password}` / `DELETE /api/v1/users/me/google`(本文なし)。
- ボタン: `continue_with` がそのまま Google の部品に渡る。
- ダイアログ: 文とボタンの文言を差し替えると、既定の「連携してログイン」は出ず、差し替えたボタンで `onSubmit`。
- 枠: credential を受けるとダイアログ → 偽の credential と今のパスワードを送り、`onUpdated` とトースト / 不一致はダイアログの中に出し、開いたまま / 衝突はダイアログを閉じて枠に出し、開き直すとパスワードが空 / キャンセルで送らない / 解除は確認の前には送らず、確認で `DELETE`・access の入れ直し・`onUpdated`・トースト / パスワードの無い人に解除を出さない / ID が無く偽でもなければ文で伝える。
- タイムアウト: 文字の入力とダイアログの開閉が続くので、`GoogleLinkSection` の describe に `{ timeout: 20000 }`(76-2 の `GoogleLoginSection` と同じ扱い)。
- 作成・更新したファイルは、この章のテストが import する(`accountApi.ts`・`GoogleSignInButton.tsx`・`GoogleLinkDialog.tsx`・`GoogleLinkSection.tsx`・`AccountSection.tsx`)。前方 import は無い。
