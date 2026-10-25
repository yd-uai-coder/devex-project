// devex-ui をヘッドレスの Chromium で開き、ログインしてページを撮る(画面確認用)。
// devex-ui の中から動かす(@playwright/test は devex-ui の node_modules から読む):
//   cd devex-ui && node ../.claude/skills/run-devex-ui/shot.mjs <パス> [--steps <手順.mjs>] [--out <dir>] [--wait <文字>]
// 環境変数: DEVEX_EMAIL・DEVEX_PASSWORD(既定は E2E の固定パスワード)・DEVEX_UI_URL(既定 http://localhost:3000)
// --steps の手順ファイルは `export default async function (page, shot) {...}` を書く(shot(名前) で撮る)。
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = createRequire(resolve(process.cwd(), "package.json"))("@playwright/test");

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const stepsFile = opt("--steps");
const out = resolve(opt("--out") ?? "/tmp/devex-ui-shots");
const waitText = opt("--wait");
const path = args[0] ?? "/dashboard";
const base = process.env.DEVEX_UI_URL ?? "http://localhost:3000";
const email = process.env.DEVEX_EMAIL;
const password = process.env.DEVEX_PASSWORD ?? "S3cret-pass";
if (!email) {
  console.error("DEVEX_EMAIL を指定してください(SKILL.md の「ログインする利用者」)");
  process.exit(2);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 300)}`));
page.on("console", (m) => {
  // 応答の失敗は下の response で URL つきで出すので、ここでは React などの誤りだけを拾う
  if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) {
    problems.push(`console: ${m.text().slice(0, 300)}`);
  }
});
page.on("response", (r) => {
  if (r.status() >= 400) problems.push(`${r.status()} ${r.request().method()} ${r.url().replace(base, "")}`);
});

let n = 0;
const shot = async (name) => {
  n += 1;
  const file = `${out}/${String(n).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log("SHOT", file);
};

try {
  await page.goto(`${base}/login`);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.goto(`${base}${path}`);
  if (waitText) await page.getByText(waitText).first().waitFor({ timeout: 30000 });
  else await page.waitForLoadState("networkidle");
  await shot("page");
  if (stepsFile) {
    const steps = (await import(pathToFileURL(resolve(stepsFile)).href)).default;
    await steps(page, shot);
  }
} catch (err) {
  await shot("failed").catch(() => {});
  console.error("FAILED", String(err).split("\n").slice(0, 6).join("\n"));
  process.exitCode = 1;
} finally {
  console.log("PROBLEMS", JSON.stringify(problems, null, 1));
  await browser.close();
}
