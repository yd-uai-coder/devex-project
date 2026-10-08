// 作成：Phase-24-2｜更新：24(ゴール3後の調整),32-2
// 写経レベル: 定型 ── 画面の操作の並び(ラベルで探して押す)。
// E2E の spec が共有する操作(登録とログイン、モードを選んだプロジェクトの作成、ヒアリングから
// Phase-32-2：更新
// // 設計書の生成まで)。簡易ドキュメントモード(devex-flow.spec.ts)と詳細設計モード
// // (detailed-design-flow.spec.ts)の両方が、この順で始まる。
// ↓↓
// 設計書の生成まで、段階8の手順書の生成)。簡易ドキュメントモード(devex-flow.spec.ts)と
// 詳細設計モード(detailed-design-flow.spec.ts)の両方が、この順で始まり、段階8で終わる。
import { expect, type Page } from "@playwright/test";

export type ProjectMode = "simple" | "detailed";

const MODE_TITLES: Record<ProjectMode, string> = {
  simple: "簡易ドキュメントモード",
  detailed: "詳細設計モード",
};

const PASSWORD = "S3cret-pass";

function uniqueEmail(prefix: string): string {
  // docker composeのPostgresボリュームは実行間で永続化されるため、再実行のたびに
  // 一意のメールアドレスを使う(UserAlreadyExistsErrorによる登録失敗を避ける)。
  return `${prefix}-${Date.now()}@example.com`;
}

// 新しい利用者を登録してログインし、ダッシュボードまで進む。
export async function registerAndLogin(page: Page, prefix: string, name = "E2E Tester") {
  const email = uniqueEmail(prefix);

  await page.goto("/register");
  await page.getByLabel("氏名").fill(name);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

// ダッシュボードからモードを選んでプロジェクトを作り、チャット画面まで進む(Phase 15 の
// モード選択ダイアログ。各カードのボタンは「{モード}で作成する」という aria-label を持つ)。
export async function createProject(
  page: Page,
  mode: ProjectMode,
  // Phase-24：更新
  // intake: { overview: string; goal: string },
  // ↓↓
  intake: { name: string; overview: string; goal: string },
) {
  await page.getByRole("button", { name: "新規プロジェクトを作成" }).click();
  await page.getByRole("button", { name: `${MODE_TITLES[mode]}で作成する` }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/new\\?mode=${mode}`));
  // Phase-24:追記
  await page.getByLabel("プロジェクト名").fill(intake.name);
  await page.getByLabel("システム概要").fill(intake.overview);
  await page.getByLabel("実現したいこと").fill(intake.goal);
  await page.getByRole("button", { name: "ヒアリングを始める" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/chat/);
}

// チャットで発話し、ヒアリング完了のバナーから設計書を生成して、ドキュメント画面へ移るまで待つ。
// 偽LLMはユーザー発話3回でヒアリング完了と判定する(fake.py の _TURNS_UNTIL_SUFFICIENT)。
export async function completeHearing(page: Page, messages: string[]) {
  const messageBox = page.getByPlaceholder("メッセージを入力");
  await expect(messageBox).toBeVisible();
  for (const message of messages) {
    await messageBox.fill(message);
    await page.getByRole("button", { name: "送信" }).click();
    // オープニング発話と通常のチャット返信が同じ固定文字列(E2eFakeLLM._reply_for)のため、
    // strict mode違反を避けるべく.first()を使う。
    await expect(page.getByText("E2E Fake", { exact: false }).first()).toBeVisible();
  }

  // 生成の前に確認ダイアログが出る(Phase 15 の気づき#4)
  await page.getByRole("button", { name: "この内容で設計書を生成する" }).click();
  await page.getByRole("button", { name: "生成する", exact: true }).click();

  // 生成完了をポーリングで検知し、ドキュメントプレビュー画面へ自動遷移する
  // (useGenerationPolling、既定5秒間隔。E2eFakeLLMは実APIを呼ばないため数秒で完了する)。
  await expect(page).toHaveURL(/\/projects\/[^/]+\/documents/, { timeout: 30 * 1000 });
}

// Phase-32-2:追記
// 段階8(実装手順書)で単位を選んで手順書を生成し、選んだ単位がすべて「生成済」になるまで待つ。
// 生成はバックグラウンドで走り、画面は5秒ごとに段階の一覧を取り直す(useStageGenerationPolling)。
export async function generateProcedureDocs(page: Page, unitIds: string[]) {
  const units = page.getByRole("table", { name: "単位の一覧" });
  for (const id of unitIds) {
    await units.getByRole("checkbox", { name: `${id} を生成する` }).check();
  }
  await page.getByRole("button", { name: /^選んだ単位の手順書を生成する/ }).click();
  // 行は単位の列のボタンで探す(依存の列に、ほかの単位の ID が出るため)
  for (const id of unitIds) {
    const row = units
      .getByRole("row")
      .filter({ has: page.getByRole("button", { name: `${id} の詳細を開く` }) });
    await expect(row).toContainText("生成済", { timeout: 30 * 1000 });
  }
}
