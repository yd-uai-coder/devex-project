# Phase-3-2: ログイン/登録画面(SCR-001)

## この章の目的

`docs/external_design.md` SCR-001(ログイン/ユーザー登録画面)を実装する。バックエンドの`POST /api/v1/auth/login`・`POST /api/v1/auth/register`を呼び出すフォームを、既存のフィールドコンポーネント(`InputEmail`/`InputPassword`/`InputSimpleText`)と`react-hook-form`+`zod`のパターンで組み立て、成功時は[`Phase-3-1.md`](./Phase-3-1.md)の`auth-store.ts`に接続する。

納期モード([`Phase-3-introduction.md`](./Phase-3-introduction.md)参照)。#14のSUT/ドライバ/スタブの言語化は省略する。

サンプルは [`textbook/samples/frontend/`](../samples/frontend/) に追加した。写経前提として[`Phase-3-1.md`](./Phase-3-1.md)(`auth-store.ts`のCookie方式書き換え)の写経が完了していること。

## この章で作成・更新したファイル

写経順序は依存順(CLAUDE.md #30): 既存共有コンポーネントの改修(`FormGeneral.tsx`のバグ修正+`InputSimpleText.tsx`/`InputPassword.tsx`のa11y配線、いずれもfeature層より先)→`features/auth/schemas.ts`→`LoginForm.tsx`/`RegisterForm.tsx`→`app/login/page.tsx`/`app/register/page.tsx`。テストは末尾。

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
|---|---|---|---|
| [`src/components/ui/form/FormGeneral.tsx`](../samples/frontend/src/components/ui/form/FormGeneral.tsx) | 更新 | **コア** | 送信スピナーを実際の非同期処理(`onBeforeSubmit`)の完了に連動させるよう修正し、`Form.Trigger asChild`の対象を`<Button>`1つに限定(後述) |
| [`src/components/ui/form/sample-form/LayoutForm.tsx`](../samples/frontend/src/components/ui/form/sample-form/LayoutForm.tsx) | 更新 | 定型 | `FormGeneral`の挙動変更に合わせ、デモの2秒スピナー演出を`demoDelayMs={2000}`で明示的に指定 |
| [`src/components/ui/form/InputSimpleText.tsx`](../samples/frontend/src/components/ui/form/InputSimpleText.tsx) | 更新 | **コア** | エラー時に`aria-invalid`/`aria-describedby`をエラーメッセージ要素(`role="alert"`)と紐づける |
| [`src/components/ui/form/InputPassword.tsx`](../samples/frontend/src/components/ui/form/InputPassword.tsx) | 更新 | **コア** | 同上 |
| [`src/features/auth/schemas.ts`](../samples/frontend/src/features/auth/schemas.ts) | 新規 | 定型 | ログイン/登録フォームの`zod`スキーマ(既存`validation-rules.ts`の関数を組み合わせるのみ) |
| [`src/features/auth/components/LoginForm.tsx`](../samples/frontend/src/features/auth/components/LoginForm.tsx) | 新規 | **コア** | ログインフォーム。成功時`auth-store.login()`呼び出し+`?redirect=`遷移 |
| [`src/features/auth/components/RegisterForm.tsx`](../samples/frontend/src/features/auth/components/RegisterForm.tsx) | 新規 | **コア** | 登録フォーム。成功後は自動ログインせず`/login`へ誘導 |
| [`src/app/login/page.tsx`](../samples/frontend/src/app/login/page.tsx) | 新規 | 定型 | `LoginForm`のページラッパー(`useSearchParams`使用のため`Suspense`必須) |
| [`src/app/register/page.tsx`](../samples/frontend/src/app/register/page.tsx) | 新規 | 定型 | `RegisterForm`のページラッパー |
| ── ここからテスト(まとめて末尾) ── | | | |
| [`src/components/ui/form/__tests__/FormGeneral.test.tsx`](../samples/frontend/src/components/ui/form/__tests__/FormGeneral.test.tsx) | 新規 | 定型 | 修正した送信フローの単体テスト |
| [`src/features/auth/components/__tests__/LoginForm.test.tsx`](../samples/frontend/src/features/auth/components/__tests__/LoginForm.test.tsx) | 新規 | 定型 | バリデーション・成功・失敗・a11y配線の確認 |
| [`src/features/auth/components/__tests__/RegisterForm.test.tsx`](../samples/frontend/src/features/auth/components/__tests__/RegisterForm.test.tsx) | 新規 | 定型 | 同上(登録) |
| [`src/app/login/__tests__/page.test.tsx`](../samples/frontend/src/app/login/__tests__/page.test.tsx) | 新規 | 定型 | ページの構成要素(フォーム+リンク)のスモークテスト |
| [`src/app/register/__tests__/page.test.tsx`](../samples/frontend/src/app/register/__tests__/page.test.tsx) | 新規 | 定型 | 同上(登録) |

## 主要な設計判断

### `FormGeneral.tsx`を修正した理由(rule #17: 実在の消費者による共有コンポーネント修正)

既存の`FormGeneral`は「送信ボタン押下から固定2秒後にスピナーを消して`onSubmitted`を呼ぶ」というデモ専用の実装だった(`sample-form`ページには実バックエンドが無く、バリデーションが同期的に完了してしまうため、スピナーを見せるための意図的な遅延)。しかしログインフォームのような実際の非同期処理を持つフォームにこの実装をそのまま使うと、APIが数百msで応答してもユーザーは常に2秒待たされることになり、実用に耐えない。

本章がこのコンポーネントの最初の「実バックエンドを持つ」消費者であるため(CLAUDE.md #17: 今のPhaseの実在の消費者が明確)、スピナー表示を`onBeforeSubmit()`の実際の完了に連動させるよう修正し、デモ向けの固定遅延は`demoDelayMs`という明示的なopt-inプロパティに切り出した。既存の`sample-form`デモ(`LayoutForm.tsx`)は`demoDelayMs={2000}`を渡すことで、これまでと全く同じ見た目を維持する。

また、この過程で`Form.Trigger asChild`が実際の`<Button>`ではなく、それを含む`<YStack>`(ボタン+スピナー欄)全体をラップしていたことが判明した。`asChild`はラップした要素にトリガーの役割(`role="button"`等)を注入するため、内側の`<Button>`と合わせて同じアクセシブルネームを持つ要素が2つ存在する状態になっており、`getByRole("button", {name: ...})`が一意に定まらない(実際に本章のテスト作成時に発覚した)。`Form.Trigger`の対象を`<Button>`1つに限定し、スピナー欄は兄弟要素に変更した。

> **後続の改訂**: Phase 3完了後の相談で、`registerSchema`のパスワードに強度ルール(大文字・小文字・数字・記号必須)を追加した。詳細は[`decision-digest.md`](../decision-digest.md)「Phase 3完了後」節参照。`loginSchema`側は既存アカウントへの遡及適用にならないよう対象外のまま。

> **後続の改訂**: `app/login/page.tsx`/`app/register/page.tsx`は元々`"use client"`が無く、実機検証で`TypeError: createReactContext is not a function`が発生した(Server Componentから`tamagui`を直接importできないため)。両ファイルの先頭に`"use client";`を追加して解決した。詳細は[`decision-digest.md`](../decision-digest.md)「Phase 3完了後 ── Server ComponentからTamaguiを直接importできない問題」節参照。

### `InputSimpleText`/`InputPassword`に`aria-invalid`/`aria-describedby`を配線した理由

`docs/requirements.md` 1.5節(非機能要件)とdecision-digestが「新規/改修コンポーネントには`aria-invalid`/`aria-describedby`/`role="alert"`/`aria-live`を必ず配線する」と定めている。これらのコンポーネントは元々エラーメッセージを表示するだけで、支援技術に「どの入力欄がなぜ無効か」を伝える手段が無かった。ログイン/登録フォームがこれらを使う最初の実消費者であるため、rule #17に基づきこの章で配線する。

### 登録成功後に自動ログインしない理由

`POST /api/v1/auth/register`はユーザー情報のみを返しトークンを発行しない(バックエンド仕様)。自動ログインを実装するには登録後に`/login`を追加で呼ぶ必要があり、ログインの成否判定ロジックが2箇所に分散する。シンプルさを優先し、登録後は`/login`へ誘導する設計にした。

### ログインの`redirect`パラメータに`startsWith("/")`チェックを入れた理由

`RequireAuth`→`LoginRequiredDialog`は未ログイン時に`/login?redirect=<元のパス>`へ誘導する。この`redirect`クエリはURLから読み取ったユーザー制御可能な値であるため、外部サイトへのオープンリダイレクトを避けるため相対パスであることを確認してから`router.push`する。

## テスト観点

| ケース | 期待結果 | SUT / ドライバ / スタブ |
|---|---|---|
| `FormGeneral`: `onBeforeSubmit`がtrue | 追加待機なしで`onSubmitted`を呼ぶ | SUT: `FormGeneral.tsx` / ドライバ: `render`+`userEvent` / スタブ不要 ── `onBeforeSubmit`はテストコードが直接渡す純粋な関数のため |
| `FormGeneral`: `onBeforeSubmit`がfalse | `onSubmitted`を呼ばず再送信可能に戻る | 同上 |
| `FormGeneral`: `demoDelayMs`指定 | 指定時間経過後に`onSubmitted`を呼ぶ | 同上 |
| `LoginForm`: 空欄送信 | バリデーションエラー表示+API未呼び出し+`aria-invalid`/`aria-describedby`配線 | SUT: `LoginForm.tsx` / ドライバ: `render`+`userEvent` / スタブ: `fetch-stub.ts`(呼ばれていないことの確認に使う) |
| `LoginForm`: 成功 | `auth-store.login()`呼び出し+`redirect`先へ`router.push` | 同上(`next/navigation`は`vi.mock`でフェイク) |
| `LoginForm`: 失敗(401) | エラーメッセージ表示、ログイン状態にしない | 同上 |
| `RegisterForm`: パスワード短すぎ | バリデーションエラー表示+API未呼び出し | 同上 |
| `RegisterForm`: 成功 | `full_name`を含めてPOST、`/login`へ遷移(ログイン状態にはしない) | 同上 |
| `RegisterForm`: 失敗(409等) | エラーメッセージ表示 | 同上 |
| `login`/`register`ページ | フォームと相互リンクを表示する | SUT: 各`page.tsx` / ドライバ: `render` / スタブ不要 ── レンダリングの構成要素を見るだけのスモークテストのため |

`npx vitest run src/features/auth src/app/login src/app/register src/components/ui/form/__tests__/FormGeneral.test.tsx src/components/ui/form/sample-form src/components/auth`で38件green、`npx tsc --noEmit`で0エラー、既存テスト全体は124件中123件green(残る1件`Menu.test.tsx`は[`Phase-3-1.md`](./Phase-3-1.md)で確認済みの本Phaseと無関係な既存不具合)を確認した(このセッション内で一時的に`devex-ui`へ反映して検証し、検証後は元の状態に戻した。写経後は各自の環境で再確認すること)。
