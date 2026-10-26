// 作成：Phase-89-2｜更新：Phase-110-2
// 変更要求(CR)の流れの E2E。詳細設計モードで文書まで作り、合意済みの版 B-1 を作って、その中身から
// CR を作る。説明書のダウンロード → 説明済み → 合意 → 文書への反映 → 文書の側(画面・API)の確認 →
// 検証済み → 新しい版 B-2 に入れる → たどる記録、までを画面で通す(docs/external_design.md 2.14節)。
//
// 段階は作らない(段階に付く印・段階への反映・予測と実際の比較の中身は、devex-api の CR のテストが
// 固定している)。偽の LLM の再生成は同じ文書を返すので、反映で印は付かず、検証に要るのは文書の側の
// 確認だけになる。対象は偽の要件定義書の FR-001(偽の外部設計書の画面と API がこの要件を持つ)。
import { readFile } from "node:fs/promises";

import { expect, type Page, test } from "@playwright/test";

import { completeHearing, createProject, registerAndLogin } from "./helpers";

const GENERATION_TIMEOUT = 30 * 1000;

// CR の状態のバッジ(見出しの横。`状態: {名前}` の aria-label を持つ)
async function expectStatus(page: Page, label: string) {
  await expect(page.getByLabel(`状態: ${label}`, { exact: true })).toBeVisible({ timeout: GENERATION_TIMEOUT });
}

async function openTab(page: Page, name: string) {
  await page.getByRole("tab", { name }).click();
}

test("合意済みの版から CR を作り、説明・合意・反映・検証を経て新しい版に入れる", async ({ page }) => {
  // ヒアリングから文書の生成と、文書の再生成を含むので、既定の30秒では足りない
  test.setTimeout(4 * 60 * 1000);
  await registerAndLogin(page, "e2e-cr", "E2E CR");

  await createProject(page, "detailed", {
    name: `予約の CR ${Date.now()}`,
    overview: "会議室の予約システム",
    goal: "予約を一覧で確かめたい",
  });
  await completeHearing(page, ["会議室を予約したい", "社員だけが使う", "履歴も見たい"]);

  // ── B-1: 文書の画面の見出しから、合意済みの版の一覧へ
  await page.getByRole("link", { name: "合意済みの版", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/baselines$/);
  await page.getByRole("button", { name: "合意済みの版を作る" }).click();
  await expect(page.getByText("入れられる変更要求はありません", { exact: false })).toBeVisible();
  // 段階は未着手なので、どれも入らない
  await expect(page.getByRole("table", { name: "束に入る段階" })).toContainText("入らない");
  await page.getByLabel("相手(名前と役割。空でもよい)").fill("総務部 山田");
  await page.getByLabel("理由").fill("初回のヒアリングの内容で合意した");
  await page.getByRole("button", { name: "合意済みの版を作る", exact: true }).last().click();
  await expect(page).toHaveURL(/\/baselines\/1$/);
  await expect(page.getByText("相手: 総務部 山田")).toBeVisible();

  // ── CR-1: 版の中身から作成のページへ(基準の版は B-1 に固定)
  await page.getByRole("button", { name: "この版を基準に変更要求を作る →" }).click();
  await expect(page).toHaveURL(/\/baselines\/1\/change-requests\/new$/);
  await page.getByLabel("タイトル").fill("予約の取り消しを足す");
  await page.getByLabel("内容").fill("予約を取り消せるようにしてほしい");
  await page.getByLabel("足す要件").selectOption("FR-001");
  await page.getByRole("button", { name: "対象に足す" }).click();
  await page.getByLabel("FR-001 の変更後の案").fill("会議室の予約を登録し、取り消せる。");
  await page.getByRole("button", { name: "下書きで作る" }).click();
  await expect(page).toHaveURL(/\/change-requests\/1$/);
  await expectStatus(page, "下書き");

  // 影響の予測に、FR-001 を持つ画面・API が出る(合意の前に見せる)
  await openTab(page, "影響");
  await expect(page.getByLabel("影響の予測")).toContainText("SCR-");

  // 説明書: プレビューとダウンロード(5節の md)
  await openTab(page, "説明書");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    // Phase-110-2：更新
    // page.getByRole("button", { name: "説明書をダウンロード(.md)" }).click(),
    // ↓↓
    // 見出しの操作にも同じボタンがあるので、タブの中のものを押す
    page.getByRole("tabpanel").getByRole("button", { name: "説明書をダウンロード(.md)" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("cr-1-explanation.md");
  const markdown = await readFile((await download.path()) as string, "utf-8");
  expect(markdown).toContain("# 変更の説明書 CR-1: 予約の取り消しを足す");
  for (const heading of ["## 1.", "## 2.", "## 3.", "## 4.", "## 5."]) {
    expect(markdown).toContain(heading);
  }
  expect(markdown).toContain("会議室の予約を登録し、取り消せる。");

  // ── 説明済み → 合意(相手・メモ・理由)
  await page.getByRole("button", { name: "説明済みにする" }).click();
  await page.getByRole("button", { name: "記録する", exact: true }).click();
  await expectStatus(page, "説明済み");

  await page.getByRole("button", { name: "合意を記録する" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("相手(名前と役割。空でもよい)").fill("総務部 山田");
  await dialog.getByLabel("打ち合わせのメモ(任意)").fill("定例で取り消しの要望");
  await dialog.getByLabel("理由").fill("運用で取り消しが要るため");
  await dialog.getByRole("button", { name: "記録する", exact: true }).click();
  await expectStatus(page, "合意");

  // ── 文書への反映(偽の LLM で再生成し、終わると反映済み)
  await openTab(page, "影響");
  await page.getByRole("button", { name: "文書へ反映する(要件定義書から再生成)" }).click();
  await page.getByRole("button", { name: "反映する", exact: true }).click();
  await expectStatus(page, "反映済み");
  await expect(page.getByLabel("予測と実際の比較")).toBeVisible({ timeout: GENERATION_TIMEOUT });

  // ── 検証: 印は付かない。文書の側(画面・API)を確認済みにすると、検証済みにできる
  await openTab(page, "検証");
  const documents = page.getByLabel("文書の側の確認").getByRole("checkbox");
  await expect(documents.first()).toBeVisible();
  const count = await documents.count();
  // チェックは保存の応答の後に付く(制御された入力)ので、check() でなく押してから待つ
  for (let index = 0; index < count; index += 1) {
    await documents.nth(index).click();
    await expect(documents.nth(index)).toBeChecked();
  }
  await page.getByRole("button", { name: "検証済みにする", exact: true }).click();
  await page.getByRole("button", { name: "検証を記録する" }).click();
  await expectStatus(page, "検証済み");

  // ── B-2: 検証済みの CR を選ぶと、合意の記録の欄に CR の記録が入る(メモと理由は CR の番号付き)
  await page.goto(page.url().replace(/\/change-requests\/1$/, "/baselines"));
  await page.getByRole("button", { name: "合意済みの版を作る" }).click();
  await page.getByRole("checkbox", { name: /CR-1 予約の取り消しを足す/ }).check();
  await expect(page.getByLabel("理由")).toHaveValue("CR-1: 運用で取り消しが要るため");
  await expect(page.getByLabel("相手(名前と役割。空でもよい)")).toHaveValue("総務部 山田");
  await expect(page.getByLabel("打ち合わせのメモ(任意)")).toHaveValue("CR-1: 定例で取り消しの要望");
  await page.getByRole("button", { name: "合意済みの版を作る", exact: true }).last().click();
  await expect(page).toHaveURL(/\/baselines\/2$/);
  await page.getByRole("link", { name: "CR-1", exact: true }).click();
  await expect(page).toHaveURL(/\/change-requests\/1$/);

  // ── たどる記録: 受付から新しい版までが並ぶ
  await openTab(page, "たどる記録");
  await expect(page.getByText("基準: B-1 → 入れた版: B-2")).toBeVisible();
  const trace = page.getByRole("table", { name: "たどる記録" });
  for (const status of ["説明済み", "合意", "反映済み", "検証済み"]) {
    await expect(trace).toContainText(status);
  }
  // 反映で作り直した版と、入れた版を指す
  await expect(trace).toContainText("要件定義書 版2");
  await expect(trace).toContainText("合意済みの版 B-2");

  // 合意の相手は、たどる記録でなく内容のタブの合意の記録にある
  await openTab(page, "内容");
  await expect(page.getByRole("tabpanel")).toContainText("総務部 山田");
});
