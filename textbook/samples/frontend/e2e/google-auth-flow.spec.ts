// 作成：Phase-79-2
// Google でのログイン・登録・連携の E2E。本物の Google は呼ばず、偽のボタン(「偽の Google アカウント(E2E)」の
// 欄と「Google で続ける(E2E)」)が `fake:<email>:<email>` の credential を送る。backend は E2E_FAKE_GOOGLE=true
// でそれを受け付け、UI は playwright.config.ts の NEXT_PUBLIC_E2E_FAKE_GOOGLE で偽のボタンを出す。
// ページには Next.js のルートの読み上げの空の role="alert" があるので、知らせは文で取る。
import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, registerAndLogin, uniqueEmail } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WRONG_PASSWORD = "Wrong-pass-99";

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

async function loginWithPassword(page: Page, email: string, password: string) {
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(password);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
}

test("初めての Google アカウントは、そのまま登録してダッシュボードへ入り、リロードしてもログインが続く", async ({
  page,
}) => {
  await page.goto("/login");
  await continueWithFakeGoogle(page, uniqueEmail("e2e-google-new"));
  await expect(page).toHaveURL(/\/dashboard/);

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("button", { name: "新規プロジェクトを作成" })).toBeVisible();
});

test("パスワードで登録済みのメールは、パスワードで確かめて連携し、その後はどちらでもログインできる", async ({
  page,
}) => {
  const email = await registerAndLogin(page, "e2e-google-link");
  await signOut(page);

  // 同じメールの Google → 連携の確かめのダイアログ
  await continueWithFakeGoogle(page, email);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Google アカウントと連携" })).toBeVisible();

  // パスワードが違えば、ダイアログの中に日本語の文が出る(ログインと同じ 401 の文)
  await dialog.getByLabel("このアカウントのパスワード").fill(WRONG_PASSWORD);
  await dialog.getByRole("button", { name: "連携してログイン" }).click();
  await expect(dialog.getByText("メールアドレスまたはパスワードが正しくありません。")).toBeVisible();

  await dialog.getByLabel("このアカウントのパスワード").fill(PASSWORD);
  await dialog.getByRole("button", { name: "連携してログイン" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // 連携した後も、メールとパスワードでログインできる
  await signOut(page);
  await loginWithPassword(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard/);

  // 2回目からの Google は、確かめずにそのまま入れる
  await signOut(page);
  await continueWithFakeGoogle(page, email);
  await expect(page).toHaveURL(/\/dashboard/);

  // メールでのログインでパスワードが違うときも、同じ日本語の文
  await signOut(page);
  await loginWithPassword(page, email, WRONG_PASSWORD);
  await expect(page.getByText("メールアドレスまたはパスワードが正しくありません。")).toBeVisible();
});

test("Google だけの利用者は、マイページでパスワードを設定してから連携を解除できる", async ({ page }) => {
  await page.goto("/login");
  await continueWithFakeGoogle(page, uniqueEmail("e2e-google-only"));
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/mypage");

  // パスワードが無いうちは、設定のフォームだけが出て、メールの変更と解除は出ない
  await expect(page.getByRole("button", { name: "パスワードを設定する" })).toBeVisible();
  await expect(page.getByText("パスワードを設定すると、連携を解除できます。")).toBeVisible();
  await expect(page.getByRole("button", { name: "メールアドレスを変える" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "連携を解除する" })).toHaveCount(0);

  await page.getByLabel("新しいパスワード", { exact: true }).fill(PASSWORD);
  await page.getByLabel("新しいパスワード(確認)").fill(PASSWORD);
  await page.getByRole("button", { name: "パスワードを設定する" }).click();
  await expect(page.getByText("パスワードを設定しました", { exact: true })).toBeVisible();

  // 設定すると、メールの変更・パスワードの変更・解除が出る
  await expect(page.getByRole("button", { name: "メールアドレスを変える" })).toBeVisible();
  await expect(page.getByRole("button", { name: "パスワードを変える" })).toBeVisible();
  await expect(page.getByRole("button", { name: "連携を解除する" })).toBeVisible();

  // 設定はトークンを出し直すので、リロードしてもログインが続く
  await page.reload();
  await expect(page.getByRole("button", { name: "連携を解除する" })).toBeVisible();

  // 確認のダイアログを経て解除すると、連携していない表示になる
  await page.getByRole("button", { name: "連携を解除する" }).click();
  await expect(page.getByText("Google との連携を解除しますか")).toBeVisible();
  await page.getByRole("button", { name: "解除する", exact: true }).click();
  await expect(page.getByText("連携すると、Google アカウントでもログインできます。")).toBeVisible();

  // 解除の後も、この端末のログインは続く
  await page.reload();
  await expect(page.getByText("連携すると、Google アカウントでもログインできます。")).toBeVisible();
});

test("パスワードの利用者は、マイページでメールの違う Google と連携でき、ほかの人の Google とは連携できない", async ({
  page,
  request,
}) => {
  // ほかの人がもう使っている Google アカウント(API から直接作る)
  const taken = uniqueEmail("e2e-google-taken");
  const created = await request.post(`${API_URL}/api/v1/auth/google`, {
    data: { credential: `fake:${taken}:${taken}` },
  });
  expect(created.ok()).toBeTruthy();

  const userName = `E2E Google ${Date.now()}`;
  await registerAndLogin(page, "e2e-google-mypage", userName);
  await page.goto("/mypage");
  const dialog = page.getByRole("dialog");

  // ほかの人と連携済みの Google は、ダイアログを閉じて枠に理由を出す
  await continueWithFakeGoogle(page, taken);
  await dialog.getByLabel("このアカウントのパスワード").fill(PASSWORD);
  await dialog.getByRole("button", { name: "連携する" }).click();
  await expect(page.getByText("このアカウントか Google アカウントが、ほかと連携済みです。")).toBeVisible();
  await expect(dialog).toHaveCount(0);

  // パスワードが違えば、ダイアログを開いたまま中に理由を出す
  const google = uniqueEmail("e2e-google-other");
  await continueWithFakeGoogle(page, google);
  await dialog.getByLabel("このアカウントのパスワード").fill(WRONG_PASSWORD);
  await dialog.getByRole("button", { name: "連携する" }).click();
  await expect(dialog.getByText("今のパスワードが正しくありません")).toBeVisible();

  // 正しいパスワードなら、メールの違う Google とも連携できる
  await dialog.getByLabel("このアカウントのパスワード").fill(PASSWORD);
  await dialog.getByRole("button", { name: "連携する" }).click();
  await expect(page.getByText("Google アカウントと連携しています。")).toBeVisible();

  // その Google でログインすると、この人のアカウントに入る
  await signOut(page);
  await continueWithFakeGoogle(page, google);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/mypage");
  await expect(page.getByLabel("ユーザーネーム")).toHaveValue(userName);
});
