// 作成：Phase-99-2
// 合意の精度(ステージ12)の E2E。詳細設計モードで文書まで作り、合意済みの版 B-1 で合意した後に、
// CR を渡さない再生成をしても合意の状態が「合意済み」のままであることと、確認事項の一覧で推測の要件を
// 確認済みにすると採用になって合意が記録されることを、画面で通す(docs/external_design.md 2.15節)。
//
// 偽の LLM の再生成は同じ文書を返すので、合意の形に戻す要素は出ない(戻す処理・戻した要素の見せ方は
// devex-api の保護のテストと devex-ui の部品のテストが固定している)。偽の要件定義書は推測の要件を
// 1つ(「通信を HTTPS で暗号化する」)持つ。
import { expect, type Page, test } from "@playwright/test";

import { completeHearing, createProject, registerAndLogin } from "./helpers";

const GENERATION_TIMEOUT = 30 * 1000;
const ASSUMED = "[E2E Fake] 通信を HTTPS で暗号化する";

function agreementPanel(page: Page) {
  return page.getByLabel("合意の状態", { exact: true });
}

test("合意済みの版で合意した行は再生成で変わらず、確認事項で推測の要件を確認すると合意になる", async ({
  page,
}) => {
  // ヒアリングから文書の生成と、文書の再生成を含むので、既定の30秒では足りない
  test.setTimeout(4 * 60 * 1000);
  await registerAndLogin(page, "e2e-agreement", "E2E Agreement");

  await createProject(page, "detailed", {
    name: `備品の合意 ${Date.now()}`,
    overview: "備品の貸し出しシステム",
    goal: "貸し出しを一覧で確かめたい",
  });
  await completeHearing(page, ["備品を予約したい", "社員だけが使う", "履歴も見たい"]);
  const documentsUrl = page.url();

  // ── 合意の前: 要件定義書の上の「合意の状態」は、すべて未合意
  await expect(agreementPanel(page)).toContainText("合意済み 0");

  // ── B-1 で合意する
  await page.getByRole("link", { name: "合意済みの版", exact: true }).click();
  await page.getByRole("button", { name: "合意済みの版を作る" }).click();
  await page.getByLabel("理由").fill("初回のヒアリングの内容で合意した");
  await page.getByRole("button", { name: "合意済みの版を作る", exact: true }).last().click();
  await expect(page).toHaveURL(/\/baselines\/1$/);

  await page.goto(documentsUrl);
  await expect(agreementPanel(page)).toContainText("合意と違う 0");
  await expect(agreementPanel(page)).toContainText("未合意 0");
  await expect(agreementPanel(page)).toContainText("合意 B-1");

  // ── CR を渡さない再生成の後も、合意済みのまま
  await page.getByRole("button", { name: "再生成する" }).click();
  await page.getByRole("button", { name: "再生成する" }).last().click();
  await expect(page.getByText("再生成しています")).toBeVisible();
  await expect(page.getByText("再生成しています")).toBeHidden({ timeout: GENERATION_TIMEOUT });
  await expect(agreementPanel(page)).toContainText("合意と違う 0");
  await expect(agreementPanel(page)).toContainText("未合意 0");

  // ── 確認事項: 推測の要件を確認済みにする(ダイアログで、採用にして合意を記録する)
  await page.getByRole("link", { name: "確認事項", exact: true }).first().click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/confirmations$/);
  const table = page.getByRole("table", { name: "確認事項" });
  await expect(table).toContainText(ASSUMED);
  await table.getByRole("button", { name: new RegExp(`${escape(ASSUMED)} を確認済みにする$`) }).click();
  const dialog = page.getByRole("dialog", { name: "確認済みにする" });
  await expect(dialog).toContainText("採用にして合意を記録します");
  await dialog.getByRole("button", { name: "採用にして合意を記録する" }).click();

  // 採用になって推測でなくなったので、未確認の絞り込みからは消える(未確認がほかに無ければ表ごと消える)。
  // 確認済みで絞ると同じ表に出て、状態は戻せず変更要求へ案内する
  await expect(table.getByText(ASSUMED)).toHaveCount(0);
  await page.getByLabel("状態で絞る").selectOption("confirmed");
  await expect(table).toContainText(ASSUMED);
  await expect(table).toContainText("確認済み(採用して合意)");
  await expect(table.getByRole("link", { name: "変えるときは変更要求(CR)で →" })).toBeVisible();

  // ── 文書の画面: 推測の要件は採用になり、合意の出どころは「採用にする」
  await page.goto(documentsUrl);
  const panel = agreementPanel(page);
  await expect(panel).toContainText("合意 採用にする");
  // 履歴: B-1 の合意と、採用にした合意が並ぶ(推測だった要件は、偽の要件定義書の最後の非機能要件)
  await panel.getByRole("button", { name: /^req:NFR-\d+ の履歴を開く$/ }).last().click();
  const history = panel.getByLabel(/^req:NFR-\d+ の履歴$/);
  await expect(history).toContainText("B-1");
  await expect(history).toContainText("採用にする");
});

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
