// 作成：Phase-15-7｜更新：Phase-16-6
// 写経レベル: 定型
// Phase-16-6:追記 ── ../labels.hasErrors, ../test-utils/stageFixtures.makeFunctionList
import { describe, expect, it } from "vitest";
import { canApprove, describeMissingInput, hasErrors } from "../labels";
import { makeFunctionList, makeStages } from "../test-utils/stageFixtures";

// Phase-16-6:追記
const MODEL = makeFunctionList();

describe("describeMissingInput", () => {
  it("段階と文書の不足を言葉にする", () => {
    expect(describeMissingInput("stage:1")).toBe("段階1(機能一覧)の承認");
    expect(describeMissingInput("doc:external_design")).toBe("外部設計書");
  });
});

describe("canApprove", () => {
  it("開いていて内容があり、下書き・レビュー中・古いなら承認できる", () => {
    // Phase-16-6：更新
    // const [stage1] = makeStages({ 1: { state: "reviewing", version: 1 } });
    // ↓↓
    const [stage1] = makeStages({
      1: { state: "reviewing", version: 1, model: MODEL },
    });
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

// Phase-16-6:追記
describe("canApprove(Phase 16)", () => {
  it("生成中・内容が空・検証のエラーがある段階は承認できない", () => {
    const [stage1] = makeStages({
      1: { state: "draft", version: 2, model: MODEL },
    });
    const error = {
      severity: "error" as const,
      code: "UNKNOWN_GROUP",
      message: "x",
      target: "F-01",
    };

    expect(canApprove({ ...stage1, state: "regenerated" })).toBe(true);
    expect(canApprove({ ...stage1, generation_status: "generating" })).toBe(false);
    expect(canApprove({ ...stage1, model: null })).toBe(false);
    expect(canApprove({ ...stage1, issues: [error] })).toBe(false);
    expect(hasErrors({ ...stage1, issues: [error] })).toBe(true);
    expect(
      canApprove({ ...stage1, issues: [{ ...error, severity: "warning" }] }),
    ).toBe(true);
  });
});
