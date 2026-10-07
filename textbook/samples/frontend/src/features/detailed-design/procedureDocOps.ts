// 作成：Phase-27-3
import {
  FINDING_LEVELS,
  type FindingLevel,
  type PlanModel,
  type ProcedureDocModel,
  type StageIssue,
  type UnitFileKind,
  type UnitKind,
} from "@/features/detailed-design/api/types";
import { milestoneId, taskId } from "@/features/detailed-design/planOps";

// 段階8(実装手順書)の画面が使う純粋関数。作業単位の一覧は段階7から導き、未定義・要決定の一覧は
// 検証の指摘(決定的なチェック)と、手順書を作った AI の指摘を1つの形にそろえて出す。

const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
const list = (value: unknown) => (Array.isArray(value) ? (value as Record<string, unknown>[]) : []);
const pick = <T extends string>(value: unknown, choices: T[], fallback: T): T =>
  choices.includes(value as T) ? (value as T) : fallback;
const FILE_KINDS: UnitFileKind[] = ["module", "test", "config"];

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
