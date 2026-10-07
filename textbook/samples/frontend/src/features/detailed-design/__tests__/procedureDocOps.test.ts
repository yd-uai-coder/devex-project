// 作成：Phase-27-3
import { describe, expect, it } from "vitest";
import { FINDING_LEVELS, type StageIssue } from "@/features/detailed-design/api/types";
import { FINDING_LEVEL_LABELS, FINDING_SOURCE_LABELS, STAGE_TITLES } from "@/features/detailed-design/labels";
import {
  collectFindings,
  countByLevel,
  filterFindings,
  findingsOfUnit,
  procedureUnits,
  sortFindings,
  toProcedureDoc,
  type Finding,
} from "@/features/detailed-design/procedureDocOps";
import { makePlan, makeProcedureDoc } from "../test-utils/stageFixtures";

// SUT: procedureDocOps の純粋関数 / ドライバ: このテスト。
// スタブ不要 ── 対象は引数の model と指摘だけから決まり、ストアや API を呼ばないため。

const check = (patch: Partial<StageIssue>): StageIssue => ({
  severity: "warning",
  code: "NO_PROCEDURE",
  message: "m",
  target: "F-01",
  level: "major",
  fix_stage: 5,
  unit: "M-01-T02",
  ...patch,
});

describe("procedureDocOps", () => {
  it("段階8の名前と重要度・出どころのラベルを持つ", () => {
    expect(STAGE_TITLES[8]).toBe("実装手順書");
    expect(FINDING_LEVELS.map((level) => FINDING_LEVEL_LABELS[level])).toEqual(["最重要", "中程度", "軽微"]);
    expect(FINDING_SOURCE_LABELS.ai).toBe("AI");
  });

  it("toProcedureDoc は保存された model を表示できる形にそろえる", () => {
    const doc = toProcedureDoc({
      units: [{ unit_id: "M-01-T01", files: [{ path: "x", kind: "?" }], findings: [{ level: "?" }] }],
    });

    expect(doc.units[0].title).toBe("");
    expect(doc.units[0].files[0].kind).toBe("module");
    expect(doc.units[0].findings[0]).toEqual({ level: "major", target: "", message: "", fix_stage: 8 });
    expect(toProcedureDoc(null)).toEqual({ units: [] });
  });

  it("procedureUnits は段階7の並び順で単位を並べ、ID とタスク名の合う手順書だけを生成済にする", () => {
    const units = procedureUnits(makePlan(), makeProcedureDoc());

    expect(units.map((u) => [u.id, u.milestone, u.kind, u.dependsOn, u.hasProcedure])).toEqual([
      ["M-01-T01", "M-01", "base", [], false],
      ["M-01-T02", "M-01", "feature", ["M-01-T01"], true],
    ]);
    const renamed = makeProcedureDoc();
    renamed.units[0].title = "別のタスク";
    expect(procedureUnits(makePlan(), renamed)[1].hasProcedure).toBe(false);
  });

  it("collectFindings は重要度のある検証の指摘と AI の指摘をまとめ、重要度の順に並べる", () => {
    const issues = [
      check({ level: "minor", code: "UNRESOLVED_CALL" }),
      check({ severity: "error", code: "UNIT_MISMATCH", level: null, fix_stage: 8 }),
      check({ unit: null }),
    ];

    const findings = collectFindings(issues, makeProcedureDoc());

    expect(findings.map((f) => [f.level, f.source, f.unit, f.fixStage])).toEqual([
      ["critical", "ai", "M-01-T02", 7],
      ["major", "check", null, 5],
      ["minor", "check", "M-01-T02", 5],
    ]);
  });

  it("件数・絞り込み・単位ごとの抽出", () => {
    const findings: Finding[] = sortFindings(collectFindings([check({}), check({ unit: null })], makeProcedureDoc()));

    expect(countByLevel(findings)).toEqual({ critical: 1, major: 2, minor: 0 });
    expect(filterFindings(findings, "major")).toHaveLength(2);
    expect(filterFindings(findings, "all")).toHaveLength(3);
    expect(findingsOfUnit(findings, null)).toHaveLength(1);
    expect(findingsOfUnit(findings, "M-01-T02")).toHaveLength(2);
  });
});
