# Phase-76-1: Google のボタンの部品

## この章の目的

Google でのログインのボタンを、画面から使える1つの部品にする。部品はクライアント ID が無い環境では何も出さず、E2E のときは本物の代わりに偽のボタンを出す。ログイン・登録の画面での使い方(API の呼び出しと連携のダイアログ)は [76-2](./Phase-76-2.md) で作る。Phase 77 のマイページの連携も、この部品をそのまま使う。

自動実装モード: on([introduction](./Phase-76-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`package.json`](../samples/frontend/package.json) | 更新 | `@react-oauth/google` `^0.13.5` |
| [`src/features/auth/google-config.ts`](../samples/frontend/src/features/auth/google-config.ts) | 新規 | `googleClientId()`・`isFakeGoogle()` |
| [`src/features/auth/components/GoogleSignInButton.tsx`](../samples/frontend/src/features/auth/components/GoogleSignInButton.tsx) | 新規 | `GoogleSignInButton`・`GoogleButtonText`。本物は `GoogleOAuthProvider` で `GoogleLogin` を包む。偽は `FakeGoogleButton` |
| [`playwright.config.ts`](../samples/frontend/playwright.config.ts) | 更新 | devex-ui の webServer に `env: { NEXT_PUBLIC_E2E_FAKE_GOOGLE: "true" }` |
| [`src/features/auth/components/__tests__/GoogleSignInButton.test.tsx`](../samples/frontend/src/features/auth/components/__tests__/GoogleSignInButton.test.tsx) | 新規 | 設定の読み方・ID の有無・credential の受け渡し・偽のボタン |

ミラーしないもの(#21 の共通): `devex-ui/.env.example`(`NEXT_PUBLIC_GOOGLE_CLIENT_ID` と、コメントにした `NEXT_PUBLIC_E2E_FAKE_GOOGLE` を説明つきで足した)。

## 1. 設定の読み方

```ts
// src/features/auth/google-config.ts(抜粋)
export function googleClientId(): string | null {
  const value = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  return value ? value : null;
}
export function isFakeGoogle(): boolean {
  return process.env.NEXT_PUBLIC_E2E_FAKE_GOOGLE === "true";
}
```

- **`process.env.NEXT_PUBLIC_...` と書き下す**: Next.js はビルドのときに、この形で書いた所だけを値に置き換える。分割代入や `process.env[key]` にすると、ブラウザでは常に undefined になる。
- **関数にした**: 定数にするとモジュールを読んだ時点で値が決まり、テストが `vi.stubEnv` で切り替えられない。関数なら、呼ぶたびに読む(本番ではビルドで埋め込まれた文字列を返すだけ)。
- **空は無いのと同じ**: `.env.example` は `NEXT_PUBLIC_GOOGLE_CLIENT_ID=` と空で置くので、空文字も null にする。

## 2. ボタンの部品

```tsx
// src/features/auth/components/GoogleSignInButton.tsx(抜粋)
export function GoogleSignInButton({ text, onCredential, onError }: GoogleSignInButtonProps) {
  if (isFakeGoogle()) return <FakeGoogleButton onCredential={onCredential} />;
  const clientId = googleClientId();
  if (!clientId) return null;
  return (
    <GoogleOAuthProvider clientId={clientId} locale="ja">
      <GoogleLogin text={text} width={300}
        onSuccess={(response) => { if (response.credential) onCredential(response.credential); else onError(); }}
        onError={onError} />
    </GoogleOAuthProvider>
  );
}
```

- **Provider は部品の中**(ユーザー決定): `GoogleOAuthProvider` はマウントされると Google のスクリプト(`accounts.google.com/gsi/client`)を差し込み、外れると取り除く。アプリ全体(`providers.tsx`)に置くと、ダッシュボードなど Google と関係ない全画面でスクリプトが動く。部品の中なら、ボタンのある画面(ログイン・登録・77 のマイページ)だけで読む。画面を移るたびに差し込み直すが、ブラウザのキャッシュが効く。One Tap(Provider を上に置く必要がある)は範囲の外(73-1)。
- **`locale="ja"`**: Provider に渡すと、スクリプトの URL に `?hl=ja` が付き、ボタンの文言が日本語になる(「Google でログイン」「Google で登録」)。
- **`text`**: ログインの画面は `signin_with`、登録の画面は `signup_with`。API はどちらも同じ(`POST /auth/google`)。文言だけを画面に合わせる。
- **部品は credential を返すだけ**: どの API に送るかは呼び出し側が決める。ログイン・登録は `/auth/google`(76-2)、マイページは `/users/me/google`(77)。
- **credential が無い成功**: 型の上では `credential` は省略できる。来なければ `onError` に回す。
- **ポップアップ方式**: `ux_mode` は既定の `popup`。リダイレクト URI は要らない(OAuth クライアントには JavaScript の生成元だけを入れる)。

## 3. E2E の偽のボタン

```tsx
// src/features/auth/components/GoogleSignInButton.tsx(抜粋)
<InputSimpleText label="偽の Google アカウント(E2E)" ... />
<StyledButton aria-label="Google で続ける(E2E)" disabled={!email}
  onPress={() => onCredential(`fake:${email}:${email}`)}>
```

- **形は API の偽の検証に合わせる**: `fake:<sub>:<email>`(74-2 の `FakeGoogleTokenVerifier`)。sub もメールにする。同じメールなら同じ Google アカウントとして扱われ、連携した後のログインも確かめられる。
- **ラベルと文言**: Playwright の `getByLabel`・`getByRole({ name })` は既定で部分一致する。E2E の `registerAndLogin`([`e2e/helpers.ts`](../samples/frontend/e2e/helpers.ts))が使う「メールアドレス」「パスワード」「ログイン」「登録する」を含まない文言にした。helpers は変えていない。
- **`NEXT_PUBLIC_E2E_FAKE_GOOGLE` の渡し方**: `playwright.config.ts` の devex-ui の webServer の `env`。API 側の `E2E_FAKE_GOOGLE`(`docker-compose.e2e.yml`)と対。手元で先に `npm run dev` を立てていると `reuseExistingServer` でそれが使われ、偽のボタンにならない(79 で E2E を流すときの注意)。
- **本番に混ざらないか**: 値はビルドで埋め込まれる。Vercel の環境変数に書かなければ偽にならない。API 側も本番では `E2E_FAKE_GOOGLE` で起動しない(74-2)ので、偽の credential は通らない。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `GoogleSignInButton.test.tsx`(新規)の `google-config` | `googleClientId`・`isFakeGoogle` | Vitest のテスト関数 | スタブ不要 ── 環境変数を読むだけの純粋に近い関数。`vi.stubEnv` は入力を与えるだけ |
| 同・`GoogleSignInButton` | `GoogleSignInButton` | React Testing Library(+ userEvent) | `vi.mock("@react-oauth/google")` ── Provider は子をそのまま返し、`GoogleLogin` は受けた props を記録する。外部のスクリプトを読まず、Google の応答をテストから起こすため |

- 設定: 空の ID は null / 印は `"true"` のときだけ。
- 本物: ID が無ければ何も出さない / ID があれば Provider に ID、`GoogleLogin` に `text` が渡る / `onSuccess` の credential が `onCredential` へ、credential の無い応答は `onError` へ。
- 偽: 本物のボタンを出さず、入れたメールで `fake:<email>:<email>` を渡す。
- 作成・更新したファイルは、この章のテストが import する(`google-config.ts`・`GoogleSignInButton.tsx`)。`package.json`・`playwright.config.ts` は設定のため対象外。前方 import は無い。
