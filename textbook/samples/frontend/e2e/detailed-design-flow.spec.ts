// 作成：Phase-24-3｜更新：24(ゴール3後の調整),30-4,30-7,32-2
// 写経レベル: コア ── 非同期の生成の待ち方・図の承認(自動レイアウト)・段階の承認の順序。
// 詳細設計モードの通しの E2E(Phase 24)。詳細設計モードでプロジェクトを作り、ヒアリング後に
// Phase-32-2：更新
// // 段階1〜7を生成・承認して、詳細設計書と実装計画の zip をダウンロードする。
// ↓↓
// 段階1〜7を生成・承認して、詳細設計書と実装計画の zip をダウンロードし、段階8の手順書を生成する
// (段階8の承認と実装手順書の zip は、devex-api の契約テストが通す)。
//
// devex-api 側は E2E_FAKE_LLM=true で起動し、E2eFakeLLM が段階ごとの下書きを返す。その出力が
// 段階の検証と図の検証を通ることは、devex-api の tests/unit/test_fake_llm_detailed_design.py が
// ブラウザ無しで確かめている(ここで落ちたら、先にそちらを流して原因を切り分ける)。
//
// 生成はバックグラウンドで走り、画面は5秒ごとに段階の一覧を取り直す(useStageGenerationPolling)。
// そのため、生成の後は「承認する」が押せるようになるまで待つ。
import { readFile } from "node:fs/promises";

import { expect, type Locator, type Page, test } from "@playwright/test";

// Phase-32-2：更新
// import { completeHearing, createProject, registerAndLogin } from "./helpers";
// ↓↓
import { completeHearing, createProject, generateProcedureDocs, registerAndLogin } from "./helpers";

const GENERATION_TIMEOUT = 30 * 1000;

// zip に入るファイル(devex-api の DetailedDesignExportService)
const BUNDLE_FILES = [
  "detailed_design.html",
  "detailed_design.md",
  "implementation_plan.html",
  "implementation_plan.md",
  // Phase-30-4:追記
  // Phase-30-7：削除
  // "implementation_procedure/index.md",
  // "implementation_procedure/implementation_procedure.html",
  "diagrams/",
];

// 段階の作業領域(見出し「段階N …」から下)。図のエディタの「承認」と段階の「承認する」を
// 取り違えないよう、ボタンの名前は exact で探す。
function stageApproveButton(page: Page): Locator {
  return page.getByRole("button", { name: "承認する", exact: true });
}

// 段階の下書きを生成し、生成が終わるまで待つ(段階1・3・4・7。段階2・5・6は選択の保存が先に要る)。
async function generateDraft(page: Page) {
  await page.getByRole("button", { name: "下書きを生成する" }).click();
  await expect(page.getByRole("button", { name: "下書きを作り直す" })).toBeVisible({
    timeout: GENERATION_TIMEOUT,
  });
}

// 図(DFD・ER・構成図)の「承認」。図を開くと配置の無い図は自動レイアウトが走り、その間は
// ボタンが押せない(承認には配置が要る)。押せるようになるまで待ってから押す。
async function approveDiagram(page: Page) {
  const approve = page.getByRole("button", { name: "承認", exact: true });
  await expect(approve).toBeEnabled({ timeout: GENERATION_TIMEOUT });
  await approve.click();
  await expect(approve).toBeHidden({ timeout: GENERATION_TIMEOUT });
}

// Phase-32-2：更新
// // 段階を承認し、完了ダイアログで次の段階へ進む(段階7は「閉じる」だけ)。
// ↓↓
// 段階を承認し、完了ダイアログで次の段階へ進む(段階7の次は段階8 実装手順書)。
async function approveStage(page: Page, stage: number, title: string) {
  const approve = stageApproveButton(page);
  await expect(approve).toBeEnabled({ timeout: GENERATION_TIMEOUT });
  await approve.click();
  await expect(page.getByText(`段階${stage}-${title}を承認しました。`)).toBeVisible();
  // Phase-32-2：更新
  // const next = page.getByRole("button", { name: "次の段階へ進む" });
  // if (stage < 7) {
  //   await next.click();
  // } else {
  //   await expect(next).toHaveCount(0);
  //   await page.getByRole("button", { name: "閉じる" }).click();
  // }
  // ↓↓
  await page.getByRole("button", { name: "次の段階へ進む" }).click();
}

// 段階の「保存する」(パネルの上下に同じバーがあるので、上を押す)。
async function saveStage(page: Page) {
  await page.getByRole("button", { name: "保存する", exact: true }).first().click();
  await expect(page.getByText("保存していない編集があります。").first()).toBeHidden();
}

// zip のファイル名は、ローカルファイルヘッダに平文(UTF-8)で入るので、展開せずに探せる。
function zipEntriesInclude(content: Buffer, name: string): boolean {
  return content.includes(Buffer.from(name, "utf-8"));
}

// Phase-32-2：更新
// test("詳細設計モードで段階1〜7を承認し、詳細設計書と実装計画の zip をダウンロードする", async ({
// ↓↓
test("詳細設計モードで段階1〜7を承認して詳細設計書と実装計画の zip をダウンロードし、段階8の手順書を生成する", async ({
  page,
}) => {
  test.setTimeout(5 * 60 * 1000);

  await registerAndLogin(page, "e2e-detailed", "E2E Designer");
  await createProject(page, "detailed", {
    // Phase-24:追記
    name: "備品予約",
    overview: "備品の予約システムを作りたい",
    goal: "備品の貸し出しの重複をなくしたい",
  });
  await completeHearing(page, [
    "利用者は社内の全従業員です",
    "MVPでは予約の登録と一覧だけ作ります",
    "特に技術的な制約はありません",
  ]);

  // 詳細設計モードでは、要件定義と外部設計だけを生成する(内部設計は段階で組み立てる)
  await expect(page.getByRole("tab", { name: "要件定義" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "外部設計" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "内部設計" })).toHaveCount(0);
  await page.getByRole("link", { name: "詳細設計へ進む →" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/detailed-design/);

  // 段階1 機能一覧
  await expect(page.getByRole("heading", { name: "段階1 機能一覧" })).toBeVisible();
  await generateDraft(page);
  await approveStage(page, 1, "機能一覧");

  // 段階2 データフロー: DFD を描くグループを選んで保存してから生成し、DFD を承認する
  await page.getByLabel(/^reservations/).check();
  await saveStage(page);
  await generateDraft(page);
  await expect(page.getByRole("tab", { name: /reservations/ })).toBeVisible();
  await approveDiagram(page);
  await approveStage(page, 2, "データフロー");

  // 段階3 データモデル: ER を承認する
  await generateDraft(page);
  await approveDiagram(page);
  await approveStage(page, 3, "データモデル");

  // 段階4 ソフトウェア構造: 構成図を承認する
  await generateDraft(page);
  await approveDiagram(page);
  await approveStage(page, 4, "ソフトウェア構造");

  // 段階5 主要処理の手順: 手順を書く処理を選んで保存し、手順の無い処理を生成する
  await page.getByLabel("F-01 予約を登録する").check();
  await saveStage(page);
  await page.getByRole("button", { name: /^手順の無い処理の下書きを生成する/ }).click();
  await expect(page.getByRole("table", { name: "手順の索引" })).toBeVisible({
    timeout: GENERATION_TIMEOUT,
  });
  await approveStage(page, 5, "主要処理の手順");

  // 段階6 処理ロジックの詳細: 05 の手順から関数を1つ選び、保存してから生成する
  await page.getByLabel("app/services/reservation.py の ReservationService.create").first().check();
  await page.getByRole("button", { name: "生成前に保存する" }).click();
  const generateTab = page.getByRole("button", { name: /^このタブの未生成を生成する/ });
  await generateTab.click();
  await expect(page.getByRole("tablist", { name: "関数ごとの詳細" })).toBeVisible({
    timeout: GENERATION_TIMEOUT,
  });
  await approveStage(page, 6, "処理ロジックの詳細(任意)");

  // 段階7 横断事項と実装計画
  await generateDraft(page);
  await approveStage(page, 7, "横断事項と実装計画");

  // Phase-30-7：更新
  // // 詳細設計書と実装計画の zip
  // // 段階8(実装手順書)は承認していないので、未承認は1件(zip の手順書は「未承認」になる)
  // await expect(page.getByText(/段階1〜8のうち 1 件が未承認です。/)).toBeVisible();
  // ↓↓
  // 詳細設計書と実装計画の zip(段階1〜7の承認で押せる)。実装手順書は段階8を承認するまで押せない
  await expect(page.getByRole("button", { name: "実装手順書をダウンロード(.zip)" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(page.getByText("段階8が未承認です。承認するとダウンロードできます。")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  // Phase-30-4：更新
  // await page.getByRole("button", { name: "詳細設計書と実装計画をダウンロード(.zip)" }).click();
  // ↓↓
  // Phase-30-7：更新
  // await page.getByRole("button", { name: "詳細設計書・実装計画・実装手順書をダウンロード(.zip)" }).click();
  // ↓↓
  await page.getByRole("button", { name: "詳細設計書・実装計画をダウンロード(.zip)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("detailed_design.zip");
  const path = await download.path();
  const content = await readFile(path);
  for (const name of BUNDLE_FILES) {
    expect(zipEntriesInclude(content, name), name).toBe(true);
  }

  // Phase-32-2:追記
  // 段階8 実装手順書: 段階7の全単位の手順書を生成する。承認するまで実装手順書の zip は押せない
  await expect(page.getByRole("heading", { name: "段階8 実装手順書" })).toBeVisible();
  await generateProcedureDocs(page, ["M-01-T01", "M-01-T02", "M-01-T03"]);
  await expect(page.getByRole("button", { name: "実装手順書をダウンロード(.zip)" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});
