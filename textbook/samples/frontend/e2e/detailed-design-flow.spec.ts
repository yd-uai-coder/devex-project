// 作成：Phase-24-3｜更新：24(ゴール3後の調整),30-4,30-7,32-2,50-2
// 写経レベル: コア ── 非同期の生成の待ち方・図の承認(自動レイアウト)・段階の承認の順序。
// 詳細設計モードの通しの E2E(Phase 24)。詳細設計モードでプロジェクトを作り、ヒアリング後に
// Phase-32-2：更新
// // 段階1〜7を生成・承認して、詳細設計書と実装計画の zip をダウンロードする。
// ↓↓
// 段階1〜7を生成・承認して、詳細設計書と実装計画の zip をダウンロードし、段階8の手順書を生成する
// Phase-50-2：更新
// // (段階8の承認と実装手順書の zip は、devex-api の契約テストが通す)。
// ↓↓
// (段階8の承認と実装手順書の zip は、devex-api の契約テストが通す)。続けて、段階1の処理を1つ直して
// 承認し直し、下流の段階に付いた「変更の影響」の印を確認済みにしてから段階2を承認し直す(印の付き方は
// devex-api の tests/unit/test_fake_llm_change_impact.py が固定している)。
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
// Phase-50-2：更新
// // 取り違えないよう、ボタンの名前は exact で探す。
// ↓↓
// 取り違えないよう、ボタンの名前は全体で照合する(入力が変わった「古い」段階では「このまま承認し直す」)。
function stageApproveButton(page: Page): Locator {
  // Phase-50-2：更新
  // return page.getByRole("button", { name: "承認する", exact: true });
  // ↓↓
  return page.getByRole("button", { name: /^(承認する|このまま承認し直す)$/ });
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

// Phase-50-2:追記
// 段階のステッパーで段階を選ぶ(名前は「段階N 題名(状態)」)。
async function selectStage(page: Page, stage: number, title: string) {
  await page.getByRole("button", { name: new RegExp(`^段階${stage} ${title}\\(`) }).click();
  await expect(page.getByRole("heading", { name: `段階${stage} ${title}` })).toBeVisible();
}

// 「変更の影響」パネル。印が付く前から画面にあると、たたんだまま出るので開く。
async function openImpactPanel(page: Page): Promise<Locator> {
  const panel = page.getByRole("region", { name: "変更の影響" });
  await expect(panel).toBeVisible({ timeout: GENERATION_TIMEOUT });
  const toggle = panel.getByRole("button", { name: "開く" });
  if (await toggle.isVisible()) await toggle.click();
  return panel;
}

// zip のファイル名は、ローカルファイルヘッダに平文(UTF-8)で入るので、展開せずに探せる。
function zipEntriesInclude(content: Buffer, name: string): boolean {
  return content.includes(Buffer.from(name, "utf-8"));
}

// Phase-32-2：更新
// test("詳細設計モードで段階1〜7を承認し、詳細設計書と実装計画の zip をダウンロードする", async ({
// ↓↓
// Phase-50-2：更新
// test("詳細設計モードで段階1〜7を承認して詳細設計書と実装計画の zip をダウンロードし、段階8の手順書を生成する", async ({
// ↓↓
test("詳細設計モードで段階1〜7を承認して詳細設計書と実装計画の zip をダウンロードし、段階8の手順書を生成して、段階1の変更の影響を確かめて承認し直す", async ({
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

  // Phase-50-2:追記
  // 変更の影響: 段階1の F-01 の概要を直して保存すると、承認する前から下流に届く印(承認すると届く)が見える。
  // パネルは選んでいる段階に届いた印だけを出すので、直した段階1では「全段階」に切り替えて見る
  await selectStage(page, 1, "機能一覧");
  const summary = page.getByLabel("F-01 の概要");
  await summary.fill(`${await summary.inputValue()}(取消の期限も検証する)`);
  await saveStage(page);
  const panel = await openImpactPanel(page);
  await panel.getByRole("button", { name: "全段階" }).click();
  await expect(panel.getByRole("table", { name: "変わったもの" })).toContainText("fn:F-01");
  await expect(panel).toContainText("(承認すると届く)");

  // 段階1を承認し直すと印が記録され、段階2〜7 に計7つの見直しの印が付く(段階8はまだ承認していないので付かない)
  await approveStage(page, 1, "機能一覧");
  await expect(page.getByRole("heading", { name: "段階2 データフロー" })).toBeVisible();
  await expect(panel).toContainText("変更の影響(未確認 7)");
  await expect(page.getByRole("button", { name: "段階2 データフロー(古い)" })).toContainText(
    "見直し 1",
  );

  // 未確認の印が残る段階2は承認できない(押すと理由が出る)。確認済みにすると承認し直せる
  await expect(
    page.getByText("他の段階・文書から届いた見直しの印は、確認済みにしてから承認し直してください。"),
  ).toBeVisible();
  await stageApproveButton(page).click();
  await expect(page.getByText(/見直しの印が残っています/)).toBeVisible();
  await panel.getByRole("button", { name: "段階2(未確認 1)" }).click();
  await expect(panel).toContainText("summary:F-01");
  await panel.getByRole("button", { name: "この段階の未確認をすべて確認済みにする" }).click();
  await expect(panel).toContainText("変更の影響(未確認 6)");
  await approveStage(page, 2, "データフロー");
});
