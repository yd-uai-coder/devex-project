// 作成：Phase-15-6
// 写経レベル: 定型 ── API クライアント・型・そのテスト。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  approveDesignStage,
  listDesignStages,
  saveDesignStage,
} from "../designStagesApi";
import type { DesignStageRead } from "../types";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

const STAGE1: DesignStageRead = {
  stage: 1,
  state: "reviewing",
  is_open: true,
  missing_inputs: [],
  version: 1,
  approved_version: null,
  model: { functions: [] },
  updated_at: "2026-10-01T00:00:00Z",
};

describe("designStagesApi", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("listDesignStagesはGET /design-stagesを呼ぶ", async () => {
    stub.queue({ status: 200, body: [STAGE1] });

    const stages = await listDesignStages("p1");

    expect(stages[0].state).toBe("reviewing");
    expect(stub.requests[0].url).toContain("/api/v1/projects/p1/design-stages");
    expect(stub.requests[0].init?.method).toBeUndefined();
  });

  it("saveDesignStageはPUTでversionとmodelを送る", async () => {
    stub.queue({ status: 200, body: STAGE1 });

    await saveDesignStage("p1", 1, { version: null, model: { functions: [] } });

    const request = stub.requests[0];
    expect(request.url).toContain("/api/v1/projects/p1/design-stages/1");
    expect(request.init?.method).toBe("PUT");
    expect(JSON.parse(request.init?.body as string)).toEqual({
      version: null,
      model: { functions: [] },
    });
  });

  it("approveDesignStageはPOST /approveでversionを送る", async () => {
    stub.queue({
      status: 200,
      body: { ...STAGE1, state: "approved", approved_version: 1 },
    });

    const approved = await approveDesignStage("p1", 1, 1);

    expect(approved.state).toBe("approved");
    const request = stub.requests[0];
    expect(request.url).toContain(
      "/api/v1/projects/p1/design-stages/1/approve",
    );
    expect(request.init?.method).toBe("POST");
    expect(JSON.parse(request.init?.body as string)).toEqual({ version: 1 });
  });
});
