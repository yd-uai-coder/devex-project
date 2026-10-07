// 作成：Phase-15-6｜更新：Phase-16-5,17-5,18-5,20-4,21-4,22-6,28-3,28-4
// 写経レベル: 定型 ── API クライアント・型・そのテスト。
// Phase-16-5:追記 ── ../designStagesApi.generateDesignStage
// Phase-17-5:追記 ── ../types.MAX_DFD_GROUPS, @/features/detailed-design/test-utils/stageFixtures.makeDataFlow
// Phase-18-5:追記 ── ../types.ER_SUBJECT, @/features/detailed-design/test-utils/stageFixtures.makeCrud
// Phase-22-6:追記 ── vitest.vi, ../designStagesApi.downloadDetailedDesign
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveDesignStage,
  downloadDetailedDesign,
  generateDesignStage,
  // Phase-28-4:追記
  getUnitContext,
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
    // Phase-20-4:追記
    expect(stub.requests[0].init?.body).toBeUndefined();
  });

  // Phase-20-4:追記
  it("段階5は下書きを作る処理を本文の function_ids で渡す(指定が無ければ本文なし)", async () => {
    stub.queue({ status: 202, body: { ...STAGE1, stage: 5, generation_status: "generating" } });

    await generateDesignStage("p1", 5, ["F-02"]);

    expect(stub.requests[0].url).toContain("/api/v1/projects/p1/design-stages/5/generate");
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({ function_ids: ["F-02"] });
  });

  // Phase-21-4:追記
  it("段階6は下書きを作る関数を本文の logics で渡す", async () => {
    stub.queue({ status: 202, body: { ...STAGE1, stage: 6, generation_status: "generating" } });
    const logics = [{ module: "app/services/reservation.py", function: "create" }];

    await generateDesignStage("p1", 6, undefined, logics);

    expect(stub.requests[0].url).toContain("/api/v1/projects/p1/design-stages/6/generate");
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({ logics });
  });

  // Phase-18-5:追記
  // Phase-28-3:追記
  it("段階8は手順書を作る単位を本文の unit_ids で渡す", async () => {
    stub.queue({ status: 202, body: { ...STAGE1, stage: 8, generation_status: "generating" } });

    await generateDesignStage("p1", 8, undefined, undefined, ["M-01-T02"]);

    expect(stub.requests[0].url).toContain("/api/v1/projects/p1/design-stages/8/generate");
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({ unit_ids: ["M-01-T02"] });
  });

  // Phase-28-4:追記
  it("getUnitContextはGET /design-stages/units/{unit_id}/contextを呼ぶ", async () => {
    const context = { unit_id: "M-01-T02", refs: [], crosscutting: "", environment: "" };
    stub.queue({ status: 200, body: context });

    const read = await getUnitContext("p1", "M-01-T02");

    expect(read).toEqual(context);
    expect(stub.requests[0].url).toContain(
      "/api/v1/projects/p1/design-stages/units/M-01-T02/context",
    );
  });

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

// Phase-22-6:追記
describe("downloadDetailedDesign", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET .../design-stages/document の zip を Blob のまま受け取り、ファイル名を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="detailed_design.zip"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadDetailedDesign("p1");

    expect(String(fetchMock.mock.calls[0][0])).toMatch(
      /\/api\/v1\/projects\/p1\/design-stages\/document$/,
    );
    expect(result.filename).toBe("detailed_design.zip");
    expect(result.content).toBeInstanceOf(Blob);
    expect(result.content.size).toBe(4);
  });
});
