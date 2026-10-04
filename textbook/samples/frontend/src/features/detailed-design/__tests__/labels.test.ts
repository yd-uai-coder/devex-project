// 作成：Phase-15-7｜更新：Phase-16-6,18-9
// 写経レベル: 定型
// Phase-16-6:追記 ── ../labels.hasErrors, ../test-utils/stageFixtures.makeFunctionList
import { describe, expect, it } from "vitest";
// Phase-18-9:追記 ── ../labels(APPROVAL_TIME_CODES, approvalBlockers, visibleIssues)
import {
  APPROVAL_TIME_CODES,
  approvalBlockers,
  canApprove,
  describeMissingInput,
  hasErrors,
  visibleIssues,
} from "../labels";
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

// Phase-18-9:追記
describe("図の未承認は承認時に出す(Phase 18)", () => {
  const ER_PENDING = { severity: "error" as const, code: "ER_NOT_APPROVED", message: "ER が承認されていません。", target: null };
  const OTHER = { ...ER_PENDING, code: "DFD_WRITE_MISSING", message: "C/U/D がありません" };

  it("図の未承認だけなら承認ボタンは押せ、一覧からは除き、承認を止める理由として返す", () => {
    const [, , stage3] = makeStages({
      3: { is_open: true, missing_inputs: [], state: "reviewing", version: 1, model: { cells: [] }, issues: [ER_PENDING] },
    });

    expect(APPROVAL_TIME_CODES.has("DFD_NOT_APPROVED")).toBe(true);
    expect(hasErrors(stage3)).toBe(false);
    expect(canApprove(stage3)).toBe(true);
    expect(visibleIssues(stage3.issues)).toEqual([]);
    expect(approvalBlockers(stage3)).toEqual([ER_PENDING]);
    expect(hasErrors({ ...stage3, issues: [ER_PENDING, OTHER] })).toBe(true);
  });
});
