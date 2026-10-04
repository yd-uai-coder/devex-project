// 作成：Phase-17-6
// 写経レベル: 定型
import { describe, expect, it } from "vitest";
import {
  countGroupFunctions,
  hasDraft,
  summaryOf,
  toDataFlow,
  toggleDfdGroup,
  updateSummary,
} from "../dataFlowOps";
import { MAX_DFD_GROUPS } from "../api/types";
import { makeDataFlow, makeFunctionList } from "../test-utils/stageFixtures";

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
