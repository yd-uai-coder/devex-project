// 作成：Phase-110-2
// 名称の言い換え(ステージ13)の E2E。プロジェクトの概要に言い換えの印を書くと、偽の LLM は再生成の
// たびに利用者の名前・画面名・外部連携のサービス名・段階1 の処理の名称を少し変える
// (devex-api の app/ai/llm/paraphrase.py)。名前の揺れがあっても、段階1 の処理 ID が変わらないこと、
// 合意の後の再生成で合意の形に戻り外部連携が1行のままであること、推測の利用者の確認事項のメモが
// 残ることを、画面で通す(docs/internal_design.md 3.3-13)。
//
// 印のある偽の要件定義書は推測の利用者を1行(総務の担当者)、外部設計書は外部連携を1行(予約通知 API)
// 足す。段階1 の言い換えは、外部設計書を作り直して言い換えた名前が入ったときだけ起きる。
import { expect, type Page, test } from "@playwright/test";

import { completeHearing, createProject, registerAndLogin } from "./helpers";

const GENERATION_TIMEOUT = 30 * 1000;
const MARK = "[言い換え]";
const SUFFIX = "(言い換え)";
const ASSUMED_USER = "[E2E Fake] 総務の担当者";
const MEMO = "総務に貸し出しの確かめ方を聞く";

function agreementPanel(page: Page) {
  return page.getByLabel("合意の状態", { exact: true });
}

async function regenerateDocuments(page: Page) {
  await page.getByRole("button", { name: "再生成する" }).click();
  await page.getByRole("button", { name: "再生成する" }).last().click();
  await expect(page.getByText("再生成しています")).toBeVisible();
  await expect(page.getByText("再生成しています")).toBeHidden({ timeout: GENERATION_TIMEOUT });
}

// 外部設計のタブの上の件数(画面・API・外部連携)
async function expectIntegrations(page: Page, count: number) {
  await page.getByRole("tab", { name: "外部設計" }).click();
  await expect(page.getByText(new RegExp(`外部連携 ${count}$`))).toBeVisible();
  await page.getByRole("tab", { name: "要件定義" }).click();
}

// 段階1 の処理の名称(F-01・F-02)
async function functionNames(page: Page): Promise<string[]> {
  return Promise.all(["F-01", "F-02"].map((id) => page.getByLabel(`${id} の名称`).inputValue()));
}

test("名称を言い換える再生成でも、段階1 の処理 ID・合意・外部連携の1行・確認事項のメモが保たれる", async ({
  page,
}) => {
  // 文書の生成・再生成2回と段階1 の生成2回を含むので、既定の30秒では足りない
  test.setTimeout(5 * 60 * 1000);
  await registerAndLogin(page, "e2e-paraphrase", "E2E Paraphrase");

  await createProject(page, "detailed", {
    name: `備品の言い換え ${Date.now()}`,
    overview: `備品の貸し出しシステム ${MARK}`,
    goal: "貸し出しを一覧で確かめたい",
  });
  await completeHearing(page, ["備品を予約したい", "社員だけが使う", "履歴も見たい"]);
  const documentsUrl = page.url();
  await expectIntegrations(page, 1);

  // ── 段階1 を作って承認する(言い換えの前の名称)
  await page.getByRole("link", { name: "詳細設計へ進む →" }).click();
  await expect(page.getByRole("heading", { name: "段階1 機能一覧" })).toBeVisible();
  await page.getByRole("button", { name: "下書きを生成する" }).click();
  await expect(page.getByRole("button", { name: "下書きを作り直す" })).toBeVisible({ timeout: GENERATION_TIMEOUT });
  const before = await functionNames(page);
  for (const name of before) expect(name).not.toContain(SUFFIX);
  const approve = page.getByRole("button", { name: /^(承認する|このまま承認し直す)$/ });
  await approve.click();
  await expect(page.getByText("段階1-機能一覧を承認しました。")).toBeVisible();

  // ── 合意の前の再生成: 画面名・サービス名が言い換わる(外部連携は1行のまま入れ替わる)
  await page.goto(documentsUrl);
  await regenerateDocuments(page);
  await expectIntegrations(page, 1);

  // 段階1 を作り直すと、処理の名称は言い換わるが、処理 ID は引き継ぐ
  await page.getByRole("link", { name: "詳細設計へ進む →" }).click();
  await page.getByRole("button", { name: /^段階1 機能一覧\(/ }).click();
  await page.getByRole("button", { name: "下書きを作り直す" }).click();
  await page.getByRole("dialog", { name: "下書きを作り直しますか?" }).getByRole("button", { name: "作り直す" }).click();
  await expect
    .poll(async () => (await functionNames(page)).every((name) => name.endsWith(SUFFIX)), { timeout: GENERATION_TIMEOUT })
    .toBe(true);
  const after = await functionNames(page);
  expect(after).toEqual(before.map((name) => `${name}${SUFFIX}`));

  // ── B-1 で合意する → 確認事項で推測の利用者にメモを書く
  await page.goto(documentsUrl);
  await page.getByRole("link", { name: "合意済みの版", exact: true }).click();
  await page.getByRole("button", { name: "合意済みの版を作る" }).click();
  await page.getByLabel("理由").fill("言い換えの後の内容で合意した");
  await page.getByRole("button", { name: "合意済みの版を作る", exact: true }).last().click();
  await expect(page).toHaveURL(/\/baselines\/1$/);

  await page.goto(documentsUrl);
  await page.getByRole("link", { name: "確認事項", exact: true }).first().click();
  const table = page.getByRole("table", { name: "確認事項" });
  const userRow = table.getByRole("row").filter({ hasText: ASSUMED_USER });
  await expect(userRow).toHaveCount(1);
  await userRow.getByRole("button", { name: "メモを書く" }).click();
  await userRow.getByRole("textbox").fill(MEMO);
  await userRow.getByRole("button", { name: "保存", exact: true }).click();
  await expect(userRow).toContainText(MEMO);

  // ── 合意の後の再生成: 言い換えは合意の形に戻り、外部連携は重ならず1行のまま
  await page.goto(documentsUrl);
  await regenerateDocuments(page);
  await expect(agreementPanel(page)).toContainText("合意と違う 0");
  await expectIntegrations(page, 1);

  // 推測の利用者は、名前が揺れても同じ確認事項として、メモが残る
  await page.getByRole("link", { name: "確認事項", exact: true }).first().click();
  await expect(table.getByRole("row").filter({ hasText: ASSUMED_USER })).toContainText(MEMO);
});
