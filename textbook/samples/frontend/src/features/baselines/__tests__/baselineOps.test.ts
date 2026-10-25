// 作成：Phase-88-2｜更新：Phase-107-2,109-2
// SUT: baselineOps(合意済みの版の画面の純粋な変換)
// ドライバ: vitest のテスト関数
// スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため
// Phase-109-2：削除 ── ../baselineOps.includedChangeRequests
import { describe, expect, it } from "vitest";
import {
  applySelection,
  baselineHref,
  createBlocker,
  includableChangeRequests,
  itemLabel,
  itemStateLabel,
  prefillAgreement,
  stageOfKey,
  stagePreview,
  toCreateBody,
  type BaselineForm,
} from "../baselineOps";
import { makeChangeRequest } from "@/features/change-requests/test-utils/changeRequestFixtures";
import type { DesignStageRead } from "@/features/detailed-design/api/types";

const decision = (counterpart: string | null, reason: string, memo = "") => ({
  counterpart,
  decided_at: "2026-10-19T01:00:00Z",
  memo,
  reason,
  recorded_by: "u1",
  // Phase-107-2:追記
  option: null,
  source: null,
  source_label: null,
  fingerprint: null,
});

const VERIFIED_1 = makeChangeRequest({
  number: 1,
  label: "CR-1",
  status: "verified",
  decision: decision(null, "上限を上げる", "定例"),
});
const VERIFIED_3 = makeChangeRequest({
  number: 3,
  label: "CR-3",
  status: "verified",
  decision: decision("山田(発注者)", "画面を足す"),
});
const INCLUDED = makeChangeRequest({ number: 2, label: "CR-2", status: "verified", included_baseline_number: 2 });
const APPLIED = makeChangeRequest({ number: 4, label: "CR-4", status: "applied" });

const FORM: BaselineForm = {
  agreedAt: "2026-10-20T10:00",
  counterpart: "",
  memo: "",
  reason: "",
  changeRequestNumbers: [],
};

const stage = (n: number, overrides: Partial<DesignStageRead> = {}) =>
  ({ stage: n, state: "approved", approved_version: 1, generation_status: null, ...overrides }) as DesignStageRead;

describe("baselineOps", () => {
  it("写しの表示名と状態", () => {
    expect(stageOfKey("stage:3")).toBe(3);
    expect(stageOfKey("requirements")).toBeNull();
    expect(itemLabel("external_design")).toBe("外部設計書");
    expect(itemLabel("stage:2")).toBe("段階2 データフロー");
    expect(itemStateLabel({ key: "test_spec", included: false, state: "absent", source_version: null, generated_model: null })).toBe("無い");
    expect(itemStateLabel({ key: "stage:6", included: true, state: "outdated", source_version: 2, generated_model: null })).toBe("古い");
    expect(baselineHref("p1", 2)).toBe("/projects/p1/baselines/2");
  });

  it("入れられるのは検証済みで、まだ束に入れていない CR(番号の順)", () => {
    const list = [VERIFIED_3, APPLIED, INCLUDED, VERIFIED_1];

    expect(includableChangeRequests(list).map((c) => c.number)).toEqual([1, 3]);
    // Phase-109-2：削除
    // expect(includedChangeRequests(list, 2).map((c) => c.number)).toEqual([2]);
  });

  it("合意の記録の初期値は、選んだ CR の記録から作る", () => {
    expect(prefillAgreement([VERIFIED_1, VERIFIED_3])).toEqual({
      counterpart: "山田(発注者)",
      memo: "CR-1: 定例",
      reason: "CR-1: 上限を上げる\nCR-3: 画面を足す",
    });
    expect(prefillAgreement([])).toEqual({ counterpart: "", memo: "", reason: "" });
  });

  it("選択を変えると、手で直していない欄だけを初期値で埋め直す", () => {
    const list = [VERIFIED_1, VERIFIED_3];
    const first = applySelection(FORM, [3], list, new Set());
    expect(first).toMatchObject({ changeRequestNumbers: [3], reason: "CR-3: 画面を足す", counterpart: "山田(発注者)" });

    const edited = { ...first, reason: "まとめて合意" };
    const second = applySelection(edited, [3, 1], list, new Set(["reason"]));
    expect(second).toMatchObject({ changeRequestNumbers: [1, 3], reason: "まとめて合意", memo: "CR-1: 定例" });
  });

  it("作成の本文と、作れない理由", () => {
    const form = { ...FORM, reason: " 合意 ", counterpart: "  ", changeRequestNumbers: [1] };

    expect(toCreateBody(form)).toEqual({
      agreed_at: new Date("2026-10-20T10:00").toISOString(),
      counterpart: null,
      memo: "",
      reason: "合意",
      change_request_numbers: [1],
    });
    expect(toCreateBody({ ...form, agreedAt: "" })).toBeNull();
    expect(createBlocker([stage(1)], form)).toBeNull();
    expect(createBlocker([stage(1, { generation_status: "generating" })], form)).toContain("生成している間");
    expect(createBlocker(null, FORM)).toBe("理由を入れてください。");
  });

  it("作った時点で入る段階・入らない段階", () => {
    const preview = stagePreview([stage(2, { state: "draft", approved_version: null }), stage(1)]);

    expect(preview).toEqual([
      { stage: 1, title: "機能一覧", included: true, state: "承認済み" },
      { stage: 2, title: "データフロー", included: false, state: "下書き" },
    ]);
  });
});
