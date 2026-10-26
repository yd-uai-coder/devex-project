// 作成：Phase-110-2
// 共有リンク(ステージ13)の E2E。詳細設計モードで文書まで作り、合意済みの版 B-1 から CR を作って
// 案を2つ書き、共有タブでリンクを作る(CR は説明済みになる)。クライアントはログインせずにリンクを開き、
// 説明書と案を読んで、名前・コメント・案を選んで合意する。開発者の側では、合意の記録の出どころが
// 共有リンクになり、コメントに返信できる、までを画面で通す(docs/external_design.md 2.16節)。
//
// 認証なしの入口は回数の上限がある(開発用の compose は 1000回)。リンクの URL は作った直後だけ画面に
// 出るので、そこで読む。
import { expect, type Page, test } from "@playwright/test";

import { completeHearing, createProject, registerAndLogin } from "./helpers";

const GENERATION_TIMEOUT = 30 * 1000;
const CLIENT = "総務部 山田";

async function expectStatus(page: Page, label: string) {
  await expect(page.getByLabel(`状態: ${label}`, { exact: true })).toBeVisible({ timeout: GENERATION_TIMEOUT });
}

async function openTab(page: Page, name: string) {
  await page.getByRole("tab", { name }).click();
}

// 案の編集の1枠(名前・FR-001 を変える・変更後の案・結果)
async function fillOption(page: Page, number: number, name: string, proposal: string, outcome: string) {
  const label = `案${number}`;
  const editor = page.getByLabel(`${label}の編集`);
  await editor.getByLabel("名前").fill(name);
  await editor.getByLabel(`${label}で FR-001 を変える`).check();
  await editor.getByLabel(`${label}の FR-001 の変更後の案`).fill(proposal);
  await editor.getByLabel("結果(手間・影響・トレードオフ)").fill(outcome);
}

test("CR の案を共有リンクでクライアントに見せ、クライアントがコメントして案を選び合意する", async ({ page, browser }) => {
  // ヒアリングから文書の生成を含むので、既定の30秒では足りない
  test.setTimeout(4 * 60 * 1000);
  await registerAndLogin(page, "e2e-share", "E2E Share");

  await createProject(page, "detailed", {
    name: `予約の共有 ${Date.now()}`,
    overview: "会議室の予約システム",
    goal: "予約を一覧で確かめたい",
  });
  await completeHearing(page, ["会議室を予約したい", "社員だけが使う", "履歴も見たい"]);

  // ── B-1 → CR-1(対象 FR-001)
  await page.getByRole("link", { name: "合意済みの版", exact: true }).click();
  await page.getByRole("button", { name: "合意済みの版を作る" }).click();
  await page.getByLabel("理由").fill("初回のヒアリングの内容で合意した");
  await page.getByRole("button", { name: "合意済みの版を作る", exact: true }).last().click();
  await expect(page).toHaveURL(/\/baselines\/1$/);
  await page.getByRole("button", { name: "この版を基準に変更要求を作る →" }).click();
  await page.getByLabel("タイトル").fill("予約の取り消し");
  await page.getByLabel("内容").fill("予約を取り消せるようにしてほしい");
  await page.getByLabel("足す要件").selectOption("FR-001");
  await page.getByRole("button", { name: "対象に足す" }).click();
  await page.getByLabel("FR-001 の変更後の案").fill("会議室の予約を登録し、取り消せる。");
  await page.getByRole("button", { name: "下書きで作る" }).click();
  await expect(page).toHaveURL(/\/change-requests\/1$/);
  const crUrl = page.url();

  // ── 内容タブで案を2つ書く(おすすめは案1)
  await page.getByRole("button", { name: "案を書く" }).click();
  await page.getByRole("button", { name: "案を2つ足す" }).click();
  await fillOption(page, 1, "いつでも取り消せる", "会議室の予約を登録し、いつでも取り消せる。", "手間は小さい。直前の取り消しで空きが出る");
  await fillOption(page, 2, "前日まで取り消せる", "会議室の予約を登録し、前日まで取り消せる。", "期限の判定が要る。直前の空きは出ない");
  await page.getByLabel("おすすめの案").selectOption("1");
  await page.getByLabel("おすすめの理由").fill("運用の決まりが要らない");
  await page.getByRole("button", { name: "案を保存する", exact: true }).click();
  const options = page.getByLabel("選択肢", { exact: true });
  await expect(options).toContainText("おすすめは案1です。理由: 運用の決まりが要らない");

  // ── 共有タブでリンクを作る → CR は説明済み。URL は作った直後だけ出る
  await openTab(page, "共有");
  await page.getByRole("button", { name: "共有リンクを作る" }).click();
  const create = page.getByRole("dialog", { name: "共有リンクを作る" });
  await expect(create).toContainText("作ると、CR は説明済みになります。");
  await create.getByRole("button", { name: "作る", exact: true }).click();
  const created = page.getByLabel("作ったリンク");
  await expect(created).toBeVisible();
  // URL の行だけを読む(枠の全体の文字列では、すぐ後ろのボタンの「URL をコピー」がつながる)
  const shareUrl = (await created.getByText(/\/share\//).textContent())?.trim();
  expect(shareUrl).toMatch(/^https?:\/\/[^/]+\/share\/[A-Za-z0-9_-]+$/);
  await expectStatus(page, "説明済み");

  // ── クライアント: ログインしていない別のブラウザで開く
  const clientContext = await browser.newContext();
  const client = await clientContext.newPage();
  await client.goto(shareUrl as string);
  await expect(client.getByRole("heading", { name: "CR-1 予約の取り消し" })).toBeVisible();
  await expect(client.getByLabel("状態: 開いている")).toBeVisible();
  const markdown = client.getByLabel("変更の説明書");
  await expect(markdown).toContainText("いつでも取り消せる");
  await expect(markdown).toContainText("前日まで取り消せる");
  // 開発者の画面のメニューは無い
  await expect(client.getByRole("link", { name: "ダッシュボード" })).toHaveCount(0);

  await client.getByLabel("お名前").fill(CLIENT);
  await client.getByLabel("コメントの本文").fill("直前の取り消しは何分前までですか");
  await client.getByRole("button", { name: "コメントを送る" }).click();
  await expect(client.getByLabel(`${CLIENT}のコメント`, { exact: true })).toContainText("直前の取り消しは何分前までですか");

  // 案を選ばずに合意は押せない → 案1 を選んで合意
  await client.getByRole("radio", { name: "案1 いつでも取り消せる" }).check();
  await client.getByRole("button", { name: "合意する", exact: true }).click();
  const confirm = client.getByRole("dialog", { name: "この変更に合意しますか" });
  await expect(confirm).toContainText("選んだ案: 案1 いつでも取り消せる。");
  await confirm.getByRole("button", { name: "合意を記録する" }).click();
  const decision = client.getByLabel("判断の結果");
  await expect(decision).toContainText("選んだ案: 案1 いつでも取り消せる");
  await expect(decision).toContainText(`判断した人: ${CLIENT}`);
  await expect(client.getByLabel("状態: 判断済み")).toBeVisible();

  // ── 開発者: 合意になり、記録の出どころは共有リンク。コメントに返信する
  await page.goto(crUrl);
  await expectStatus(page, "合意");
  const record = page.getByLabel("合意の記録");
  await expect(record).toContainText(`相手: ${CLIENT}`);
  await expect(record).toContainText("選んだ案: 案1");
  await expect(record).toContainText("出どころ: 共有リンク");

  await openTab(page, "共有");
  await page.getByLabel(`${CLIENT}のコメントへの返信`).fill("予約の開始の時刻まで取り消せます");
  await page.getByRole("button", { name: "返信する" }).click();
  await expect(page.getByLabel(`${CLIENT}のコメント`, { exact: true })).toContainText("予約の開始の時刻まで取り消せます");

  // クライアントの画面にも返信が出る(手で読み直す)
  await client.getByRole("button", { name: "読み直す" }).click();
  await expect(client.getByLabel(`${CLIENT}のコメント`, { exact: true })).toContainText("予約の開始の時刻まで取り消せます");
  await clientContext.close();
});
