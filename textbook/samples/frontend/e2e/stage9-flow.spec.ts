// 作成：Phase-72-1
// ステージ9の使い勝手とマイページの E2E。一般の利用者で、認証ページの振り分け・モード選択・
// 一覧の検索と削除・マイページの API キーとモデル・ログアウトを通しで確かめる。
// backend は E2E_FAKE_LLM=true で起動する(キーの確かめで外部の API を呼ばず、LLM も偽物になる)。
// 暗号の鍵は docker-compose.e2e.yml の E2E 専用の値を使う。
import { expect, test } from "@playwright/test";
import { completeHearing, createProject, registerAndLogin } from "./helpers";

test("一般の利用者が、一覧の検索と削除・自分の Claude キーでレビューのパネル・ログアウトまでを通す", async ({
  page,
}) => {
  // ヒアリングから文書の生成まで含むので、既定の30秒では足りない
  test.setTimeout(3 * 60 * 1000);
  await registerAndLogin(page, "e2e-stage9", "E2E Stage9");

  // ログイン中に認証ページを開くと、ダッシュボードへ振り分ける(proxy とログインの印の cookie)
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard/);

  // モードを付けずに作成画面を開くと、モード選択のダイアログが出る
  await page.goto("/projects/new");
  await expect(page.getByText("モードを選んでください")).toBeVisible();
  await page.getByRole("button", { name: "簡易ドキュメントモードで作成する" }).click();
  await expect(page).toHaveURL(/\/projects\/new\?mode=simple/);

  // 名前の違う2つのプロジェクトを作る(1つ目はヒアリングを終えて文書まで作る)
  const suffix = Date.now();
  const kept = `備品予約${suffix}`;
  const removed = `会議室予約${suffix}`;
  await page.getByLabel("プロジェクト名").fill(kept);
  await page.getByLabel("システム概要").fill("備品の予約システムを作りたい");
  await page.getByLabel("実現したいこと").fill("備品の貸し出しの重なりを無くしたい");
  await page.getByRole("button", { name: "ヒアリングを始める" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/chat/);
  await completeHearing(page, [
    "利用者は総務の担当者と社員です",
    "MVPでは予約の登録と一覧のみ作ります",
    "特にありません",
  ]);
  const documentsUrl = page.url();

  // ヘッダーのタイトルはトップへのリンク
  await page.getByRole("link", { name: "Devex", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/dashboard");
  await createProject(page, "simple", {
    name: removed,
    overview: "会議室の予約システムを作りたい",
    goal: "会議室の空きをすぐ見たい",
  });

  // 検索語は Enter で確定し、条件は URL に載る
  await page.goto("/dashboard");
  const search = page.getByLabel("タイトルで検索");
  await search.fill(`会議室予約${suffix}`);
  await search.press("Enter");
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(page.getByRole("link", { name: new RegExp(`^${removed}`) })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`^${kept}`) })).toHaveCount(0);

  // 削除は確認のダイアログを通し、トーストで知らせて一覧から外す
  // (トーストは読み上げ用の「通知 …」も別に持つので、文言は完全一致で探す)
  await page.getByRole("button", { name: `「${removed}」を削除` }).click();
  await expect(page.getByText("プロジェクトを削除しますか")).toBeVisible();
  await page.getByRole("button", { name: "削除する" }).click();
  await expect(page.getByText(`「${removed}」を削除しました`, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`^${removed}`) })).toHaveCount(0);

  // 一般の利用者には、レビューのパネルが出ない
  await page.goto(documentsUrl);
  await expect(page.getByRole("tab", { name: "要件定義" })).toBeVisible();
  await expect(page.getByLabel("AI 設計レビュー", { exact: true })).toHaveCount(0);

  // マイページで自分の Claude キーを登録する(E2E_FAKE_LLM では確かめを飛ばして保存する)
  await page.goto("/mypage");
  await page.getByRole("button", { name: "API キー" }).click();
  await page.getByLabel("Claude の API キー").fill("sk-ant-e2e-fake-key-0001");
  await page.getByRole("button", { name: "Claude のキーを保存する" }).click();
  await expect(page.getByText("登録済み(末尾 …0001)")).toBeVisible();

  // キーを登録すると、レビューの用途に Claude のモデルを選べる
  await page.getByRole("button", { name: "モデル" }).click();
  const review = page.getByRole("radiogroup", { name: "レビュー" });
  await review.getByRole("radio", { name: "Claude", exact: true }).click();
  await page.getByLabel("モデル", { exact: true }).last().selectOption("claude-haiku-5-5");
  await page.getByRole("button", { name: "モデルを保存する" }).click();
  await expect(page.getByText("モデルを保存しました", { exact: true })).toBeVisible();

  // 自分のキーでレビューを使えるので、文書の画面にレビューのパネルが出る(初期値はオフ)
  await page.goto(documentsUrl);
  const panel = page.getByLabel("AI 設計レビュー", { exact: true });
  await expect(panel.getByRole("checkbox", { name: "AI 設計レビューを使う" })).not.toBeChecked();

  // メニューからログアウトするとトップへ戻り、ログインの印が消えるので認証ページを開ける
  await page.getByRole("button", { name: "メニューを開く" }).first().click();
  const menu = page.getByTestId("menu");
  // グループは閉じているので、Authentication を開いてから押す
  await menu.getByRole("button", { name: "Authentication" }).click();
  await menu.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "ログイン" })).toBeVisible();
});
