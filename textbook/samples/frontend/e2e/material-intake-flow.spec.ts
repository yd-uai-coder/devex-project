// 作成：Phase-117-2
// 変更の取り込みの E2E。詳細設計モードで文書まで作り、合意済みの版 B-1 を作ってから、議事録を資料として
// 足し、B-1 と比べて違いを取り出す。確かめる点は理由をつけて閉じ、追加・変更の2件を選んで CR の下書きに
// する。下書きの中身(背景の出どころ・対象の要件)と、資料の側の「CR-1 にした」までを画面で通す
// (docs/external_design.md 2.17節)。
//
// 偽の LLM は、資料の本文の印(`[違い:<種類>:<キー>]`)のある行ごとに違いを1件返す。引用は印を除いた行の
// 文なので、検査(引用が資料にある・対象のキーが束にある)は本物と同じに働く。束に無いキーの行は弾かれる。
import { expect, test } from "@playwright/test";

import { completeHearing, createProject, registerAndLogin } from "./helpers";

const GENERATION_TIMEOUT = 30 * 1000;

const ADDED = "予約が決まったら確認のメールを送ってほしい。";
const CHANGED = "予約は30日先まで受け付けるように変えたい。";
const QUESTION = "会議室の定員を画面に出すかは次回に決める。";
const UNKNOWN = "存在しない要件の扱いを相談したい。";

const MINUTES = [
  "# 定例打ち合わせ 議事録",
  "",
  `- ${ADDED}[違い:add:req:FR-001]`,
  `- ${CHANGED}[違い:change:req:FR-001]`,
  `- ${QUESTION}[違い:question:-]`,
  `- ${UNKNOWN}[違い:change:req:FR-999]`,
  "- 次回は来週の月曜に行う。",
].join("\n");

test("資料を足して違いを取り出し、選んだ違いから CR の下書きを作る", async ({ page }) => {
  // ヒアリングから文書の生成を含むので、既定の30秒では足りない
  test.setTimeout(4 * 60 * 1000);
  await registerAndLogin(page, "e2e-intake", "E2E Intake");

  await createProject(page, "detailed", {
    name: `予約の取り込み ${Date.now()}`,
    overview: "会議室の予約システム",
    goal: "予約を一覧で確かめたい",
  });
  await completeHearing(page, ["会議室を予約したい", "社員だけが使う", "履歴も見たい"]);

  // ── B-1: 違いを比べる相手の合意済みの版
  await page.getByRole("link", { name: "合意済みの版", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/baselines$/);
  await page.getByRole("button", { name: "合意済みの版を作る" }).click();
  await page.getByLabel("理由").fill("初回のヒアリングの内容で合意した");
  await page.getByRole("button", { name: "合意済みの版を作る", exact: true }).last().click();
  await expect(page).toHaveURL(/\/baselines\/1$/);

  // ── 資料の一覧から議事録を足す(足すと資料のページへ移る)
  await page.goto(page.url().replace(/\/baselines\/1$/, "/materials"));
  await expect(page.getByText("資料はまだありません。")).toBeVisible();
  await page.getByRole("button", { name: "資料を足す" }).click();
  await page.getByLabel("タイトル").fill("定例打ち合わせ 議事録");
  // 本文の欄のラベルには文字数の表示も入るので、先頭で当てる
  await page.getByRole("textbox", { name: /^本文/ }).fill(MINUTES);
  await page.getByRole("button", { name: "資料を足す" }).last().click();
  await expect(page).toHaveURL(/\/materials\/[^/]+$/);
  await expect(page.getByLabel("資料の本文")).toContainText(ADDED);
  await expect(page.getByText("まだ違いを取り出していません。")).toBeVisible();

  // ── 最新の版 B-1 と比べて違いを取り出す
  await page.getByRole("button", { name: "最新の版 B-1 と比べて違いを取り出す" }).click();
  const unconfirmed = page.getByRole("table", { name: "違い(未確認)" });
  await expect(unconfirmed).toBeVisible({ timeout: GENERATION_TIMEOUT });
  await expect(unconfirmed.getByRole("row")).toHaveCount(4); // 見出し + 追加・変更・確かめる点
  // 束に無いキーの違いは、理由つきで「弾いた」に出る(CR にできない)
  const rejected = page.getByRole("table", { name: "違い(弾いた)" });
  await expect(rejected).toContainText(UNKNOWN);
  await expect(rejected).toContainText("弾いた(検査)");

  // ── 確かめる点は理由をつけて閉じる
  const questionRow = unconfirmed.getByRole("row").filter({ hasText: QUESTION });
  await questionRow.getByRole("button", { name: "閉じる(理由)" }).click();
  await page.getByLabel("理由", { exact: true }).fill("次回の打ち合わせで確かめる");
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(page.getByRole("table", { name: "違い(捨てた)" })).toContainText(
    "閉じた: 次回の打ち合わせで確かめる",
  );

  // ── 追加と変更を選んで、1つの CR の下書きにする
  await page.getByRole("checkbox", { name: `「[E2E Fake] ${ADDED}」を選ぶ` }).check();
  await page.getByRole("checkbox", { name: `「[E2E Fake] ${CHANGED}」を選ぶ` }).check();
  await expect(page.getByText("2 件を選んでいます。", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "選んだ違いから CR の下書きを作る" }).click();

  // CR の詳細(下書き)。背景は資料の題と日付、対象は変更の FR-001、新しい要件の起点も FR-001
  await expect(page).toHaveURL(/\/change-requests\/1$/, { timeout: GENERATION_TIMEOUT });
  await expect(page.getByLabel("状態: 下書き", { exact: true })).toBeVisible();
  await expect(page.getByText("資料「定例打ち合わせ 議事録」", { exact: false })).toBeVisible();
  await expect(page.getByRole("table", { name: "対象の要件" })).toContainText("FR-001");

  // ── 資料のページに戻ると、選んだ2件は「CR-1 にした」に移っている
  await page.goBack();
  const converted = page.getByRole("table", { name: "違い(CR にした)" });
  await expect(converted.getByRole("link", { name: "CR-1 にした" })).toHaveCount(2);
  await expect(page.getByRole("table", { name: "違い(未確認)" })).toHaveCount(0);
});
