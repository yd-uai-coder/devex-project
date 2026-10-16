# Phase-66-3: マイページの画面(アカウント)

## この章の目的

`/mypage`(SCR-009)を新設し、「アカウント」の節に、ユーザーネーム・メールアドレス・パスワードを変える3つのフォームを置く。グローバルメニューの CONTENTS に「マイページ」を足す。API は [66-2](./Phase-66-2.md) のもの。用途ごとのモデルと API キーの節は Phase 67 で同じページに足す。

自動実装モード: on([introduction](./Phase-66-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/lib/menu-tree.ts`](../samples/frontend/src/lib/menu-tree.ts) | 更新 | CONTENTS の最後に「マイページ」(`/mypage`) |
| [`src/features/auth/schemas.ts`](../samples/frontend/src/features/auth/schemas.ts) | 更新 | `newPasswordSchema`(登録の規則を抜き出す)・`EMAIL_MAX_LENGTH`・`USER_NAME_MAX_LENGTH` を export |
| [`src/features/mypage/api/accountApi.ts`](../samples/frontend/src/features/mypage/api/accountApi.ts) | 新規 | `getAccount`・`updateUserName`・`changeEmail`・`changePassword` |
| [`src/features/mypage/schemas.ts`](../samples/frontend/src/features/mypage/schemas.ts) | 新規 | 3つのフォームのスキーマ(パスワードは確認の欄と照らす) |
| [`src/features/mypage/components/UserNameForm.tsx`](../samples/frontend/src/features/mypage/components/UserNameForm.tsx) | 新規 | ユーザーネームの変更 |
| [`src/features/mypage/components/EmailForm.tsx`](../samples/frontend/src/features/mypage/components/EmailForm.tsx) | 新規 | メールの変更(400・409 を欄のエラーに) |
| [`src/features/mypage/components/PasswordForm.tsx`](../samples/frontend/src/features/mypage/components/PasswordForm.tsx) | 新規 | パスワードの変更(返った access をストアに入れ直す) |
| [`src/features/mypage/components/AccountSection.tsx`](../samples/frontend/src/features/mypage/components/AccountSection.tsx) | 新規 | 今の値を読み、3つのフォームを並べる |
| [`src/app/mypage/page.tsx`](../samples/frontend/src/app/mypage/page.tsx) | 新規 | `RequireAuth` の中に「アカウント」の節(本体は `src/app/(pages)/(protected)/mypage/`) |
| [`src/lib/__tests__/menu-tree.test.ts`](../samples/frontend/src/lib/__tests__/menu-tree.test.ts) | 更新 | 未ログインの木・マイページの項目 |
| [`src/features/mypage/__tests__/schemas.test.ts`](../samples/frontend/src/features/mypage/__tests__/schemas.test.ts) | 新規 | スキーマ |
| [`src/features/mypage/api/__tests__/accountApi.test.ts`](../samples/frontend/src/features/mypage/api/__tests__/accountApi.test.ts) | 新規 | メソッド・パス・本文 |
| [`src/features/mypage/components/__tests__/AccountSection.test.tsx`](../samples/frontend/src/features/mypage/components/__tests__/AccountSection.test.tsx) | 新規 | 読み込み・ユーザーネームの保存 |
| [`src/features/mypage/components/__tests__/EmailForm.test.tsx`](../samples/frontend/src/features/mypage/components/__tests__/EmailForm.test.tsx) | 新規 | 成功・400・409 |
| [`src/features/mypage/components/__tests__/PasswordForm.test.tsx`](../samples/frontend/src/features/mypage/components/__tests__/PasswordForm.test.tsx) | 新規 | 成功でストアの入れ直し・400・確認の不一致 |
| [`src/app/mypage/__tests__/page.test.tsx`](../samples/frontend/src/app/mypage/__tests__/page.test.tsx) | 新規 | ログインの有無 |

## 1. メニューと規則の共有

- `MENU_TREE` の CONTENTS に `{ kind: "link", label: "マイページ", href: "/mypage" }` を足した。ダッシュボードと同じく `auth` は付けない(未ログインで開くと、ページの `RequireAuth` がログイン必須ダイアログを出す)。トップページのカードと 404 ページの一覧にも同じ木から出る。
- **規則を1か所に**: 登録の `password` の規則(必須・8〜128文字・大文字・小文字・数字・記号)を `newPasswordSchema(label)` に抜き出し、登録とパスワードの変更で使う(#17。駆動している消費者 = マイページのパスワードの変更)。ラベルを引数にしたので、文言は「新しいパスワードは大文字を含めてください」のように欄の名前になる。

## 2. API とスキーマ(`features/mypage`)

```ts
// src/features/mypage/api/accountApi.ts(要点)
export type AccountRead = { id: string; email: string; user_name: string | null };
export const CURRENT_PASSWORD_MISMATCH = "CURRENT_PASSWORD_MISMATCH";

export function changePassword(currentPassword: string, newPassword: string): Promise<AccessTokenResponse>
```

```ts
// src/features/mypage/schemas.ts(要点)
export const passwordChangeSchema = z
  .object({ currentPassword: ..., newPassword: newPasswordSchema("新しいパスワード"), confirmPassword: ... })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "新しいパスワードと一致しません" });
```

- `AccountRead` は、この画面に要る項目だけを型にした(設計レビューの `CurrentUserRead` と同じ考え方)。
- **確認の欄**を置いた(Claude の判断)。打ち間違えたまま保存すると、次のログインで入れなくなる。照らすのは画面だけで、API には送らない。
- 今のパスワードには規則を課さない(規則より前に作ったパスワードでも変えられるように。API と同じ)。

## 3. フォーム(3つを別々に保存する)

- それぞれ `FormGeneral`(既存の送信ボタンとスピナー)と react-hook-form で組み、登録の `RegisterForm` と同じく `onBeforeSubmit` の中で検証と API の呼び出しを行う。
- 成功はトースト([Phase 64](../Phase-64/Phase-64-introduction.md) の `AppToast`。`useToastController().show`)で知らせる。
- **失敗を欄に結び付ける**: 今のパスワードの不一致(`code` が `CURRENT_PASSWORD_MISMATCH`)は今のパスワードの欄に、使われているメール(409)は新しいメールの欄に、`setError` で出す。そのほかの失敗はフォームの下に `role="alert"` で出す。
- メールとパスワードのフォームは、成功したら入力を空に戻す(`reset`)。ユーザーネームは保存した値を残す。
- **パスワードの変更の後**: 応答の access を `useAuthStore.getState().login(access_token)` で入れ直す。サイレントリフレッシュのタイマーも新しいトークンで張り直され、refresh は応答の Cookie(サーバーが出し直したもの)で続く。ログインの印の cookie は付いたまま(今の端末はログインを保つ。[Phase 65](../Phase-65/Phase-65-introduction.md) の申し送り「パスワードの変更の後の印」は、ログインを保つので印を消さない、で解決)。

## 4. ページ(`/mypage`)

```tsx
// src/app/(pages)/(protected)/mypage/page.tsx
export default function MyPage() {
  return (
    <RequireAuth>
      <YStack paddingVertical="$4" gap="$6" width="100%" maxWidth={640}>
        <H2>マイページ</H2>
        <AccountSection />
      </YStack>
    </RequireAuth>
  );
}
```

- `AccountSection` は `GET /users/me` で今の値を読み、読み終わるまではスピナー、失敗は `role="alert"`。読めたら3つのフォームを縦に並べる。ユーザーネームとメールの変更の応答で、今の値を差し替える(「今のメールアドレス」の表示が変わる)。
- 見出しは「マイページ」(H2)→「アカウント」(H3)→ フォームごと(H4)。Phase 67 は H3 の節(モデル・API キー)を足す。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `menu-tree.test.ts`(更新) | `MENU_TREE`・`visibleMenuTree` | vitest | スタブ不要 ── 木は定数で、出し分けは純粋な関数のため |
| `schemas.test.ts`(新規) | 3つのスキーマ・`newPasswordSchema` | vitest(`safeParse`) | スタブ不要 ── スキーマは純粋なため |
| `accountApi.test.ts`(新規) | `accountApi` の4つの関数 | vitest | fetch(`stubFetch`。送ったメソッド・パス・本文を見る) |
| `AccountSection.test.tsx`・`EmailForm.test.tsx`・`PasswordForm.test.tsx`(新規) | 節と3つのフォーム | ユーザーの操作(Testing Library) | fetch(`stubFetch`)・`useToastController`(`vi.mock`。呼ばれたことを見る)。`PasswordForm` の `useAuthStore` は本物(入れ直されることが検証対象) |
| `page.test.tsx`(新規) | マイページ | 描画 | fetch・`next/navigation` |

- 今の値を出して3つのフォームを並べる / ユーザーネームを保存してトースト、空なら API を呼ばない / 読み込みの失敗を出す / メールの成功で親へ新しい値を渡し入力を空にする、400 は今のパスワードの欄、409 は新しいメールの欄 / パスワードの成功でストアの access が替わりトースト、400 ではストアを変えない、確認の不一致では API を呼ばない / 未ログインならアカウントを読みに行かない。
- 作成・更新したファイルは、この章のテストがすべて import する(フォームは `AccountSection` を通して、`UserNameForm` は `AccountSection.test.tsx` が操作する)。前方 import は無い(`accountApi.ts` → 既存の `auth-store` の型、`schemas.ts` → この章で export した `newPasswordSchema`・`EMAIL_MAX_LENGTH`・`USER_NAME_MAX_LENGTH`)。
