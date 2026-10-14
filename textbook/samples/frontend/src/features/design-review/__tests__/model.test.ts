// 作成：Phase-53-3｜更新：Phase-53(完了後の調整)
// Phase-53(完了後の調整):追記 ── ../model(documentLegend, findingDocuments)
import { describe, expect, it } from "vitest";
import {
  actionLabel,
  decisionCounts,
  documentLegend,
  documentOfTarget,
  findingDocuments,
  gateDocuments,
  isRunning,
  sortFindings,
  unreviewedNotice,
} from "../model";
import { finding, gate } from "../test-utils/reviewFixtures";

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
});
