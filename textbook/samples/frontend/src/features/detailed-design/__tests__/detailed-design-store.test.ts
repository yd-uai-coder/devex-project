// 作成：Phase-15-7｜更新：Phase-16-6,18-9,18-9,20-4,21-4,21-7(画面確認後の修正),27-3,28-3,44-1,54-3
// 写経レベル: コア ── 版の競合と、承認後の取り直し。
// Phase-16-6:追記 ── ../test-utils/stageFixtures.makeFunctionList
// Phase-44-1:追記 ── ../test-utils/stageFixtures(makeImpact, makeModuleList, makePlan)
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  firstPendingStage,
  useDetailedDesignStore,
} from "../detailed-design-store";
import {
  makeFunctionList,
  makeImpact,
  makeModuleList,
  makePlan,
  makeStages,
} from "../test-utils/stageFixtures";
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
    // Phase-21-4:追記
    focus: null,
    // Phase-21-7:追記(画面確認後の修正。タブの保持)
    tabs: {},
    // Phase-44-1:追記
    impact: null,
    impactError: null,
    reviewing: false,
    highlight: null,
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
            // Phase-27-3：更新
            // [1, 2, 3, 4, 5, 6, 7].map((n) => [n, { state: "approved" }]),
            // ↓↓
            [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [n, { state: "approved" }]),
          ),
        ),
      ),
    // Phase-27-3：更新
    // ).toBe(7);
    // ↓↓
    ).toBe(8);
  });

  it("fetchStagesは一覧を保持し、初回は承認されていない最初の段階を選ぶ", async () => {
    stub.queue({
      status: 200,
      body: makeStages({ 1: { state: "approved", version: 1 } }),
    });

    await useDetailedDesignStore.getState().fetchStages("p1");

    const state = useDetailedDesignStore.getState();
    expect(state.status).toBe("success");
    // Phase-27-3：更新
    // expect(state.stages).toHaveLength(7);
    // ↓↓
    expect(state.stages).toHaveLength(8);
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
  it("図が未承認なら、承認の API を呼ばずに理由を出す", async () => {
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

  // Phase-20-4:追記
  it("generateは段階5の対象の処理を渡し、受け付けの 409 DESIGN_STAGE_INVALID はサーバーの理由を出す", async () => {
    useDetailedDesignStore.setState({ projectId: "p1", stages: makeStages() });
    stub.queue({
      status: 409,
      body: { detail: "選ばれていない処理です: F-09", code: "DESIGN_STAGE_INVALID" },
    });
    stub.queue({ status: 200, body: makeStages() });

    await useDetailedDesignStore.getState().generate("p1", 5, ["F-09"]);

    expect(stub.requests[0].url).toContain("/design-stages/5/generate");
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({ function_ids: ["F-09"] });
    expect(useDetailedDesignStore.getState().actionError).toBe("選ばれていない処理です: F-09");
  });

  // Phase-21-4:追記
  it("generateは段階6の対象の関数を本文の logics で渡す", async () => {
    useDetailedDesignStore.setState({ projectId: "p1", stages: makeStages() });
    stub.queue({ status: 202, body: makeStages()[5] });
    stub.queue({ status: 200, body: makeStages() });
    const logics = [{ module: "app/services/reservation.py", function: "create" }];

    await useDetailedDesignStore.getState().generate("p1", 6, undefined, logics);

    expect(stub.requests[0].url).toContain("/design-stages/6/generate");
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({ logics });
  });

  // Phase-28-3:追記
  it("generateは段階8の対象の単位を本文の unit_ids で渡す", async () => {
    useDetailedDesignStore.setState({ projectId: "p1", stages: makeStages() });
    stub.queue({ status: 202, body: makeStages()[7] });
    stub.queue({ status: 200, body: makeStages() });

    await useDetailedDesignStore.getState().generate("p1", 8, undefined, undefined, ["M-01-T01"]);

    expect(stub.requests[0].url).toContain("/design-stages/8/generate");
    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({ unit_ids: ["M-01-T01"] });
  });

  // Phase-54-3:追記
  it("generateは修正指示に入れる指摘を本文の finding_ids で渡す", async () => {
    useDetailedDesignStore.setState({ projectId: "p1", stages: makeStages() });
    stub.queue({ status: 202, body: makeStages()[0] });
    stub.queue({ status: 200, body: makeStages() });

    await useDetailedDesignStore.getState().generate("p1", 1, undefined, undefined, undefined, ["f1"]);

    expect(JSON.parse(stub.requests[0].init?.body as string)).toEqual({ finding_ids: ["f1"] });
  });

  it("jumpToは段階を選んで移動先を覚え、clearFocus・selectStageで消える", () => {
    useDetailedDesignStore.setState({ selectedStage: 5, actionError: "前の失敗" });

    useDetailedDesignStore.getState().jumpTo(6, "app/api/routes/reservations.py::create_reservation");
    expect(useDetailedDesignStore.getState()).toMatchObject({
      selectedStage: 6,
      actionError: null,
      focus: { stage: 6, target: "app/api/routes/reservations.py::create_reservation" },
    });

    useDetailedDesignStore.getState().clearFocus();
    expect(useDetailedDesignStore.getState().focus).toBeNull();

    useDetailedDesignStore.getState().jumpTo(5, "F-01#1");
    useDetailedDesignStore.getState().selectStage(3);
    expect(useDetailedDesignStore.getState().focus).toBeNull();
  });

  // Phase-21-7:追記(画面確認後の修正。タブの保持)
  it("setTabはタブの選択を覚え、別のプロジェクトを開くと消える", async () => {
    useDetailedDesignStore.setState({ projectId: "p1", stages: makeStages() });
    useDetailedDesignStore.getState().setTab("6:outer", "F-02");
    expect(useDetailedDesignStore.getState().tabs).toEqual({ "6:outer": "F-02" });

    stub.queue({ status: 200, body: makeStages() });
    await useDetailedDesignStore.getState().fetchStages("p1");
    expect(useDetailedDesignStore.getState().tabs).toEqual({ "6:outer": "F-02" });

    stub.queue({ status: 200, body: makeStages() });
    await useDetailedDesignStore.getState().fetchStages("p2");
    expect(useDetailedDesignStore.getState().tabs).toEqual({});
  });

  // Phase-44-1:追記
  it("fetchStagesは印か承認後の編集があるときだけ変更の影響も取る", async () => {
    stub.queue({ status: 200, body: makeStages() });
    await useDetailedDesignStore.getState().fetchStages("p1");
    expect(stub.requests).toHaveLength(1);
    expect(useDetailedDesignStore.getState().impact).toBeNull();

    stub.queue({ status: 200, body: makeStages({ 5: { impact_open: 1 } }) });
    stub.queue({ status: 200, body: makeImpact() });
    await useDetailedDesignStore.getState().fetchStages("p1");
    expect(stub.requests[2].url).toContain("/projects/p1/design-stages/impact");
    expect(useDetailedDesignStore.getState().impact?.regeneration_targets).toHaveLength(2);
  });

  it("変更の影響の取得に失敗しても段階の一覧は出す", async () => {
    stub.queue({ status: 200, body: makeStages({ 5: { impact_open: 1 } }) });
    stub.queue({ status: 500, body: { detail: "boom" } });
    await useDetailedDesignStore.getState().fetchStages("p1");
    const state = useDetailedDesignStore.getState();
    expect(state.status).toBe("success");
    expect(state.stages).toHaveLength(8);
    expect(state.impactError).not.toBeNull();
  });

  it("reviewMarksは印のキーを送って確認済みにし、全段階を取り直す", async () => {
    stub.queue({ status: 200, body: { stage: 5, changes: [], marks: [], open: 0, reviewed: 1 } });
    stub.queue({ status: 200, body: makeStages({ 5: { impact_reviewed: 1 } }) });
    stub.queue({ status: 200, body: makeImpact() });

    const ok = await useDetailedDesignStore.getState().reviewMarks("p1", 5, ["proc:F-01"], true);

    expect(ok).toBe(true);
    expect(stub.requests[0].url).toContain("/design-stages/5/impact/review");
    expect(stub.requests[0].init?.method).toBe("POST");
    expect(JSON.parse(String(stub.requests[0].init?.body))).toEqual({
      keys: ["proc:F-01"],
      reviewed: true,
    });
    expect(useDetailedDesignStore.getState().impact).not.toBeNull();
  });

  it("未確認の印が残る承認の 409 は、確認済みにする案内を出す", async () => {
    useDetailedDesignStore.setState({
      stages: makeStages({ 5: { state: "outdated", version: 3, is_open: true } }),
    });
    stub.queue({
      status: 409,
      body: { detail: "unreviewed", code: "DESIGN_STAGE_UNREVIEWED_IMPACT" },
    });
    stub.queue({ status: 200, body: makeStages() });

    expect(await useDetailedDesignStore.getState().approve("p1", 5)).toBe(false);
    expect(useDetailedDesignStore.getState().actionError).toContain("確認済み");
  });

  it("regenerateは再生成の候補のキーを部分再生成の引数にする(段階8は単位の ID)", async () => {
    useDetailedDesignStore.setState({ stages: makeStages({ 8: { plan: makePlan() } }) });
    stub.queue({ status: 202, body: {} });
    stub.queue({ status: 200, body: makeStages() });

    await useDetailedDesignStore.getState().regenerate("p1", 8, ["unit:U-002"]);

    expect(stub.requests[0].url).toContain("/design-stages/8/generate");
    expect(JSON.parse(String(stub.requests[0].init?.body))).toEqual({ unit_ids: ["M-01-T02"] });
  });

  it("showInTableは段階へ移って行を強調し、段階5・6 はタブの移動先も立てる", () => {
    useDetailedDesignStore.getState().showInTable(4, "module:app/x.py");
    expect(useDetailedDesignStore.getState()).toMatchObject({
      selectedStage: 4,
      highlight: { stage: 4, key: "module:app/x.py" },
      focus: null,
    });

    useDetailedDesignStore.getState().showInTable(5, "proc:F-01");
    expect(useDetailedDesignStore.getState().focus).toEqual({ stage: 5, target: "F-01" });

    useDetailedDesignStore.getState().selectStage(2);
    expect(useDetailedDesignStore.getState().highlight).toBeNull();
  });

  it("jumpToは「段階Nで直す」の文字列から行を推定して強調する", () => {
    useDetailedDesignStore.setState({
      stages: makeStages({ 1: { model: makeFunctionList() }, 4: { model: makeModuleList() } }),
    });

    useDetailedDesignStore.getState().jumpTo(4, "段階4 app/api/routes/reservations.py の依存");
    expect(useDetailedDesignStore.getState().highlight).toEqual({
      stage: 4,
      key: "module:app/api/routes/reservations.py",
    });

    useDetailedDesignStore.getState().jumpTo(1, "どこか");
    expect(useDetailedDesignStore.getState().highlight).toBeNull();
  });
});
