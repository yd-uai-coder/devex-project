// 作成：Phase-67-4
// SUT: llmSettingsApi(getLlmCatalog・getModelSettings・updateModelSettings・getApiKeys・
// registerApiKey・deleteApiKey)
// ドライバ: 各テスト
// スタブ: fetch(stubFetch。送ったメソッド・パス・本文を見る)
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import {
  deleteApiKey,
  getApiKeys,
  getLlmCatalog,
  getModelSettings,
  registerApiKey,
  updateModelSettings,
} from "../llmSettingsApi";

describe("llmSettingsApi", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("各操作を対応するメソッド・パス・本文で送り、設定は settings を取り出す", async () => {
    stub.queue({ body: { providers: [], models: [], purposes: [] } });
    stub.queue({ body: { settings: [{ purpose: "chat" }] } });
    stub.queue({ body: { settings: [] } });
    stub.queue({ body: { encryption_available: true, keys: [] } });
    stub.queue({ body: { provider: "claude", key_hint: "4321", needs_reregister: false } });

    await getLlmCatalog();
    const settings = await getModelSettings();
    await updateModelSettings([{ purpose: "judge", provider: "claude", model: "claude-haiku-5-5" }]);
    await getApiKeys();
    await registerApiKey("claude", "sk-ant-4321");
    await deleteApiKey("claude");

    expect(settings).toEqual([{ purpose: "chat" }]);
    const sent = stub.requests.map((r) => [r.init?.method ?? "GET", new URL(r.url).pathname, r.init?.body]);
    expect(sent).toEqual([
      ["GET", "/api/v1/llm/catalog", undefined],
      ["GET", "/api/v1/users/me/models", undefined],
      [
        "PUT",
        "/api/v1/users/me/models",
        JSON.stringify({ choices: [{ purpose: "judge", provider: "claude", model: "claude-haiku-5-5" }] }),
      ],
      ["GET", "/api/v1/users/me/api-keys", undefined],
      ["PUT", "/api/v1/users/me/api-keys/claude", JSON.stringify({ api_key: "sk-ant-4321" })],
      ["DELETE", "/api/v1/users/me/api-keys/claude", undefined],
    ]);
  });
});
