# Phase-79-2: Google の流れの E2E と全 E2E の実行

## この章の目的

ステージ10の Google でのログイン・登録・連携を、ブラウザで通しで確かめる spec を1本足し、既存を含めた全 E2E を流す(#36)。Phase 76・77 では偽のボタンを使った手動確認(その場の Playwright のスクリプト)だけで、spec にしていなかった。ログインの画面の3つの流れと、Phase 77 の手動確認の9項目を spec にした。

自動実装モード: on([introduction](./Phase-79-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`e2e/helpers.ts`](../samples/frontend/e2e/helpers.ts) | 更新 | `PASSWORD`・`uniqueEmail` を export する(新しい spec が同じパスワードとメールの作り方を使う) |
| [`e2e/google-auth-flow.spec.ts`](../samples/frontend/e2e/google-auth-flow.spec.ts) | 新規 | 偽のボタンで、初めての Google・連携の確かめ・マイページの設定と解除・連携と衝突を通す(4つのテスト) |

## 要点の抜粋

```ts
// e2e/google-auth-flow.spec.ts
async function continueWithFakeGoogle(page: Page, email: string) {
  await page.getByLabel("偽の Google アカウント(E2E)").fill(email);
  await page.getByRole("button", { name: "Google で続ける(E2E)" }).click();
}

// cookie(refresh とログインの印)を消して開き直す。アクセストークンはメモリにだけあるので、これでログアウトになる
async function signOut(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "ログイン", exact: true })).toBeVisible();
}
```

```ts
// e2e/google-auth-flow.spec.ts(連携の確かめ)
await continueWithFakeGoogle(page, email);
const dialog = page.getByRole("dialog");
await expect(dialog.getByRole("heading", { name: "Google アカウントと連携" })).toBeVisible();
await dialog.getByLabel("このアカウントのパスワード").fill(WRONG_PASSWORD);
await dialog.getByRole("button", { name: "連携してログイン" }).click();
await expect(dialog.getByText("メールアドレスまたはパスワードが正しくありません。")).toBeVisible();
```

4つのテスト:

| テスト | 確かめること |
|---|---|
| 初めての Google | そのまま登録して `/dashboard` へ。リロードしてもログインが続く |
| 連携の確かめ | パスワードで登録済みのメールの Google → ダイアログ → 違うパスワードで日本語の文([79-1](./Phase-79-1.md))→ 正しいパスワードで入る / 連携の後もメールとパスワードで入れる / 2回目の Google はダイアログなし / メールのログインの違うパスワードも日本語の文 |
| Google だけの人(マイページ) | 設定のフォームだけが出て、メールの変更と解除は出ない → 設定するとメールの変更・パスワードの変更・解除が出る → リロードしてもログインが続く → 確認のダイアログの後に解除 → 解除の後もログインが続く |
| パスワードの人(マイページ) | ほかの人と連携済みの Google は、ダイアログを閉じて枠に理由 / パスワードが違えばダイアログの中に理由 / メールの違う Google と連携できる / その Google でログインすると、この人のアカウント(ユーザーネームで確かめる)に入る |

- **ログアウトの仕方**: メニューからのログアウトは [`stage9-flow.spec.ts`](../samples/frontend/e2e/stage9-flow.spec.ts) で確かめてあるので、ここでは cookie を消して開き直す(4つのテストで何度もログアウトするので、短い手順にした)。
- **ほかの人の Google**: 衝突の相手は、API(`POST /api/v1/auth/google`)を Playwright の `request` から直接呼んで作る(画面で作ると、ログアウトの手順が1回増える)。
- **知らせは文で取る**: ページに Next.js のルートの読み上げの空の `role="alert"` があるので、`getByRole("alert")` は使わない(Phase 76 からの申し送り)。
- **作業中に直したもの**(spec の側の誤り。本体は変えていない): ダイアログの見出しを `getByText("Google アカウントと連携")` で取ると、説明の文(「…Google アカウントと連携します。」)にも部分一致して2つに当たった。見出しの役割で取るようにした。

## 流し方

- `playwright.config.ts` は、backend(`docker-compose.yml` + `docker-compose.e2e.yml`)と UI(`NEXT_PUBLIC_E2E_FAKE_GOOGLE=true` の `npm run dev`)を立てる。手元で 3000 番・8000 番が動いていると `reuseExistingServer` でそれが使われ、偽のボタンにならない(Phase 76 の申し送り)。
- この Phase では、ユーザーの `npm run dev`(3000 番)と通常の backend が動いていたので、Phase 77 と同じく止めずに流した: backend を E2E のオーバーレイと、CORS に 3100 番を足す一時的な上書き(ジョブの作業用のディレクトリ)で立て直し、`NEXT_PUBLIC_E2E_FAKE_GOOGLE=true` でビルドした画面を 3100 番で開き、`baseURL` だけを 3100 番にした一時的な設定(流した後に消した)で全 spec を流した。流した後、backend を通常の compose に戻し、通常のビルドを作り直した。

## 結果

- 新しい spec: 1回目は 4件中 1件失敗(上の見出しの取り方)、直して **4件成功**。
- 全 E2E: **9件成功**(既存5 + 新4。2.3分)。続けてもう1回流して **9件成功**(Phase 74 の dev の上限の引き上げで、同じ1時間に続けて流しても登録・ログインの上限に当たらない)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `google-auth-flow.spec.ts` の4件 | devex-ui の画面(ログイン・登録・マイページ)+ devex-api(`/auth/google`・`/auth/google/link`・`/users/me/password`・`/users/me/google`) | Playwright(ブラウザ) | Google の ID トークンの検証だけを偽物にする(`E2E_FAKE_GOOGLE`。`fake:<sub>:<email>` を受け付ける)。本物の Google は E2E から呼べない(ポップアップと Google のアカウントが要る)ため。それ以外(DB・Redis・トークン・cookie)は本物 |

- この章が作成・更新したファイルは、spec が import する(`helpers.ts` の `PASSWORD`・`uniqueEmail`・`registerAndLogin`)。前方 import は無い(`helpers.ts` は Phase 24 から、spec はこの章)。
- 本物の Google でのポップアップ・生成元・同意画面は、本番での確認([79-3](./Phase-79-3.md) の 10.7節の表)で見る。
