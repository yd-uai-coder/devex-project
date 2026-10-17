// 作成：Phase-69-3
import { describe, expect, it } from "vitest";
import { failureFor, failureHeading } from "../generation-failure";

// SUT: failureFor・failureHeading / ドライバ: このテスト / スタブ不要 ── 純粋関数で外部を呼ばないため。

const FAILURE = {
  reason_code: "GENERATION_FAILED",
  message: "設計書の生成に失敗しました。",
  targets: ["internal_design", "implementation_plan", "test_spec"],
  failed_at: "2026-10-17T06:00:00Z",
};

describe("generation-failure", () => {
  it("記録が無ければ null、対象を渡さなければそのまま返す", () => {
    expect(failureFor(null)).toBeNull();
    expect(failureFor(undefined)).toBeNull();
    expect(failureFor(FAILURE)).toBe(FAILURE);
  });

  it("対象を渡すと、その文書を作り直そうとした失敗だけを返す", () => {
    expect(failureFor(FAILURE, "test_spec")).toBe(FAILURE);
    expect(failureFor({ ...FAILURE, targets: ["requirements", "external_design"] }, "test_spec")).toBeNull();
  });

  it("見出しは失敗したことと日時", () => {
    expect(failureHeading(FAILURE)).toMatch(/^前回の生成は失敗しました\(.+\)$/);
    expect(failureHeading(FAILURE)).toContain(new Date(FAILURE.failed_at).toLocaleString("ja-JP"));
  });
});
