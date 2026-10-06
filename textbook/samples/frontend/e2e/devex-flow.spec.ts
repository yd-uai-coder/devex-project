// 作成：Phase-4-4｜更新：Phase-6-6,24-2,24(ゴール3後の調整)
// 写経レベル: コア ── docs/implementation_plan.md 4.2節が定義するE2Eフロー
// 「ログイン→プロジェクト作成→チャットヒアリング→設計書生成→ダウンロード」を
// ブラウザ経由でそのまま再現する、Phase 4の中心的な成果物。
//
// devex-api側はE2E_FAKE_LLM=true(docker-compose.e2e.yml、playwright.config.tsのwebServer)で
// 起動しており、app/ai/llm/fake.pyのE2eFakeLLMが応答する。ヒアリング完了はユーザー発話
// 2回目で確定する設計(_TURNS_UNTIL_SUFFICIENT)のため、このテストも2回発話する。
// Phase-6-6：更新 ── 完了判定の最低発話数ガード導入に伴い、確定は3回目の発話に変更(このテストも3回発話する)。
// 登録・プロジェクト作成(モード選択ダイアログ)・ヒアリング(生成の確認ダイアログ)は helpers.ts に
// 切り出し、詳細設計モードの spec(detailed-design-flow.spec.ts)と共有する(Phase 24-2)。
// Phase-24-2:追記 ── ./helpers(completeHearing, createProject, registerAndLogin)
import { expect, test } from "@playwright/test";

import { completeHearing, createProject, registerAndLogin } from "./helpers";

// Phase-24-2：削除(helpers.ts へ移動)
// function uniqueEmail(prefix: string): string {
  // // docker composeのPostgresボリュームは実行間で永続化されるため、再実行のたびに
  // // 一意のメールアドレスを使う(UserAlreadyExistsErrorによる登録失敗を避ける)。
  // return `${prefix}-${Date.now()}@example.com`;
// }

test("ログイン→プロジェクト作成→チャットヒアリング→設計書生成→ダウンロードの一連フロー", async ({
  page,
}) => {
  // Phase-24-2：更新 ── Phase 15 のモード選択ダイアログと生成の確認ダイアログで壊れていたため、helpers.ts の操作に置き換える
  // const email = uniqueEmail("e2e-flow");
  // // 作成時は"s3cret-pass"だったが、登録画面のパスワード強度ルール(大文字・小文字・数字・
  // // 記号を各1文字以上、Phase 3完了後に追加)を満たさず登録が常に弾かれていた。
  // // 実機検証で発見・修正(Phase-4-4.md「実機検証で発見した不具合」参照)。
  // const password = "S3cret-pass";
//
  // // 1. 登録
  // await page.goto("/register");
  // await page.getByLabel("氏名").fill("E2E Tester");
  // await page.getByLabel("メールアドレス").fill(email);
  // await page.getByLabel("パスワード", { exact: true }).fill(password);
  // await page.getByRole("button", { name: "登録する" }).click();
  // await expect(page).toHaveURL(/\/login/);
//
  // // 2. ログイン
  // await page.getByLabel("メールアドレス").fill(email);
  // await page.getByLabel("パスワード", { exact: true }).fill(password);
  // await page.getByRole("button", { name: "ログイン" }).click();
  // await expect(page).toHaveURL(/\/dashboard/);
//
  // // 3. 新規プロジェクト作成(初期ヒアリング入力)
  // await page.getByRole("link", { name: "新規プロジェクトを作成" }).click();
  // await expect(page).toHaveURL(/\/projects\/new/);
  // await page.getByLabel("システム概要").fill("在庫管理システムを作りたい");
  // await page.getByLabel("実現したいこと").fill("在庫数をリアルタイムに可視化したい");
  // await page.getByRole("button", { name: "ヒアリングを始める" }).click();
  // await expect(page).toHaveURL(/\/projects\/[^/]+\/chat/);
//
  // // 4. チャットヒアリング(3ターンでヒアリング完了と判定される、fake.py参照)
  // const messageBox = page.getByPlaceholder("メッセージを入力");
  // await expect(messageBox).toBeVisible();
//
  // await messageBox.fill("利用者は倉庫の担当者を想定しています");
  // await page.getByRole("button", { name: "送信" }).click();
  // // オープニング発話と通常のチャット返信が同じ固定文字列(E2eFakeLLM._reply_for、
  // // Phase-4-4.md「実機検証で発見した不具合」参照)のため、strict mode違反を避けるべく.first()を使う。
  // await expect(page.getByText("E2E Fake", { exact: false }).first()).toBeVisible();
//
  // // Phase-6-6:追記 ── 最低発話数ガード(3回)を満たすための追加発話
  // await messageBox.fill("MVPでは在庫の入出庫記録と一覧表示のみ作ります");
  // await page.getByRole("button", { name: "送信" }).click();
//
  // await messageBox.fill("特に技術的な制約はありません");
  // await page.getByRole("button", { name: "送信" }).click();
//
  // // 5. ヒアリング完了バナーの承認 → 生成トリガー
  // const approveButton = page.getByRole("button", { name: "この内容で設計書を生成する" });
  // await expect(approveButton).toBeVisible();
  // await approveButton.click();
//
  // // 6. 生成完了をポーリングで検知し、ドキュメントプレビュー画面へ自動遷移する
  // //    (useGenerationPolling、既定5秒間隔。E2eFakeLLMは実APIを呼ばないため数秒で完了する)。
  // await expect(page).toHaveURL(/\/projects\/[^/]+\/documents/, { timeout: 30 * 1000 });
//
  // // 7. 4種のドキュメントタブがすべて生成され、E2E Fake由来の内容が表示されていることを確認する
  // for (const label of ["要件定義", "外部設計", "内部設計", "実装計画"]) {
  //   await page.getByRole("tab", { name: label }).click();
  //   await expect(page.getByText("E2E Fake", { exact: false })).toBeVisible();
  // }
//
  // // 8. ダウンロード(.md)
  // const downloadPromise = page.waitForEvent("download");
  // await page.getByRole("button", { name: "ダウンロード(.md)" }).click();
  // const download = await downloadPromise;
  // expect(download.suggestedFilename()).toBe("implementation_plan.md");
  // ↓↓
  await registerAndLogin(page, "e2e-flow");
  await createProject(page, "simple", {
    // Phase-24:追記
    name: "在庫管理",
    overview: "在庫管理システムを作りたい",
    goal: "在庫数をリアルタイムに可視化したい",
  });
  await completeHearing(page, [
    "利用者は倉庫の担当者を想定しています",
    "MVPでは在庫の入出庫記録と一覧表示のみ作ります",
    "特に技術的な制約はありません",
  ]);

  // 4種のドキュメントタブがすべて生成され、E2E Fake由来の内容が表示されていることを確認する
  for (const label of ["要件定義", "外部設計", "内部設計", "実装計画"]) {
    await page.getByRole("tab", { name: label }).click();
    await expect(page.getByText("E2E Fake", { exact: false })).toBeVisible();
  }

  // ダウンロード(.md)
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "ダウンロード(.md)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("implementation_plan.md");
});

test("ドキュメントプレビュー画面から再生成すると、再度生成完了まで待って表示を更新する", async ({
  page,
}) => {
  // Phase-24-2：更新 ── Phase 15 のモード選択ダイアログと生成の確認ダイアログで壊れていたため、helpers.ts の操作に置き換える
  // const email = uniqueEmail("e2e-regenerate");
  // const password = "S3cret-pass";
//
  // await page.goto("/register");
  // await page.getByLabel("氏名").fill("E2E Regenerator");
  // await page.getByLabel("メールアドレス").fill(email);
  // await page.getByLabel("パスワード", { exact: true }).fill(password);
  // await page.getByRole("button", { name: "登録する" }).click();
  // // 登録後、/loginへの遷移を明示的に待つ(1本目のテストと揃える)。この待ちが無いと、
  // // まだ/registerに留まっている間に次のfill()が/register自身のフォームへ入力されてしまい、
  // // その後/loginへ遷移した瞬間にLoginFormがまっさらな状態で再マウントされるため、
  // // 結局空欄のまま「ログイン」ボタンが押されてバリデーションエラーになる
  // // (実機検証で発見・修正、Phase-4-4.md「実機検証で発見した不具合」参照)。
  // await expect(page).toHaveURL(/\/login/);
//
  // await page.getByLabel("メールアドレス").fill(email);
  // await page.getByLabel("パスワード", { exact: true }).fill(password);
  // await page.getByRole("button", { name: "ログイン" }).click();
  // await expect(page).toHaveURL(/\/dashboard/);
//
  // await page.getByRole("link", { name: "新規プロジェクトを作成" }).click();
  // await page.getByLabel("システム概要").fill("勤怠管理システムを作りたい");
  // await page.getByLabel("実現したいこと").fill("打刻を簡略化したい");
  // await page.getByRole("button", { name: "ヒアリングを始める" }).click();
//
  // const messageBox = page.getByPlaceholder("メッセージを入力");
  // await messageBox.fill("利用者は正社員とアルバイトの両方です");
  // await page.getByRole("button", { name: "送信" }).click();
  // // Phase-6-6:追記 ── 最低発話数ガード(3回)を満たすための追加発話
  // await messageBox.fill("MVPでは打刻と月次集計のみ作ります");
  // await page.getByRole("button", { name: "送信" }).click();
  // await messageBox.fill("特にありません");
  // await page.getByRole("button", { name: "送信" }).click();
  // await page.getByRole("button", { name: "この内容で設計書を生成する" }).click();
  // await expect(page).toHaveURL(/\/projects\/[^/]+\/documents/, { timeout: 30 * 1000 });
//
  // // 再生成(revisingへの遷移を経由し、完了後に同じドキュメント画面へポーリングで戻ってくる)
  // await page.getByRole("button", { name: "再生成する" }).click();
  // await expect(page.getByText("再生成しています")).toBeVisible();
  // await expect(page.getByText("再生成しています")).toBeHidden({ timeout: 30 * 1000 });
  // await expect(page.getByRole("tab", { name: "要件定義" })).toBeVisible();
  // ↓↓
  await registerAndLogin(page, "e2e-regenerate", "E2E Regenerator");
  await createProject(page, "simple", {
    // Phase-24:追記
    name: "勤怠管理",
    overview: "勤怠管理システムを作りたい",
    goal: "打刻を簡略化したい",
  });
  await completeHearing(page, [
    "利用者は正社員とアルバイトの両方です",
    "MVPでは打刻と月次集計のみ作ります",
    "特にありません",
  ]);

  // 再生成(revisingへの遷移を経由し、完了後に同じドキュメント画面へポーリングで戻ってくる)。
  // 再生成にも確認ダイアログがある
  await page.getByRole("button", { name: "再生成する" }).click();
  await page.getByRole("button", { name: "再生成する" }).last().click();
  await expect(page.getByText("再生成しています")).toBeVisible();
  await expect(page.getByText("再生成しています")).toBeHidden({ timeout: 30 * 1000 });
  await expect(page.getByRole("tab", { name: "要件定義" })).toBeVisible();
});
