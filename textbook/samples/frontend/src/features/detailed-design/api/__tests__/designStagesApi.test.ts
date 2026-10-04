// 作成：Phase-15-6｜更新：Phase-16-5,17-5,18-5
// 写経レベル: 定型 ── API クライアント・型・そのテスト。
// Phase-16-5:追記 ── ../designStagesApi.generateDesignStage
// Phase-17-5:追記 ── ../types.MAX_DFD_GROUPS, @/features/detailed-design/test-utils/stageFixtures.makeDataFlow
// Phase-18-5:追記 ── ../types.ER_SUBJECT, @/features/detailed-design/test-utils/stageFixtures.makeCrud
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  approveDesignStage,
  generateDesignStage,
  listDesignStages,
  saveDesignStage,
} from "../designStagesApi";
import { ER_SUBJECT, MAX_DFD_GROUPS, type DesignStageRead } from "../types";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { makeCrud, makeDataFlow } from "@/features/detailed-design/test-utils/stageFixtures";

const STAGE1: DesignStageRead = {
  stage: 1,
  state: "reviewing",
  is_open: true,
  missing_inputs: [],
  version: 1,
  approved_version: null,
  model: { functions: [] },
  updated_at: "2026-10-01T00:00:00Z",
  // Phase-16-5:追記
  generation_status: null,
  generation_error: null,
  issues: [],
  // Phase-18-5:追記
  dfd_accesses: [],
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

  // Phase-17-5:追記
  it("段階2のデータフローもsaveDesignStageでそのまま送る", async () => {
    stub.queue({ status: 200, body: { ...STAGE1, stage: 2 } });
    const model = makeDataFlow(["reservations"]);

    await saveDesignStage("p1", 2, { version: 1, model });

    expect(stub.requests[0].url).toContain("/design-stages/2");
    expect(JSON.parse(stub.requests[0].init?.body as string).model).toEqual(model);
    expect(MAX_DFD_GROUPS).toBe(5);
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

  // Phase-16-5:追記
  it("generateDesignStageはPOST /design-stages/{stage}/generateを呼ぶ", async () => {
    stub.queue({
      status: 202,
      body: { ...STAGE1, generation_status: "generating" },
    });

    const accepted = await generateDesignStage("p1", 1);

    expect(accepted.generation_status).toBe("generating");
    expect(stub.requests[0].url).toContain(
      "/api/v1/projects/p1/design-stages/1/generate",
    );
    expect(stub.requests[0].init?.method).toBe("POST");
  });

  // Phase-18-5:追記
  it("段階3は CRUD 図を保存し、DFD から決まる R/W を受け取る", async () => {
    const accesses = [{ function_id: "F-01", table: "reservations", kind: "write" as const }];
    stub.queue({
      status: 200,
      body: { ...STAGE1, stage: 3, model: makeCrud("C", true), dfd_accesses: accesses },
    });

    const saved = await saveDesignStage("p1", 3, { version: 2, model: makeCrud("CU") });

    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({
      version: 2,
      model: { cells: [{ function_id: "F-01", table: "reservations", ops: "CU", draft: false }] },
    });
    expect(saved.dfd_accesses).toEqual(accesses);
    expect(ER_SUBJECT).toBe("");
  });
});
