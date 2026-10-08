// 作成：Phase-27-3｜更新：Phase-28-3,28-4,30-5
import {
  FINDING_LEVELS,
  // Phase-28-4:追記
  type AiFinding,
  // Phase-28-3:追記
  type DesignStageRead,
  type FindingLevel,
  type PlanModel,
  type ProcedureDocModel,
  type StageIssue,
  // Phase-28-4:追記
  type TestPoint,
  // Phase-30-5:追記
  type UnitAiMarkdownRead,
  type UnitFile,
  type UnitFileKind,
  type UnitKind,
  // Phase-28-4:追記
  type UnitProcedure,
} from "@/features/detailed-design/api/types";
import { milestoneId, taskId } from "@/features/detailed-design/planOps";

// 段階8(実装手順書)の画面が使う純粋関数。作業単位の一覧は段階7から導き、未定義・要決定の一覧は
// 検証の指摘(決定的なチェック)と、手順書を作った AI の指摘を1つの形にそろえて出す。

const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
const list = (value: unknown) => (Array.isArray(value) ? (value as Record<string, unknown>[]) : []);
const pick = <T extends string>(value: unknown, choices: T[], fallback: T): T =>
  choices.includes(value as T) ? (value as T) : fallback;
// Phase-28-4：更新
// const FILE_KINDS: UnitFileKind[] = ["module", "test", "config"];
// ↓↓
export const FILE_KINDS: UnitFileKind[] = ["module", "test", "config"];

// 保存されている model(形の保証の無い JSON)を、表示できる形にそろえる。
export function toProcedureDoc(model: Record<string, unknown> | null): ProcedureDocModel {
  return {
    units: list(model?.units).map((unit) => ({
      unit_id: String(unit.unit_id ?? ""),
      title: String(unit.title ?? ""),
      purpose: String(unit.purpose ?? ""),
      files: list(unit.files).map((file) => ({
        path: String(file.path ?? ""),
        kind: pick<UnitFileKind>(file.kind, FILE_KINDS, "module"),
        responsibility: String(file.responsibility ?? ""),
        basis: String(file.basis ?? ""),
      })),
      notes: strings(unit.notes),
      tests: list(unit.tests).map((test) => ({
        viewpoint: String(test.viewpoint ?? ""),
        sut: String(test.sut ?? ""),
        driver: String(test.driver ?? ""),
        stub: String(test.stub ?? ""),
      })),
      gwt: strings(unit.gwt),
      verify: strings(unit.verify),
      findings: list(unit.findings).map((finding) => ({
        level: pick<FindingLevel>(finding.level, FINDING_LEVELS, "major"),
        target: String(finding.target ?? ""),
        message: String(finding.message ?? ""),
        fix_stage: Number(finding.fix_stage ?? 8),
      })),
    })),
  };
}

// 単位の一覧の1行。hasProcedure は、段階7と ID・タスク名の合う手順書があるか。
export type ProcedureUnit = {
  id: string;
  milestone: string;
  kind: UnitKind;
  title: string;
  functionIds: string[];
  dependsOn: string[];
  hasProcedure: boolean;
};

// 段階7の作業単位を、計画の並び順で返す。依存は前の単位だけを指すので、この順が依存順になる
// (並べ替えは要らない)。
export function procedureUnits(plan: PlanModel, doc: ProcedureDocModel): ProcedureUnit[] {
  const titles = new Map(doc.units.map((unit) => [unit.unit_id, unit.title.trim()]));
  return plan.milestones.flatMap((milestone, m) =>
    milestone.tasks.map((task, t) => {
      const id = taskId(m, t);
      return {
        id,
        milestone: milestoneId(m),
        kind: task.kind,
        title: task.title,
        functionIds: task.function_ids,
        dependsOn: task.depends_on,
        hasProcedure: titles.get(id) === task.title.trim(),
      };
    }),
  );
}

// 未定義・要決定の1件。unit が null なら単位によらない指摘。fixStage は直す先の段階。
export type Finding = {
  level: FindingLevel;
  source: "check" | "ai";
  unit: string | null;
  target: string;
  message: string;
  fixStage: number;
};

// 検証の指摘のうち重要度のあるもの(設計の不足)と、手順書の AI の指摘を1つの一覧にする。
// 重要度の無い検証の指摘(手順書そのもののエラー)は、検証の結果の一覧に出すので含めない。
export function collectFindings(issues: StageIssue[], doc: ProcedureDocModel): Finding[] {
  const checks: Finding[] = issues.flatMap((issue) =>
    issue.level
      ? [
          {
            level: issue.level,
            source: "check" as const,
            unit: issue.unit ?? null,
            target: issue.target ?? "",
            message: issue.message,
            fixStage: issue.fix_stage ?? 8,
          },
        ]
      : [],
  );
  const ai: Finding[] = doc.units.flatMap((unit) =>
    unit.findings.map((finding) => ({
      level: finding.level,
      source: "ai" as const,
      unit: unit.unit_id,
      target: finding.target,
      message: finding.message,
      fixStage: finding.fix_stage,
    })),
  );
  return sortFindings([...checks, ...ai]);
}

// 重要度の順(最重要が先)に並べる。同じ重要度の中では元の順を保つ。
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) => FINDING_LEVELS.indexOf(a.level) - FINDING_LEVELS.indexOf(b.level),
  );
}

export function countByLevel(findings: Finding[]): Record<FindingLevel, number> {
  const counts: Record<FindingLevel, number> = { critical: 0, major: 0, minor: 0 };
  for (const finding of findings) counts[finding.level] += 1;
  return counts;
}

// 重要度で絞り込む("all" はすべて)。
export function filterFindings(findings: Finding[], level: FindingLevel | "all"): Finding[] {
  return level === "all" ? findings : findings.filter((finding) => finding.level === level);
}

// 単位の指摘だけ(unit が null なら単位によらない指摘)。
export function findingsOfUnit(findings: Finding[], unit: string | null): Finding[] {
  return findings.filter((finding) => finding.unit === unit);
}

// Phase-28-3:追記
// 段階の保存済みの内容に残っている最重要の指摘の数(承認の前に確かめる)。検証の指摘と AI の指摘の両方を数える。
export function criticalCount(stage: DesignStageRead): number {
  return countByLevel(collectFindings(stage.issues, toProcedureDoc(stage.model))).critical;
}

// Phase-30-5:追記
// 「AI 向けにコピー」で写した md について、渡す前に知らせること(段階8が承認済みでない・未定義が残る)。
// 渡すのは止めない。無ければ空。
export function aiCopyNotices(result: UnitAiMarkdownRead): string[] {
  const notices: string[] = [];
  if (result.state === "outdated") {
    notices.push("段階8は古くなっています(手順書を作った後に設計が変わりました)。作り直してから渡すことを勧めます。");
  } else if (result.state !== "approved") {
    notices.push("段階8は未承認です(人が確定していない下書きです)。");
  }
  if (result.finding_total > 0) {
    notices.push(
      `この単位には未定義・要決定が ${result.finding_total} 件残っています(最重要 ${result.critical} 件)。決めてから渡すことを勧めます。`,
    );
  }
  return notices;
}

// 生成する単位の選択を切り替える。上限に達していれば足さない(外すのはいつでもできる)。
export function toggleUnit(selected: string[], id: string, max: number): string[] {
  if (selected.includes(id)) return selected.filter((item) => item !== id);
  return selected.length >= max ? selected : [...selected, id];
}

// Phase-28-4:追記
// ── 単位の手順書の編集 ──
// 編集は手順書のある単位だけ(無い単位は生成してから直す)。行は位置で扱う(行に固有の鍵が無い)。

type RowKey = "files" | "tests" | "findings";
type RowOf = { files: UnitFile; tests: TestPoint; findings: AiFinding };

const EMPTY_ROWS: { [K in RowKey]: () => RowOf[K] } = {
  files: () => ({ path: "", kind: "module", responsibility: "", basis: "" }),
  tests: () => ({ viewpoint: "", sut: "", driver: "", stub: "" }),
  findings: () => ({ level: "major", target: "", message: "", fix_stage: 8 }),
};

export function updateUnit(
  doc: ProcedureDocModel,
  unitId: string,
  patch: Partial<Omit<UnitProcedure, "unit_id" | "title">>,
): ProcedureDocModel {
  return {
    units: doc.units.map((unit) => (unit.unit_id === unitId ? { ...unit, ...patch } : unit)),
  };
}

// 単位の手順書を消す(段階7と合わない手順書を片付ける・作り直す前に空にする)。
export function removeUnit(doc: ProcedureDocModel, unitId: string): ProcedureDocModel {
  return { units: doc.units.filter((unit) => unit.unit_id !== unitId) };
}

function mapRows<K extends RowKey>(
  doc: ProcedureDocModel,
  unitId: string,
  key: K,
  change: (rows: RowOf[K][]) => RowOf[K][],
): ProcedureDocModel {
  return {
    units: doc.units.map((unit) =>
      unit.unit_id === unitId ? { ...unit, [key]: change(unit[key] as RowOf[K][]) } : unit,
    ),
  };
}

export function addUnitRow<K extends RowKey>(
  doc: ProcedureDocModel,
  unitId: string,
  key: K,
): ProcedureDocModel {
  return mapRows(doc, unitId, key, (rows) => [...rows, EMPTY_ROWS[key]()]);
}

export function updateUnitRow<K extends RowKey>(
  doc: ProcedureDocModel,
  unitId: string,
  key: K,
  index: number,
  patch: Partial<RowOf[K]>,
): ProcedureDocModel {
  return mapRows(doc, unitId, key, (rows) =>
    rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
  );
}

export function removeUnitRow<K extends RowKey>(
  doc: ProcedureDocModel,
  unitId: string,
  key: K,
  index: number,
): ProcedureDocModel {
  return mapRows(doc, unitId, key, (rows) => rows.filter((_, i) => i !== index));
}
