// 作成：Phase-15-7
// 写経レベル: 定型
import { describe, expect, it } from "vitest";
import { canApprove, describeMissingInput } from "../labels";
import { makeStages } from "../test-utils/stageFixtures";

describe("describeMissingInput", () => {
  it("段階と文書の不足を言葉にする", () => {
    expect(describeMissingInput("stage:1")).toBe("段階1(機能一覧)の承認");
    expect(describeMissingInput("doc:external_design")).toBe("外部設計書");
  });
});

describe("canApprove", () => {
  it("開いていて内容があり、下書き・レビュー中・古いなら承認できる", () => {
    const [stage1] = makeStages({ 1: { state: "reviewing", version: 1 } });
    expect(canApprove(stage1)).toBe(true);
    expect(canApprove({ ...stage1, state: "outdated" })).toBe(true);
  });

  it("承認済み・未着手・開いていない段階は承認できない", () => {
    const [stage1, stage2] = makeStages({
      1: { state: "approved", version: 1 },
    });
    expect(canApprove(stage1)).toBe(false);
    expect(canApprove({ ...stage1, state: "not_started", version: null })).toBe(
      false,
    );
    expect(canApprove({ ...stage2, state: "reviewing", version: 1 })).toBe(
      false,
    );
  });
});
