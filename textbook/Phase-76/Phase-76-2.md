# Phase-76-2: Google のログインと連携のダイアログ

## この章の目的

ログインと登録の画面の、フォームの下に「または」と Google のボタンを置く。Google が返した credential を `POST /auth/google` に送り、成功したらメールでのログインと同じく、戻り先かダッシュボードへ移る。同じメールのアカウントがあり、まだ連携していないとき(409 `GOOGLE_LINK_REQUIRED`)は、ダイアログでそのアカウントのパスワードを聞き、`POST /auth/google/link` で連携してログインする([外部設計書](../../docs/external_design.md) 2.13節)。

自動実装モード: on([introduction](./Phase-76-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/auth/components/GoogleLinkDialog.tsx`](../samples/frontend/src/features/auth/components/GoogleLinkDialog.tsx) | 新規 | 連携の確かめのダイアログ(「このアカウントのパスワード」) |
| [`src/features/auth/components/GoogleLoginSection.tsx`](../samples/frontend/src/features/auth/components/GoogleLoginSection.tsx) | 新規 | 「または」+ ボタン + エラー + ダイアログ。API の呼び出しと移動 |
| [`src/app/login/page.tsx`](../samples/frontend/src/app/login/page.tsx) | 更新 | フォームの下に `<GoogleLoginSection text="signin_with" />` |
| [`src/app/register/page.tsx`](../samples/frontend/src/app/register/page.tsx) | 更新 | フォームの下に `<GoogleLoginSection text="signup_with" />`(`Suspense` で包む) |
| [`src/features/auth/components/__tests__/GoogleLinkDialog.test.tsx`](../samples/frontend/src/features/auth/components/__tests__/GoogleLinkDialog.test.tsx) | 新規 | 文言・空では送れない・理由の表示・キャンセル |
| [`src/features/auth/components/__tests__/GoogleLoginSection.test.tsx`](../samples/frontend/src/features/auth/components/__tests__/GoogleLoginSection.test.tsx) | 新規 | 成功・連携・連携の 401・キャンセル・ほかのエラー・出さない環境 |
| [`src/app/login/__tests__/page.test.tsx`](../samples/frontend/src/app/login/__tests__/page.test.tsx) | 更新 | Google の部分が出る・出ない |
| [`src/app/register/__tests__/page.test.tsx`](../samples/frontend/src/app/register/__tests__/page.test.tsx) | 更新 | 同上。`useSearchParams` の mock を足した |

## 1. 連携の確かめのダイアログ

```tsx
// src/features/auth/components/GoogleLinkDialog.tsx(抜粋)
<Dialog.Title size="$6">Google アカウントと連携</Dialog.Title>
<Dialog.Description>
  このメールアドレスのアカウントがあります。パスワードを入れると、Google アカウントと連携します。
  連携した後は、Google とメールアドレスのどちらでもログインできます。
</Dialog.Description>
<InputPassword label="このアカウントのパスワード" ... />
```

- **形は [`ConfirmDialog`](../samples/frontend/src/components/ui/layout-blocks/ConfirmDialog.tsx) に倣う**: 入力欄とエラーが要るので、`ConfirmDialog` を使わず同じ骨組み(Overlay・Content・Title・Description・ボタンの並び)で書いた。
- **文言**: 1文目は外部設計書 2.13節のまま。2文目で、連携した後も今までのメールのログインが使えることを伝える(プロジェクトがそのまま使えるかの不安を減らす)。
- **ラベルは「このアカウントのパスワード」**: 後ろのフォームにも「パスワード」の欄がある。ダイアログを開いても後ろの欄はアクセシビリティの木に残るので、同じラベルだと E2E の `getByLabel("パスワード", { exact: true })` が2つに当たる(偽のモードの手動確認で見つけた)。どちらの欄かが読み上げでも分かるよう、ラベルを変えた。
- **入力は閉じるときに消す**: キャンセル(と外側のクリック・Esc)で空にする。開いたときに消す `useEffect` は、ESLint の `react-hooks/set-state-in-effect` に当たるので使わない。
- **送るボタン**: 空のとき・送っている間は押せない(`disabled`)。

## 2. ログインの部分

```tsx
// src/features/auth/components/GoogleLoginSection.tsx(抜粋)
if (!isFakeGoogle() && !googleClientId()) return null;

const handleCredential = async (credential: string) => {
  try {
    const tokens = await apiFetch<AccessTokenResponse>("/api/v1/auth/google", { method: "POST", body: ... });
    finishLogin(tokens);
  } catch (err) {
    if (err instanceof ApiError && err.code === "GOOGLE_LINK_REQUIRED") { setPendingCredential(credential); return; }
    setError(errorMessage(err, "Google でのログインに失敗しました"));
  }
};
```

- **ログインと登録で同じ部品**: Google の場合、ログインと登録は同じ API(初めての Google アカウントならそのまま登録)。成功したら、登録の画面からでもそのままログインしてダッシュボードへ移る(メールの登録は `/login` へ送るが、Google は送らない)。
- **ボタンはフォームの下**(ユーザー決定。推奨はフォームの上): メールのフォームを主にし、Google はその次の手段として置く。部品はカードの中、`FormGeneral` の枠の外に置く(`FormGeneral` の送信の演出に巻き込まない)。
- **出さない環境では区切りごと出さない**: ボタンの部品が null を返しても「または」だけが残らないよう、同じ条件(`google-config`)を先に見る。
- **成功の後**: `useAuthStore.getState().login()`(ログインの印の cookie も付く)→ `safeRedirectPath(?redirect=)` か `/dashboard`。`LoginForm` と同じ。
- **連携の credential は state に持つ**: API は状態を持たない(74-3)ので、`/auth/google/link` には同じ ID トークンをもう一度送る。ID トークンの期限(約1時間)の間にパスワードを入れればよい。
- **エラーの文**: API の `detail`(Google の分は日本語の文。74 で決めた)をそのまま出す。409 `GOOGLE_ACCOUNT_CONFLICT`・400 `GOOGLE_EMAIL_NOT_VERIFIED`・502 `GOOGLE_VERIFY_FAILED`・503 `GOOGLE_AUTH_UNAVAILABLE` は部分の下に、連携の 401 はダイアログの中に出す。Google のポップアップを閉じたなど、credential を得られなかったときは「Google でのログインを完了できませんでした」。
- **連携の 401 は英語の文**: パスワードが違うときは、メールでのログインと同じ表示にする(外部設計書 2.13節)。API の `detail` はログインと同じ `Invalid email or password` で、ログインのフォームも同じ文を出す。日本語にするかは、ログインのフォームと一緒に決める(申し送り)。

## 3. 画面

```tsx
// src/app/register/page.tsx(抜粋)
<StyledCard>
  <RegisterForm />
  <Suspense fallback={null}>
    <GoogleLoginSection text="signup_with" />
  </Suspense>
</StyledCard>
```

- **`Suspense`**: `GoogleLoginSection` は戻り先のために `useSearchParams()` を使う。静的に作る画面では、Next.js の規約で `Suspense` の境界が要る。ログインの画面は、既に `LoginForm` を包む `Suspense` があるので、その中に置いた。
- **ページのテストの mock**: 登録の画面のテストは `useSearchParams` を mock していなかった。`GoogleLoginSection` はフックを先に呼んでから出すかを決める(フックの規則)ので、ID が無いときも mock が要る。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `GoogleLinkDialog.test.tsx`(新規) | `GoogleLinkDialog` | React Testing Library + userEvent | スタブ不要 ── 入力と props の呼び出しだけで、外部依存を呼ばないため |
| `GoogleLoginSection.test.tsx`(新規) | `GoogleLoginSection` | React Testing Library + userEvent | `stubFetch`(API の応答を順に返す)・`next/navigation` の mock・`vi.stubEnv` で偽のモード(本物のボタンは外部のスクリプトが要るため。ボタンそのものは 76-1) |
| ログイン・登録の `page.test.tsx`(更新) | `LoginPage`・`RegisterPage` | React Testing Library | `next/navigation` の mock・`vi.stubEnv` |

- ダイアログ: 外部設計書の文言 / パスワードが空のうちは押せず、入れると `onSubmit` に値 / 断られた理由の表示 / キャンセルで `onCancel`。
- ログインの部分: ID が無く偽でもなければ「または」ごと出さない / 成功で `/auth/google` に credential、ストアに access、戻り先へ / 409 `GOOGLE_LINK_REQUIRED` でダイアログ → 同じ credential とパスワードで `/auth/google/link` → ダッシュボード(409 の `detail` は出さない) / 連携の 401 はダイアログの中に出し、ログインしない / キャンセルで閉じ、API を呼ばない / `GOOGLE_ACCOUNT_CONFLICT` は API の文を出し、ダイアログを開かない。
- 画面: フォームのボタンは残り、その下に「または」と Google のボタン / ID が無ければ出さない。
- タイムアウト: 文字の入力とダイアログの開閉が続くので、`GoogleLoginSection` の describe に `{ timeout: 20000 }` を付けた(並列の全体テストで既定の5秒を超えたため。デモの画面のテストと同じ扱い)。
- 作成・更新したファイルは、この章のテストが import する(`GoogleLinkDialog.tsx`・`GoogleLoginSection.tsx`・2つの `page.tsx`)。前方 import は無い。
