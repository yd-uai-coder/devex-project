// 作成：Phase-51-3
import { describe, expect, it } from "vitest";
import { DEMO_FINDINGS, DEMO_POINTS } from "../demoData";
import {
  decisionCounts,
  gateStatus,
  gatesOf,
  regenerationFindings,
  regenerationInstruction,
  rehearingQuestions,
  reopenPoints,
  reviewEnabled,
  sortFindings,
  unreviewedNotice,
  type Decision,
} from "../reviewModel";

const detailed = DEMO_FINDINGS.detailed;
const decided = (entries: [string, Decision][]) => new Map<string, Decision>(entries);

describe("reviewEnabled", () => {
  it("superuser が設定をオンにしたときだけ動く", () => {
    expect(reviewEnabled({ isSuperuser: true, reviewSetting: true })).toBe(true);
    expect(reviewEnabled({ isSuperuser: true, reviewSetting: false })).toBe(false);
  });

  it("superuser でなければ、保存された設定がオンでも動かない", () => {
    expect(reviewEnabled({ isSuperuser: false, reviewSetting: true })).toBe(false);
  });
});

describe("区切り", () => {
  it("簡易は4文書の生成後に自動の1つ、詳細は要件・外部が自動で段階6・7がボタン", () => {
    expect(gatesOf("simple").map((g) => [g.key, g.trigger])).toEqual([["simple-docs", "auto"]]);
    expect(gatesOf("detailed").map((g) => [g.key, g.trigger])).toEqual([
      ["detailed-docs", "auto"],
      ["detailed-stage6", "button"],
      ["detailed-stage7", "button"],
    ]);
  });

  it("区切りの状態: 文書が無い → 未レビュー → レビュー済み、失敗は失敗", () => {
    expect(gateStatus(false, false, false)).toBe("not_ready");
    expect(gateStatus(true, false, false)).toBe("unreviewed");
    expect(gateStatus(true, true, false)).toBe("reviewed");
    expect(gateStatus(true, true, true)).toBe("failed");
  });

  it("手順書の生成のときに、未レビュー・失敗の区切りを知らせる(文書の無い区切りは数えない)", () => {
    const [docs, stage6, stage7] = gatesOf("detailed");
    const notice = unreviewedNotice([
      { gate: docs, status: "reviewed" },
      { gate: stage6, status: "unreviewed" },
      { gate: stage7, status: "not_ready" },
    ]);

    expect(notice).toContain("段階6の承認の後");
    expect(notice).not.toContain("段階7");
    expect(unreviewedNotice([{ gate: docs, status: "reviewed" }])).toBeNull();
  });
});

describe("指摘の並びと採否", () => {
  it("重要度の順(最重要 → 中程度 → 軽微)に並べる", () => {
    const levels = sortFindings(detailed).map((f) => f.level);

    expect(levels.indexOf("minor")).toBeGreaterThan(levels.lastIndexOf("critical"));
    expect(levels[0]).toBe("critical");
  });

  it("判断していない指摘は未判断として数える", () => {
    const counts = decisionCounts(detailed, decided([["D-01", "adopted"], ["D-05", "rejected"]]));

    expect(counts).toEqual({ open: detailed.length - 2, adopted: 1, rejected: 1, held: 0 });
  });
});

describe("差し戻し", () => {
  it("再生成の指示には、採用した設計・不整合の指摘だけを入れる(ヒアリング・却下・保留は入れない)", () => {
    const decisions = decided([
      ["D-01", "adopted"],
      ["D-03", "adopted"],
      ["D-05", "held"],
      ["D-06", "rejected"],
    ]);

    expect(regenerationFindings(detailed, decisions).map((f) => f.id)).toEqual(["D-01"]);
    const text = regenerationInstruction(detailed, decisions);
    expect(text).toContain("指摘に無い部分は変えない");
    expect(text).toContain("1. [最重要] SCR-004");
    expect(regenerationInstruction(detailed, new Map())).toBe("");
  });

  it("採用したヒアリングの指摘は、観点を未決に戻す(もともと未決の観点は戻したことにしない)", () => {
    const { points, reopened } = reopenPoints(
      DEMO_POINTS.detailed,
      detailed,
      decided([["D-03", "adopted"], ["D-04", "held"]]),
    );

    expect(reopened).toEqual(["security"]);
    expect(points.find((p) => p.key === "security")?.status).toBe("open");
    expect(points.find((p) => p.key === "abuse")?.status).toBe("decided");

    const simple = reopenPoints(DEMO_POINTS.simple, DEMO_FINDINGS.simple, decided([["S-03", "adopted"]]));
    expect(simple.reopened).toEqual([]);
  });

  it("聞き直しの問いかけは観点ごとにまとめる", () => {
    const questions = rehearingQuestions(DEMO_POINTS.detailed, detailed, decided([["D-03", "adopted"], ["D-04", "adopted"]]));

    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatch(/^「セキュリティ」について確認させてください/);
  });
});
