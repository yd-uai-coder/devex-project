// 作成：Phase-15-7｜更新：Phase-16-6,18-9,18-9
// 写経レベル: コア ── 版の競合と、承認後の取り直し。
// Phase-16-6:追記 ── ../test-utils/stageFixtures.makeFunctionList
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  firstPendingStage,
  useDetailedDesignStore,
} from "../detailed-design-store";
import { makeFunctionList, makeStages } from "../test-utils/stageFixtures";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

function resetStore() {
  useDetailedDesignStore.setState({
    projectId: null,
    stages: [],
    selectedStage: 1,
    status: "idle",
    error: null,
    actionError: null,
    approving: false,
    // Phase-16-6:追記
    saving: false,
    requestingGeneration: false,
  });
}

describe("useDetailedDesignStore", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    resetStore();
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("firstPendingStageは承認されていない最初の段階を返す", () => {
    expect(firstPendingStage(makeStages({ 1: { state: "approved" } }))).toBe(2);
    expect(
      firstPendingStage(
        makeStages(
          Object.fromEntries(
            [1, 2, 3, 4, 5, 6, 7].map((n) => [n, { state: "approved" }]),
          ),
        ),
      ),
    ).toBe(7);
  });

  it("fetchStagesは一覧を保持し、初回は承認されていない最初の段階を選ぶ", async () => {
    stub.queue({
      status: 200,
      body: makeStages({ 1: { state: "approved", version: 1 } }),
    });

    await useDetailedDesignStore.getState().fetchStages("p1");

    const state = useDetailedDesignStore.getState();
    expect(state.status).toBe("success");
    expect(state.stages).toHaveLength(7);
    expect(state.selectedStage).toBe(2);
  });

  it("詳細設計モードでないプロジェクトはエラーを表示する", async () => {
    stub.queue({
      status: 409,
      body: {
        detail: "Project p1 is not in detailed design mode",
        code: "DESIGN_STAGES_NOT_AVAILABLE",
      },
    });

    await useDetailedDesignStore.getState().fetchStages("p1");

    expect(useDetailedDesignStore.getState().status).toBe("error");
  });

  it("approveは見ていた版で承認し、全段階を取り直す", async () => {
    useDetailedDesignStore.setState({
      projectId: "p1",
      stages: makeStages({ 1: { state: "reviewing", version: 3 } }),
    });
    stub.queue({ status: 200, body: {} });
    stub.queue({
      status: 200,
      body: makeStages({ 1: { state: "approved", version: 3 } }),
    });

    // Phase-18-9：更新
    // await useDetailedDesignStore.getState().approve("p1", 1);
    // ↓↓
    const approved = await useDetailedDesignStore.getState().approve("p1", 1);

    // Phase-18-9:追記
    expect(approved).toBe(true);
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({
      version: 3,
    });
    expect(stub.requests[1].url).toContain("/design-stages");
    expect(useDetailedDesignStore.getState().stages[0].state).toBe("approved");
  });

  // Phase-18-9:追記
  it("図が未承認なら、承認の API を呼ばずに理由を出す(Phase 18)", async () => {
    useDetailedDesignStore.setState({
      projectId: "p1",
      stages: makeStages({
        1: { state: "reviewing", version: 3, issues: [{ severity: "error" as const, code: "ER_NOT_APPROVED", message: "ER が承認されていません。", target: null }] },
      }),
    });

    const approved = await useDetailedDesignStore.getState().approve("p1", 1);

    expect(approved).toBe(false);
    expect(stub.requests).toHaveLength(0);
    expect(useDetailedDesignStore.getState().actionError).toBe(
      "ER が承認されていません。 図のエディタで承認してから、段階を承認してください。",
    );
    expect(useDetailedDesignStore.getState().approving).toBe(false);
  });

  it("承認の版の競合は、読み込み直したことを伝える", async () => {
    useDetailedDesignStore.setState({
      projectId: "p1",
      stages: makeStages({ 1: { state: "reviewing", version: 3 } }),
    });
    stub.queue({
      status: 409,
      body: { detail: "mismatch", code: "VERSION_CONFLICT" },
    });
    stub.queue({
      status: 200,
      body: makeStages({ 1: { state: "reviewing", version: 4 } }),
    });

    await useDetailedDesignStore.getState().approve("p1", 1);

    expect(useDetailedDesignStore.getState().actionError).toContain(
      "読み込み直しました",
    );
    expect(useDetailedDesignStore.getState().approving).toBe(false);
  });

  // Phase-16-6:追記
  it("saveは見ていた版で保存し、全段階を取り直す", async () => {
    useDetailedDesignStore.setState({
      projectId: "p1",
      stages: makeStages({ 1: { state: "draft", version: 2 } }),
    });
    stub.queue({ status: 200, body: {} });
    stub.queue({
      status: 200,
      body: makeStages({ 1: { state: "reviewing", version: 3 } }),
    });

    const saved = await useDetailedDesignStore
      .getState()
      .save("p1", 1, makeFunctionList());

    expect(saved).toBe(true);
    expect(stub.requests[0].init?.method).toBe("PUT");
    expect(JSON.parse(stub.requests[0].init?.body as string)).toMatchObject({
      version: 2,
      model: { next_number: 2 },
    });
    expect(useDetailedDesignStore.getState().stages[0].version).toBe(3);
  });

  it("generateは生成を受け付けてから取り直し、生成中の409は理由を伝える", async () => {
    useDetailedDesignStore.setState({ projectId: "p1", stages: makeStages() });
    stub.queue({
      status: 409,
      body: { detail: "busy", code: "DESIGN_STAGE_GENERATION_IN_PROGRESS" },
    });
    stub.queue({ status: 200, body: makeStages() });

    await useDetailedDesignStore.getState().generate("p1", 1);

    expect(stub.requests[0].url).toContain("/design-stages/1/generate");
    expect(stub.requests[1].url).toContain("/design-stages");
    expect(useDetailedDesignStore.getState().actionError).toContain("生成中");
    expect(useDetailedDesignStore.getState().requestingGeneration).toBe(false);
  });
});
