// 作成：Phase-27-3｜更新：Phase-28-3,28-4,30-5,31-5,38(完了後の調整),42-1
// Phase-38(完了後の調整):追記 ── @/features/detailed-design/procedureDocOps(reassignTargets, reassignUnit, removeStrayProcedures, removeUnitAt, strayProcedures)
import { describe, expect, it } from "vitest";
import { FINDING_LEVELS, type StageIssue } from "@/features/detailed-design/api/types";
// Phase-31-5：更新
// import { FINDING_LEVEL_LABELS, FINDING_SOURCE_LABELS, STAGE_TITLES } from "@/features/detailed-design/labels";
// ↓↓
import {
  DESIGN_DOCUMENT_LABELS,
  FINDING_LEVEL_LABELS,
  FINDING_SOURCE_LABELS,
  STAGE_TITLES,
} from "@/features/detailed-design/labels";
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
  // Phase-31-5:追記
  fixTarget,
  procedureUnits,
  // Phase-28-4:追記
  reassignTargets,
  reassignUnit,
  removeStrayProcedures,
  removeUnit,
  removeUnitAt,
  removeUnitRow,
  sortFindings,
  // Phase-28-3:追記
  strayProcedures,
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
    // Phase-42-1:追記
    expect(doc.units[0].unit_key).toBe("");
    expect(doc.units[0].files[0].kind).toBe("module");
    // Phase-31-5：更新
    // expect(doc.units[0].findings[0]).toEqual({ level: "major", target: "", message: "", fix_stage: 8 });
    // ↓↓
    expect(doc.units[0].findings[0]).toEqual({
      level: "major",
      target: "",
      message: "",
      fix_stage: 8,
      fix_document: null,
    });
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
    // Phase-42-1:追記
    // 単位のキー(タスクにキーが無ければ単位の ID)
    expect(units.map((u) => u.key)).toEqual(["U-001", "U-002"]);
    const unkeyed = makePlan();
    unkeyed.milestones[0].tasks[0].key = "";
    expect(procedureUnits(unkeyed, makeProcedureDoc())[0].key).toBe("M-01-T01");
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

  // Phase-31-5:追記
  it("簡易モードの指摘は直す先の文書を持ち、直す先は文書を段階より優先する", () => {
    const doc = toProcedureDoc({
      units: [
        {
          unit_id: "M-01-T02",
          findings: [{ target: "DF-1", fix_stage: 8, fix_document: "internal_design" }, { fix_document: "x" }],
        },
      ],
    });
    const findings = collectFindings(
      [check({ code: "UNKNOWN_DATAFLOW", fix_stage: 8, fix_document: "implementation_plan" })],
      doc,
    );

    expect(doc.units[0].findings.map((f) => f.fix_document)).toEqual(["internal_design", null]);
    expect(findings.map((f) => [f.source, f.fixDocument])).toEqual([
      ["check", "implementation_plan"],
      ["ai", "internal_design"],
      ["ai", null],
    ]);
    expect(fixTarget(8, "internal_design")).toEqual({ kind: "document", document: "internal_design" });
    expect(fixTarget(5, null)).toEqual({ kind: "stage", stage: 5 });
    expect(fixTarget(8, null)).toBeNull();
    expect(DESIGN_DOCUMENT_LABELS.implementation_plan).toBe("実装計画書");
  });

  // Phase-38(完了後の調整):追記
  describe("計画に無い手順書", () => {
    // makePlan の単位は M-01-T01(開発環境を用意する)・M-01-T02(予約を登録する)。
    // M-01-T02 は合う手順書、M-06-T01 は計画から消えた単位、M-01-T01 は ID だけ合ってタスク名が違う
    const docWithStrays = () => {
      const base = makeProcedureDoc();
      const [unit] = base.units;
      return {
        units: [
          unit,
          { ...unit, unit_id: "M-06-T01", title: "古いタスク" },
          { ...unit, unit_id: "M-01-T01", title: "別の名前", files: [] },
        ],
      };
    };

    it("strayProceduresは計画に無い ID と、タスク名の違う手順書を位置つきで拾う", () => {
      expect(strayProcedures(makePlan(), makeProcedureDoc())).toEqual([]);
      expect(strayProcedures(makePlan(), docWithStrays())).toEqual([
        { index: 1, unitId: "M-06-T01", title: "古いタスク", fileCount: 1 },
        { index: 2, unitId: "M-01-T01", title: "別の名前", fileCount: 0 },
      ]);
    });

    it("付け替え先は手順書の無い単位だけ(同じ ID のタスク名違いは自分の ID も候補)", () => {
      const doc = docWithStrays();
      const [gone, renamed] = strayProcedures(makePlan(), doc);
      // M-01-T01 はタスク名違いの手順書が使っているので、M-06-T01 の候補にならない
      expect(reassignTargets(makePlan(), doc, gone)).toEqual([]);
      expect(reassignTargets(makePlan(), doc, renamed).map((unit) => unit.id)).toEqual(["M-01-T01"]);

      const onlyGone = { units: doc.units.slice(0, 2) };
      const [stray] = strayProcedures(makePlan(), onlyGone);
      expect(reassignTargets(makePlan(), onlyGone, stray).map((unit) => unit.id)).toEqual([
        "M-01-T01",
      ]);
    });

    // Phase-42-1：更新
    // it("reassignUnitは ID とタスク名だけを付け替え、中身はそのまま残す", () => {
    // ↓↓
    it("reassignUnitはキー・ID・タスク名だけを付け替え、中身はそのまま残す", () => {
      const doc = docWithStrays();
      // Phase-42-1：更新
      // const moved = reassignUnit(doc, 1, { id: "M-01-T01", title: "開発環境を用意する" });
      // ↓↓
      const moved = reassignUnit(doc, 1, {
        id: "M-01-T01",
        key: "U-001",
        title: "開発環境を用意する",
      });

      expect(moved.units[1]).toEqual({
        ...doc.units[1],
        unit_id: "M-01-T01",
        // Phase-42-1:追記
        unit_key: "U-001",
        title: "開発環境を用意する",
      });
      expect(moved.units[0]).toBe(doc.units[0]);
    });

    it("位置で1つ消す・計画と合わない手順書をすべて消す(合う手順書は残す)", () => {
      const doc = docWithStrays();

      expect(removeUnitAt(doc, 2).units.map((unit) => unit.unit_id)).toEqual([
        "M-01-T02",
        "M-06-T01",
      ]);
      expect(removeStrayProcedures(makePlan(), doc)).toEqual(makeProcedureDoc());
    });
  });
});
