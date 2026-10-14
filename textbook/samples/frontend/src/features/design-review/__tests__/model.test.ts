// 作成：Phase-53-3｜更新：Phase-53(完了後の調整),54-1,54-2,54-4,54-5
// Phase-53(完了後の調整):追記 ── ../model(documentLegend, findingDocuments)
// Phase-54-1:追記 ── ../model.adoptedFindings, ../model.fixCheckText, ../model.followupCounts, ../model.joinNotices, ../model.regenerableFindings, ../model.regenerationStartFor, ../model.rehearableFindings, ../model.relatedDocuments, ../model.unaddressedNotice, ../test-utils/reviewFixtures.run
import { describe, expect, it } from "vitest";
import {
  actionLabel,
  // Phase-54-1:追記
  adoptedFindings,
  decisionCounts,
  documentLegend,
  documentOfTarget,
  findingDocuments,
  // Phase-54-1:追記
  fixCheckText,
  followupCounts,
  gateDocuments,
  isRunning,
  // Phase-54-1:追記
  joinNotices,
  regenerableFindings,
  regenerationStartFor,
  rehearableFindings,
  relatedDocuments,
  sortFindings,
  // Phase-54-1:追記
  unaddressedNotice,
  unreviewedNotice,
} from "../model";
// Phase-54-1：更新
// import { finding, gate } from "../test-utils/reviewFixtures";
// ↓↓
import { finding, gate, run } from "../test-utils/reviewFixtures";

// SUT はレビューの意味モデルの純粋関数、ドライバは vitest。スタブ不要 ── 対象が純粋(副作用なし)で
// 外部依存を呼ばないため。
describe("design-review model", () => {
  it("指摘は重要度の順、同じ重要度はサーバーの並び(position)の順", () => {
    const sorted = sortFindings([
      finding({ id: "a", level: "minor", position: 0 }),
      finding({ id: "b", level: "critical", position: 2 }),
      finding({ id: "c", level: "major", position: 3 }),
      finding({ id: "d", level: "critical", position: 1 }),
    ]);
    expect(sorted.map((f) => f.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("採否の件数", () => {
    const counts = decisionCounts([
      finding({ decision: "adopted" }),
      finding({ decision: "adopted" }),
      finding({ decision: "held" }),
      finding(),
    ]);
    expect(counts).toEqual({ pending: 1, adopted: 2, rejected: 0, held: 1 });
  });

  it("区切りの操作は、そろっていない・実行中では押せない", () => {
    expect(actionLabel("not_ready")).toBeNull();
    expect(actionLabel("running")).toBeNull();
    expect(actionLabel("unreviewed")).toBe("レビューする");
    expect(actionLabel("reviewed")).toBe("もう一度レビュー");
    expect(actionLabel("failed")).toBe("もう一度レビュー");
  });

  it("区切りの文書はモードで変わる", () => {
    expect(gateDocuments("documents", false)).toBe("4文書");
    expect(gateDocuments("documents", true)).toBe("要件定義書・外部設計書");
    expect(gateDocuments("stage7", true)).toContain("実装計画書");
  });

  it("未レビュー・失敗の区切りを知らせる(実行中・そろっていないは数えない)", () => {
    const gates = [
      gate({ gate: "documents", status: "reviewed" }),
      gate({ gate: "stage6", status: "failed" }),
      gate({ gate: "stage7", status: "unreviewed" }),
    ];
    expect(unreviewedNotice(gates)).toBe(
      "未レビューの区切りがあります(段階6の承認の後・段階7の承認の後)。このまま手順書を生成できます。",
    );
    expect(unreviewedNotice([gate({ status: "running" }), gate({ gate: "stage6", status: "not_ready" })])).toBeNull();
    expect(isRunning([gate({ status: "running" })])).toBe(true);
  });

  it("対象から文書を推定する", () => {
    expect(documentOfTarget("FR-001")).toBe("requirements");
    expect(documentOfTarget("NFR-008")).toBe("requirements");
    expect(documentOfTarget("SCR-004")).toBe("external_design");
    expect(documentOfTarget("POST /api/v1/projects/{id}/summary/approve")).toBe("external_design");
    expect(documentOfTarget("DF-2")).toBe("internal_design");
    expect(documentOfTarget("テーブル projects")).toBe("internal_design");
    expect(documentOfTarget("M-01-T02")).toBe("implementation_plan");
    expect(documentOfTarget("観点 セキュリティ")).toBeNull();
  });

  // Phase-53(完了後の調整):追記
  it("関連する文書を文字にし、無ければ対象から推定する", () => {
    expect(findingDocuments(finding({ documents: ["internal_design", "requirements"] }))).toEqual({
      letters: ["A", "C"],
      inferred: false,
    });
    expect(findingDocuments(finding({ documents: null, targets: ["SCR-001", "M-01-T02", "観点 規模"] }))).toEqual({
      letters: ["B", "D"],
      inferred: true,
    });
    expect(findingDocuments(finding({ documents: ["detailed_design", "detailed_plan"] })).letters).toEqual(["C", "D"]);
    expect(documentLegend("documents").map((d) => d.label)).toEqual(["要件定義", "外部設計", "内部設計", "実装計画"]);
    expect(documentLegend("stage7")[2].label).toBe("詳細設計");
  });

  // Phase-54-1:追記
  describe("採用した指摘の追跡", () => {
    const adopted = finding({ id: "a", decision: "adopted", followup: "unaddressed", documents: ["external_design"] });
    const changed = finding({ id: "c", decision: "adopted", followup: "changed", documents: ["requirements"] });
    const before = finding({ id: "b", decision: "adopted", followup: "unaddressed", documents: null, targets: ["FR-001"] });
    const g = gate({
      status: "reviewed",
      run: run({ findings: [adopted, changed, finding({ id: "p" })] }),
      adopted_before: [before],
    });

    it("区切りの採用した指摘は、最新の回と前の回の分を合わせる", () => {
      expect(adoptedFindings(g).map((f) => f.id)).toEqual(["a", "c", "b"]);
      // 失敗した回の指摘は見ない(前の回で採用した指摘だけ)
      expect(adoptedFindings({ ...g, run: run({ status: "failed", findings: [adopted] }) }).map((f) => f.id)).toEqual(["b"]);
      expect(followupCounts(adoptedFindings(g))).toEqual({ adopted: 3, unaddressed: 2 });
    });

    it("未対応の指摘を区切りごとに知らせ、知らせをつなぐ", () => {
      expect(unaddressedNotice([g, gate({ gate: "stage6" })])).toBe(
        "採用したまま直していない指摘があります(文書の生成の後 2件)。",
      );
      expect(unaddressedNotice([gate()])).toBeNull();
      expect(joinNotices("a", null, "b")).toBe("a b");
      expect(joinNotices(null)).toBeNull();
    });

    it("直ったかの判定の文", () => {
      const check = { verdict: "partial" as const, reason: "r", model: "m", error_code: null, created_at: "" };
      expect(fixCheckText(check)).toBe("AI: 一部");
      expect(fixCheckText({ ...check, verdict: null, error_code: "LLM_API_ERROR" })).toBe("AI: 判定に失敗");
    });

    it("再生成に渡せる指摘と、聞き直しに使える指摘を分ける", () => {
      const hearing = finding({ id: "h", decision: "adopted", cause: "hearing", point_key: "security" });
      const noKey = finding({ id: "n", decision: "adopted", cause: "hearing", point_key: null });
      const withHearing = { ...g, adopted_before: [before, hearing, noKey] };
      expect(regenerableFindings(withHearing).map((f) => f.id)).toEqual(["a", "c", "b"]);
      expect(rehearableFindings(withHearing).map((f) => f.id)).toEqual(["h"]);
    });

    it("再生成の起点は、未対応の指摘の関連文書のうち最も上流", () => {
      const docs = ["requirements", "external_design", "internal_design", "implementation_plan"] as const;
      // 変更ありの指摘(要件)は数えない。関連文書の無い古い指摘は対象から推定する(FR- → 要件)
      expect(relatedDocuments(before)).toEqual(["requirements"]);
      expect(regenerationStartFor([adopted, changed], [...docs])).toBe("external_design");
      expect(regenerationStartFor([adopted, before], [...docs])).toBe("requirements");
      expect(regenerationStartFor([changed], [...docs])).toBeNull();
    });
  });
});
