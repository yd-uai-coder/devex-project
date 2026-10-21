// 作成：Phase-87-1｜更新：Phase-87-4,88-2,88(完了後の調整),98-2,99(完了後の調整)
// SUT: changeRequestOps(CR の画面の純粋な変換)
// ドライバ: vitest のテスト関数
// スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため
  // Phase-87-4:追記
  // Phase-88(完了後の調整):追記
  // Phase-88-2:追記
  // Phase-88-2:追記
// Phase-88-2：更新
// import { makeChangeRequest, makeComparison, makeImpact } from "../test-utils/changeRequestFixtures";
// ↓↓
// Phase-88(完了後の調整):追記
// Phase-98-2:追記 ── ../changeRequestOps.ORIGIN_KIND_LABEL, ../changeRequestOps.addOrigin, ../changeRequestOps.originLabel, ../changeRequestOps.removeOrigin
// Phase-99(完了後の調整):追記 ── ../changeRequestOps.verifyBannerText
import { describe, expect, it } from "vitest";
import {
  ORIGIN_KIND_LABEL,
  addOrigin,
  addTarget,
  canReflectDocuments,
  canReflectStages,
  comparisonGroups,
  crNumbersInImpact,
  defaultReflectionCr,
  designStageHref,
  emptyForm,
  formFromChangeRequest,
  formProblems,
  groupByStage,
  headerActions,
  isApplied,
  isDetailedModeOnly,
  localInputToIso,
  markSegments,
  nowLocalInput,
  originLabel,
  removeOrigin,
  removeTarget,
  setTargetKind,
  setTargetProposal,
  stageLabel,
  stagesMarkedBy,
  summaryOutputNote,
  toCreateBody,
  toUpdateBody,
  verifyBannerText,
} from "../changeRequestOps";
import {
  makeChangeRequest,
  makeComparison,
  makeImpact,
  makeSummary,
} from "../test-utils/changeRequestFixtures";
import type { DesignImpactRead } from "@/features/detailed-design/api/types";
import { ApiError } from "@/lib/api/client";

const mark = (key: string, sources: string[], reviewed = false) => ({
  key,
  label: key,
  stage: 1,
  path: [],
  reason: "",
  sources,
  reviewed,
  pending: false,
});

describe("changeRequestOps", () => {
  it("見出しのボタンは許された操作のうち、見出しに置くものだけを表の順に返す", () => {
    expect(headerActions(["edit", "explain", "withdraw"])).toEqual(["explain", "withdraw"]);
    expect(headerActions(["apply", "verify"])).toEqual([]);
    expect(headerActions(["copy"])).toEqual(["copy"]);
  });

  it("反映できる状態と、比較・検証を出す状態", () => {
    expect(canReflectDocuments("agreed")).toBe(true);
    expect(canReflectDocuments("applied")).toBe(true);
    expect(canReflectDocuments("explained")).toBe(false);
    expect(canReflectStages("agreed")).toBe(false);
    expect(canReflectStages("applied")).toBe(true);
    expect(isApplied("verified")).toBe(true);
    expect(isApplied("agreed")).toBe(false);
  });

  it("対象は同じ要件を2回足さず、削除にすると案を消す", () => {
    let targets = addTarget([], "FR-001");
    targets = addTarget(targets, "FR-001");
    targets = addTarget(targets, "FR-002");
    targets = setTargetProposal(targets, "FR-001", "新しい文");
    expect(targets.map((t) => t.requirement_id)).toEqual(["FR-001", "FR-002"]);

    targets = setTargetKind(targets, "FR-001", "delete");
    expect(targets[0]).toEqual({ requirement_id: "FR-001", kind: "delete", proposed_text: "" });

    expect(removeTarget(targets, "FR-001").map((t) => t.requirement_id)).toEqual(["FR-002"]);
  });

  it("送る前の確かめ(タイトル・内容・対象か新しい要件)", () => {
    expect(formProblems(emptyForm())).toHaveLength(3);
    const form = { ...emptyForm(), title: "t", content: "c", adds_requirement: true };
    expect(formProblems(form)).toEqual([]);
  });

  it("本文は空白を除き、日付の空は null、削除の案は空にする。基準の束は作成だけ", () => {
    const form = {
      ...emptyForm(2),
      title: " t ",
      content: " c ",
      targets: [
        { requirement_id: "FR-001", kind: "content" as const, proposed_text: " 案 " },
        { requirement_id: "FR-002", kind: "delete" as const, proposed_text: "残り" },
      ],
    };

    const update = toUpdateBody(form);
    expect(update.title).toBe("t");
    expect(update.background_date).toBeNull();
    expect(update.targets.map((t) => t.proposed_text)).toEqual(["案", ""]);
    expect("baseline_number" in update).toBe(false);
    expect(toCreateBody(form).baseline_number).toBe(2);
    expect("baseline_number" in toCreateBody(emptyForm())).toBe(false);
  });

  it("CR からフォームを作る(往復で同じ本文)", () => {
    const cr = makeChangeRequest();
    const form = formFromChangeRequest(cr);
    expect(form.baseline_number).toBe(1);
    expect(toUpdateBody(form).targets).toEqual([
      { requirement_id: "FR-005", kind: "content", proposed_text: "5件まで添付できる" },
    ]);
  });

  // Phase-98-2:追記
  it("起点は同じ要素を2回入れず、新しい要件を足すときだけ送る", () => {
    const origins = addOrigin(addOrigin(addOrigin([], "screen:SCR-004"), "req:FR-001"), "screen:SCR-004");
    expect(origins).toEqual(["screen:SCR-004", "req:FR-001"]);
    expect(removeOrigin(origins, "screen:SCR-004")).toEqual(["req:FR-001"]);
    expect(addOrigin(origins, "")).toBe(origins);

    const form = { ...emptyForm(), title: "t", content: "c", adds_requirement: true, origins };
    expect(toUpdateBody(form).origins).toEqual(["screen:SCR-004", "req:FR-001"]);
    // 「新しい要件を足す」を外したら、選んでいた起点は送らない(サーバーは起点だけ残ると断る)
    expect(toUpdateBody({ ...form, adds_requirement: false }).origins).toEqual([]);
    expect(ORIGIN_KIND_LABEL.screen).toBe("画面");
  });

  it("CR の起点はキーでフォームへ写し、表示名はキーから引く", () => {
    const origins = [{ key: "screen:SCR-004", label: "SCR-004 チャットヒアリング画面" }];
    const cr = makeChangeRequest({ adds_requirement: true, origins });
    expect(formFromChangeRequest(cr).origins).toEqual(["screen:SCR-004"]);
    expect(originLabel(origins, "screen:SCR-004")).toBe("SCR-004 チャットヒアリング画面");
    expect(originLabel(origins, "api:GET /x")).toBe("api:GET /x");
  });

  it("datetime-local の値と ISO 文字列", () => {
    expect(nowLocalInput(new Date(2026, 9, 19, 9, 5))).toBe("2026-10-19T09:05");
    expect(localInputToIso("2026-10-19T09:05")).toBe(new Date(2026, 9, 19, 9, 5).toISOString());
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("x")).toBeNull();
  });

  it("予測は段階の順にまとめ、段階0は文書の側と呼ぶ", () => {
    const groups = groupByStage([...makeImpact().items].reverse());
    expect(groups.map((g) => g.stage)).toEqual([0, 1]);
    expect(stageLabel(0)).toBe("文書の側(画面・API)");
    expect(stageLabel(3)).toBe("段階3 データモデル");
  });

  it("比較は予測の外 → 予測だけ → 一致の順", () => {
    const groups = comparisonGroups(makeComparison().items);
    expect(groups.map((g) => [g.status, g.items.length])).toEqual([
      ["actual_only", 1],
      ["predicted_only", 1],
      ["matched", 1],
    ]);
  });

  it("未確認の印の出どころから CR の番号と段階を読む", () => {
    const impact: DesignImpactRead = {
      stages: [
        { stage: 1, changes: [], marks: [mark("F-01", ["doc:requirements", "cr:2"]), mark("F-02", ["cr:5"], true)], open: 1, reviewed: 1 },
        { stage: 3, changes: [], marks: [mark("T-01", ["cr:1"])], open: 1, reviewed: 0 },
      ],
      regeneration_targets: [],
    };
    expect(crNumbersInImpact(impact)).toEqual([1, 2]);
    expect(crNumbersInImpact(null)).toEqual([]);
    expect(stagesMarkedBy(impact, 2)).toEqual([1]);
    expect(stagesMarkedBy(impact, 5)).toEqual([]);
    expect(designStageHref("p1", 3)).toBe("/projects/p1/detailed-design?stage=3");
    // Phase-87-4:追記
    // 段階の生成に渡す CR の初期値は、反映済みの CR のうち印の出どころにある最初のもの
    expect(defaultReflectionCr([2, 7], impact)).toBe(2);
    expect(defaultReflectionCr([7], impact)).toBeNull();
  });
});

// Phase-88-2:追記
describe("説明書と要約", () => {
  it("照合で合わない要件 ID・数字だけに印を付け、ほかの文はつなげる", () => {
    const segments = markSegments("FR-005 と FR-099 の上限を3件から5件に。影響は7件(E2E は除く)。", ["FR-099"], ["7"]);

    expect(segments.filter((s) => s.mark !== null)).toEqual([
      { text: "FR-099", mark: "id" },
      { text: "7", mark: "number" },
    ]);
    expect(segments.map((s) => s.text).join("")).toBe("FR-005 と FR-099 の上限を3件から5件に。影響は7件(E2E は除く)。");
    // 要件 ID の中の数字・英字に続く数字は、数字として印を付けない
    expect(markSegments("FR-007 と E2E7", [], ["007", "7"])).toEqual([{ text: "FR-007 と E2E7", mark: null }]);
  });

  it("要約が出力に載るかを、状態ごとに説明する", () => {
    expect(summaryOutputNote(null)).toContain("5節だけ");
    expect(summaryOutputNote(makeSummary({ state: "confirmed" }))).toContain("要約が載ります");
    expect(summaryOutputNote(makeSummary({ state: "unconfirmed" }))).toContain("載りません");
    expect(summaryOutputNote(makeSummary({ state: "stale" }))).toContain("確かめ直すまで");
  });
});

// Phase-88(完了後の調整):追記
describe("モード", () => {
  it("簡易モードで断られた 409 だけを見分ける", () => {
    expect(isDetailedModeOnly(new ApiError(409, "m", "DESIGN_STAGES_NOT_AVAILABLE"))).toBe(true);
    expect(isDetailedModeOnly(new ApiError(409, "m", "DOC_GENERATION_IN_PROGRESS"))).toBe(false);
    expect(isDetailedModeOnly(new Error("x"))).toBe(false);
  });
});
// Phase-99(完了後の調整):追記
describe("詳細設計の画面の CR の帯", () => {
  it("未確認の印・文書の側・未承認の段階の数を1行にする", () => {
    expect(verifyBannerText({ open_marks: 3, open_documents: 0, pending_stages: [1, 4] })).toBe(
      "未確認の印 3 / 文書の側 0 / 未承認の段階 2",
    );
  });
});
