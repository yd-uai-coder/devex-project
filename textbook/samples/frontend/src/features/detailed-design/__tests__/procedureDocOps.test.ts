// 作成：Phase-27-3｜更新：Phase-28-3,28-4,30-5
import { describe, expect, it } from "vitest";
import { FINDING_LEVELS, type StageIssue } from "@/features/detailed-design/api/types";
import { FINDING_LEVEL_LABELS, FINDING_SOURCE_LABELS, STAGE_TITLES } from "@/features/detailed-design/labels";
import {
  // Phase-28-4:追記
  addUnitRow,
  collectFindings,
  countByLevel,
  // Phase-30-5:追記
  aiCopyNotices,
  // Phase-28-3:追記
  criticalCount,
  filterFindings,
  findingsOfUnit,
  procedureUnits,
  // Phase-28-4:追記
  removeUnit,
  removeUnitRow,
  sortFindings,
  // Phase-28-3:追記
  toggleUnit,
  toProcedureDoc,
  // Phase-28-4:追記
  updateUnit,
  updateUnitRow,
  type Finding,
} from "@/features/detailed-design/procedureDocOps";
// Phase-28-3：更新
// import { makePlan, makeProcedureDoc } from "../test-utils/stageFixtures";
// ↓↓
import { makePlan, makeProcedureDoc, makeStages } from "../test-utils/stageFixtures";

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

  // Phase-28-3:追記
  it("criticalCount は保存済みの内容の、検証と AI の最重要を数える", () => {
    const stage = makeStages({
      8: { model: makeProcedureDoc(), issues: [check({ level: "critical" }), check({})] },
    })[7];

    expect(criticalCount(stage)).toBe(2);
    expect(criticalCount(makeStages()[7])).toBe(0);
  });

  // Phase-30-5:追記
  it("aiCopyNotices は未承認・古い・未定義の残りを知らせ、承認済みで残りが無ければ空", () => {
    const base = { unit_id: "M-01-T02", markdown: "", finding_total: 0, critical: 0 };

    expect(aiCopyNotices({ ...base, state: "approved" })).toEqual([]);
    expect(aiCopyNotices({ ...base, state: "reviewing" })).toEqual([
      "段階8は未承認です(人が確定していない下書きです)。",
    ]);
    const outdated = aiCopyNotices({ ...base, state: "outdated", finding_total: 3, critical: 1 });
    expect(outdated).toHaveLength(2);
    expect(outdated[0]).toContain("古くなっています");
    expect(outdated[1]).toBe(
      "この単位には未定義・要決定が 3 件残っています(最重要 1 件)。決めてから渡すことを勧めます。",
    );
  });

  it("toggleUnit は上限まで足し、外すのはいつでもできる", () => {
    expect(toggleUnit([], "M-01-T01", 2)).toEqual(["M-01-T01"]);
    expect(toggleUnit(["A", "B"], "C", 2)).toEqual(["A", "B"]);
    expect(toggleUnit(["A", "B"], "A", 2)).toEqual(["B"]);
  });

  // Phase-28-4:追記
  it("単位の欄と行を編集し、他の単位はそのまま残す", () => {
    const doc = makeProcedureDoc();
    doc.units.push({ ...doc.units[0], unit_id: "M-01-T01", title: "開発環境を用意する" });

    const edited = updateUnit(doc, "M-01-T02", { purpose: "直した", notes: ["要点"] });
    const added = addUnitRow(edited, "M-01-T02", "findings");
    const updated = updateUnitRow(added, "M-01-T02", "findings", 1, { level: "minor", fix_stage: 3 });
    const removed = removeUnitRow(updated, "M-01-T02", "files", 0);

    const [unit, other] = removed.units;
    expect([unit.purpose, unit.notes, unit.files]).toEqual(["直した", ["要点"], []]);
    expect(unit.findings[1]).toEqual({ level: "minor", target: "", message: "", fix_stage: 3 });
    expect(other).toEqual(doc.units[1]);
    expect(addUnitRow(doc, "M-01-T02", "tests").units[0].tests[1]).toEqual({
      viewpoint: "",
      sut: "",
      driver: "",
      stub: "",
    });
  });

  it("removeUnit は単位の手順書を消す", () => {
    expect(removeUnit(makeProcedureDoc(), "M-01-T02").units).toEqual([]);
  });
});
