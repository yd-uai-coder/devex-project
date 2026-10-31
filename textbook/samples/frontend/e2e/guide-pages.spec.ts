// 作成：Phase-118-6｜更新：Phase-118(完了後の調整2)
// 公開のページ(TOP と使い方ガイド)の E2E。ログインせずに TOP から使い方ガイドの目次へ移り、
// 流れの順に「次へ」で全ページをたどる。各ページで、見出し・流れの帯の今の段・画像の読み込み
// (next/image の最適化を通して public/guide の画像が返るか)を確かめる。流れの外のページ
// (クライアントの方へ・用語集)は目次から開く。API は呼ばない(ログインの復元の確認だけ)。
import { expect, type Page, test } from "@playwright/test";

import { GUIDE_FLOW, GUIDE_PAGES, type GuideSlug } from "../src/features/guide/guide-flow";

// ページの画像をすべて画面に入れて読み込ませ、壊れた画像が無いことを確かめる(遅延読み込みのため)
async function expectImagesLoaded(page: Page) {
  const images = page.locator("article img");
  const count = await images.count();
  for (let index = 0; index < count; index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty("complete", true);
    expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  }
}

async function expectGuidePage(page: Page, slug: GuideSlug) {
  await expect(page).toHaveURL(new RegExp(`/guide/${slug}$`));
  await expect(page.getByRole("heading", { level: 1, name: GUIDE_PAGES[slug].title })).toBeVisible();
  await expectImagesLoaded(page);
}

test("ログインせずに TOP から使い方ガイドへ移り、流れの順に全ページをたどれる", async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /クライアントとの合意を/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "はじめる" })).toHaveAttribute("href", "/register");
  await expect(page.getByRole("link", { name: /の使い方$/ })).toHaveCount(8);

  await page.getByRole("link", { name: "使い方を見る" }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole("heading", { level: 1, name: "使い方ガイド" })).toBeVisible();

  await page.getByRole("link", { name: `1. ${GUIDE_PAGES[GUIDE_FLOW[0]].title}` }).click();
  for (const [index, slug] of GUIDE_FLOW.entries()) {
    await expectGuidePage(page, slug);
    const band = page.getByRole("navigation", { name: "使い方の流れ" });
    await expect(band.locator('[aria-current="page"]')).toHaveAttribute("href", `/guide/${slug}`);
    if (index < GUIDE_FLOW.length - 1) {
      await page.getByRole("link", { name: /^次へ/ }).click();
    } else {
      await expect(page.getByRole("link", { name: /^次へ/ })).toHaveCount(0);
    }
  }

  for (const slug of ["for-clients", "glossary"] as GuideSlug[]) {
    await page.goto("/guide");
    // メニューにも同じ名前のリンクがあるので、目次の「ページの一覧」の中で探す
    const pages = page.getByRole("region", { name: "ページの一覧(流れの順)" });
    await pages.getByRole("link", { name: GUIDE_PAGES[slug].title, exact: true }).click();
    await expectGuidePage(page, slug);
  }
});

test("スマホ幅では流れの帯を1行にたたみ、押すと全段を開く", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/guide/agreement");

  // Phase-118(完了後の調整2)：更新
  // const toggle = page.getByRole("button", { name: `段 8 / 全 ${GUIDE_FLOW.length}: 合意と変更` });
  // ↓↓
  const toggle = page.getByRole("button", { name: `段 9 / 全 ${GUIDE_FLOW.length}: 合意と変更` });
  await expect(toggle).toBeVisible();
  const band = page.getByRole("navigation", { name: "使い方の流れ" });
  await expect(band.getByRole("link", { name: /はじめに/ })).toBeHidden();
  await toggle.click();
  await expect(band.getByRole("link", { name: /はじめに/ })).toBeVisible();
  // 横にはみ出さない
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});
