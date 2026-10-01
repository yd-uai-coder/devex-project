// 作成：Phase-15-7
// 写経レベル: コア ── 版の競合と、承認後の取り直し。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  firstPendingStage,
  useDetailedDesignStore,
} from "../detailed-design-store";
import { makeStages } from "../test-utils/stageFixtures";
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

    await useDetailedDesignStore.getState().approve("p1", 1);

    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({
      version: 3,
    });
    expect(stub.requests[1].url).toContain("/design-stages");
    expect(useDetailedDesignStore.getState().stages[0].state).toBe("approved");
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
});
