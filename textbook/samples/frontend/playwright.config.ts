// 作成：Phase-4-3
import { defineConfig, devices } from "@playwright/test";

// devex-apiと同じ階層に配置されている前提(CLAUDE.md「Repository structure」: この2リポジトリは
// 兄弟ディレクトリとして並行運用される想定)。異なる配置の場合はDEVEX_API_DIR環境変数で上書きする。
const DEVEX_API_DIR = process.env.DEVEX_API_DIR ?? "../devex-api";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // 同一のdocker composeバックエンド(1プロセス・1DB)を複数テストで共有するため
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // docker composeのイメージビルド(初回)・Next.jsの初回コンパイルは数十秒かかりうるため、
  // 個々のwebServerにtimeoutを長めに設定する(既定の60秒だと初回実行で不安定になるため)。
  webServer: [
    {
      // --waitではなくフォアグラウンドの`up`を使う(webServerのcommandは動き続けるプロセスを
      // 期待する設計のため。urlが応答した時点でPlaywright側はテストへ進む)。
      command: `docker compose -f ${DEVEX_API_DIR}/docker-compose.yml -f ${DEVEX_API_DIR}/docker-compose.e2e.yml up`,
      url: "http://localhost:8000/health",
      name: "devex-api (E2E_FAKE_LLM=true)",
      timeout: 180 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      name: "devex-ui",
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
