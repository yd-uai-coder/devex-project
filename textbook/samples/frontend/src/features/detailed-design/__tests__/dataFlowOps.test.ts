// 作成：Phase-17-6｜更新：Phase-109-1
// 写経レベル: 定型
// Phase-109-1:追記 ── ../dataFlowOps.reassignSummary, ../dataFlowOps.removeStraySummaries, ../dataFlowOps.removeSummaryAt, ../dataFlowOps.strayDfdGroups, ../dataFlowOps.straySummaries, ../dataFlowOps.summaryTargets, ../api/types.DataFlowModel, ../test-utils/stageFixtures.makeFunctionListWithSpare
import { describe, expect, it } from "vitest";
import {
  countGroupFunctions,
  hasDraft,
  reassignSummary,
  removeStraySummaries,
  removeSummaryAt,
  strayDfdGroups,
  straySummaries,
  summaryOf,
  summaryTargets,
  toDataFlow,
  toggleDfdGroup,
  updateSummary,
} from "../dataFlowOps";
import { MAX_DFD_GROUPS, type DataFlowModel } from "../api/types";
import { makeDataFlow, makeFunctionList, makeFunctionListWithSpare } from "../test-utils/stageFixtures";

describe("dataFlowOps", () => {
  it("toDataFlowは保存された JSON を編集できる形にそろえる", () => {
    expect(toDataFlow(null)).toEqual({ dfd_groups: [], summaries: [] });
    expect(
      toDataFlow({ dfd_groups: ["予約", 3], summaries: [{ function_id: "F-01", input: 1 }] }),
    ).toEqual({
      dfd_groups: ["予約", "3"],
      summaries: [{ function_id: "F-01", input: "1", process: "", output: "" }],
    });
  });

  it("hasDraftは処理概要表の行で判定する(グループの選択だけなら内容なし)", () => {
    expect(hasDraft({ dfd_groups: ["予約"], summaries: [] })).toBe(false);
    expect(hasDraft(makeDataFlow())).toBe(true);
  });

  it("toggleDfdGroupは選ぶ・外す。上限に達したら選ばない", () => {
    const selected = toggleDfdGroup(makeDataFlow(), "予約", true);
    expect(selected.dfd_groups).toEqual(["予約"]);
    expect(toggleDfdGroup(selected, "予約", true)).toBe(selected);
    expect(toggleDfdGroup(selected, "予約", false).dfd_groups).toEqual([]);

    const full = makeDataFlow(Array.from({ length: MAX_DFD_GROUPS }, (_, i) => `g${i}`));
    expect(toggleDfdGroup(full, "もう1つ", true)).toBe(full);
  });

  it("updateSummaryは行を書き換え、無い処理なら行を足す", () => {
    const model = makeDataFlow();

    const updated = updateSummary(model, "F-01", { output: "予約ID" });
    const added = updateSummary(model, "F-02", { input: "利用者" });

    expect(summaryOf(updated, "F-01").output).toBe("予約ID");
    expect(model.summaries[0].output).toBe("予約");
    expect(added.summaries.map((row) => row.function_id)).toEqual(["F-01", "F-02"]);
    expect(summaryOf(added, "F-02")).toEqual({
      function_id: "F-02",
      input: "利用者",
      process: "",
      output: "",
    });
  });

  it("countGroupFunctionsはグループの処理の数を返す", () => {
    expect(countGroupFunctions(makeFunctionList(), "reservations")).toBe(1);
    expect(countGroupFunctions(makeFunctionList(), "無い")).toBe(0);
  });
});

// Phase-109-1:追記
describe("dataFlowOps(機能一覧に無い処理)", () => {
  // F-09 は段階1 の作り直しで消えた処理(機能一覧は F-01・F-02)
  const stray = { function_id: "F-09", input: "旧の入力", process: "旧の処理", output: "旧の出力" };
  const withStray = (): DataFlowModel => ({
    dfd_groups: ["reservations", "消えたグループ"],
    summaries: [...makeDataFlow().summaries, stray],
  });

  it("機能一覧に無い処理概要の行とグループを拾う", () => {
    const list = makeFunctionListWithSpare();
    expect(straySummaries(withStray(), list)).toEqual([{ index: 1, functionId: "F-09", process: "旧の処理" }]);
    expect(strayDfdGroups(withStray(), list)).toEqual(["消えたグループ"]);
    expect(straySummaries(makeDataFlow(), list)).toEqual([]);
  });

  it("付け替え先は処理概要が空の処理で、付け替えると中身はそのまま機能一覧の順に並ぶ", () => {
    const list = makeFunctionListWithSpare();
    const model = { ...withStray(), summaries: [...withStray().summaries, { function_id: "F-02", input: "", process: "", output: "" }] };
    expect(summaryTargets(model, list).map((fn) => fn.id)).toEqual(["F-02"]);

    const next = reassignSummary(model, list, 1, "F-02");
    expect(next.summaries).toEqual([makeDataFlow().summaries[0], { ...stray, function_id: "F-02" }]);
    expect(next.dfd_groups).toEqual(model.dfd_groups);
  });

  it("1行ずつ消す・すべて消す(グループの選択は変えない)", () => {
    const list = makeFunctionListWithSpare();
    expect(removeSummaryAt(withStray(), 1).summaries).toEqual(makeDataFlow().summaries);
    const cleared = removeStraySummaries(withStray(), list);
    expect(cleared.summaries).toEqual(makeDataFlow().summaries);
    expect(cleared.dfd_groups).toEqual(["reservations", "消えたグループ"]);
  });
});
