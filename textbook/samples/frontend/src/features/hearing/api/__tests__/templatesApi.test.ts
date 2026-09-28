// 作成：Phase-6-4
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listPromptTemplates } from "../templatesApi";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

describe("listPromptTemplates", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("GET /api/v1/prompt-templatesを呼ぶ", async () => {
    stub.queue({ status: 200, body: [] });

    await listPromptTemplates();

    expect(stub.requests[0].url).toContain("/api/v1/prompt-templates");
  });
});
