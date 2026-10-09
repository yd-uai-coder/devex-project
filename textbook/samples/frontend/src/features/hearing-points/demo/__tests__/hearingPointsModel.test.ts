// 作成：Phase-33-3
import { describe, expect, it } from "vitest";
import { DEMO_CARDS, DEMO_FUNCTIONS, DEMO_POINTS, DEMO_REQUIREMENTS, DEMO_UNITS } from "../demoData";
import {
  POINT_DEFS,
  answerByCard,
  answerByText,
  countBySource,
  countByStatus,
  isRequired,
  isSufficient,
  nextCard,
  openRequired,
  trace,
  traceIssues,
  type PointState,
} from "../hearingPointsModel";

// 観点の状態をまとめて決める(未決を全部、指定した状態に)
function resolveAll(states: PointState[], status: PointState["status"]): PointState[] {
  return states.map((s) => (s.status === "open" ? { ...s, status, summary: "決めた", evidence: "発言9" } : s));
}

describe("観点の定義と規模", () => {
  it("技術スタックは規模によらず必須、体制・期間はどの規模でも任意", () => {
    for (const scale of ["personal", "internal", "public"] as const) {
      expect(isRequired("tech", scale)).toBe(true);
      expect(isRequired("schedule", scale)).toBe(false);
    }
  });

  it("非機能の6大項目をすべて持つ", () => {
    expect(POINT_DEFS.filter((d) => d.kind === "nonfunctional").map((d) => d.key)).toEqual([
      "availability",
      "performance",
      "operability",
      "migration",
      "security",
      "environment",
    ]);
  });
});

describe("完了の判定", () => {
  it("個人・小規模では、未決の必須(例外の場面・可用性・セキュリティ)が残る間は十分でない", () => {
    expect(openRequired(DEMO_POINTS, "personal").map((d) => d.key)).toEqual([
      "exceptions",
      "availability",
      "security",
    ]);
    expect(isSufficient(DEMO_POINTS, "personal")).toBe(false);
  });

  it("任意の観点(運用・保守性・システム環境)が未決のままでも、個人・小規模なら十分", () => {
    const states = DEMO_POINTS.map((s) =>
      ["exceptions", "availability", "security"].includes(s.key) ? { ...s, status: "decided" as const } : s,
    );
    expect(isSufficient(states, "personal")).toBe(true);
    expect(isSufficient(states, "internal")).toBe(false);
  });

  it("対象外も未決以外として数える", () => {
    expect(isSufficient(resolveAll(DEMO_POINTS, "not_applicable"), "public")).toBe(true);
  });

  it("状態ごとに数える", () => {
    expect(countByStatus(DEMO_POINTS)).toEqual({ decided: 10, adopted: 0, open: 5, not_applicable: 1 });
  });
});

describe("選択肢カード", () => {
  it("カードの選択肢を選ぶと「AI の提案を採用」、自分の言葉で答えると「ユーザーが決定」", () => {
    const card = DEMO_CARDS[0];
    const adopted = answerByCard(DEMO_POINTS, card, card.options[0], "カード(発言5)");
    expect(adopted.find((s) => s.key === "availability")).toEqual({
      key: "availability",
      status: "adopted",
      summary: "半日〜1日止まっても困らない",
      evidence: "カード(発言5)",
    });

    const decided = answerByText(DEMO_POINTS, "availability", " 2時間で戻ってほしい ", "発言5");
    expect(decided.find((s) => s.key === "availability")?.status).toBe("decided");
    expect(decided.find((s) => s.key === "availability")?.summary).toBe("2時間で戻ってほしい");
  });

  it("空の答えでは何も変えない", () => {
    expect(answerByText(DEMO_POINTS, "availability", "  ", "発言5")).toBe(DEMO_POINTS);
  });

  it("次のカードは、未決の観点のうち必須を先に出す", () => {
    expect(nextCard(DEMO_CARDS, DEMO_POINTS, "personal")?.point).toBe("availability");

    // 必須の3つが決まると、任意の観点(システム環境)のカードを出す
    const states = DEMO_POINTS.map((s) =>
      ["exceptions", "availability", "security"].includes(s.key) ? { ...s, status: "decided" as const } : s,
    );
    expect(nextCard(DEMO_CARDS, states, "personal")?.point).toBe("environment");
    expect(nextCard(DEMO_CARDS, resolveAll(DEMO_POINTS, "decided"), "personal")).toBeUndefined();
  });
});

describe("要件と追跡", () => {
  it("出どころごとに数える", () => {
    expect(countBySource(DEMO_REQUIREMENTS)).toEqual({ user: 12, adopted: 3, assumed: 1 });
  });

  it("機能要件から処理と作業単位を導く", () => {
    const rows = trace(DEMO_REQUIREMENTS, DEMO_FUNCTIONS, DEMO_UNITS);
    expect(rows.map((r) => r.req.id)).toHaveLength(10);
    const fr005 = rows.find((r) => r.req.id === "FR-005");
    expect(fr005?.functions.map((f) => f.id)).toEqual(["F-08", "F-09", "F-10"]);
    expect(fr005?.units.map((u) => u.id)).toEqual(["M-02-T06", "M-03-T01", "M-03-T02"]);
  });

  it("処理の無い Must の機能要件と、要件の無い処理・要件定義書に無い要件ID を指摘する", () => {
    const functions = [...DEMO_FUNCTIONS, { id: "F-16", name: "外部連携", reqIds: ["FR-099"] }];
    expect(traceIssues(DEMO_REQUIREMENTS, functions)).toEqual([
      { severity: "major", message: "FR-009 は Must の機能要件ですが、担う処理がありません。" },
      { severity: "minor", message: "F-15 管理者の利用統計 に要件がありません。" },
      { severity: "minor", message: "F-16 の要件 FR-099 が要件定義書にありません。" },
    ]);
  });
});
