// 作成：Phase-27-3｜更新：Phase-28-3,28-4,30-5,31-5,38(完了後の調整),42-1
import {
  FINDING_LEVELS,
  // Phase-28-4:追記
  type AiFinding,
  // Phase-28-3:追記
  // Phase-31-5:追記
  type DesignDocument,
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

// Phase-31-5：更新
// // 段階8(実装手順書)の画面が使う純粋関数。作業単位の一覧は段階7から導き、未定義・要決定の一覧は
// // 検証の指摘(決定的なチェック)と、手順書を作った AI の指摘を1つの形にそろえて出す。
// ↓↓
// 段階8(実装手順書)の画面が使う純粋関数。作業単位の一覧は段階8の plan(詳細設計モードは段階7、
// 簡易モードは実装計画書の WBS)から導き、未定義・要決定の一覧は検証の指摘(決定的なチェック)と、
// 手順書を作った AI の指摘を1つの形にそろえて出す。

const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
const list = (value: unknown) => (Array.isArray(value) ? (value as Record<string, unknown>[]) : []);
const pick = <T extends string>(value: unknown, choices: T[], fallback: T): T =>
  choices.includes(value as T) ? (value as T) : fallback;
// Phase-28-4：更新
// const FILE_KINDS: UnitFileKind[] = ["module", "test", "config"];
// ↓↓
export const FILE_KINDS: UnitFileKind[] = ["module", "test", "config"];
// Phase-31-5:追記
export const DESIGN_DOCUMENTS: DesignDocument[] = [
  "requirements",
  "external_design",
  "internal_design",
  "implementation_plan",
];
const toDocument = (value: unknown): DesignDocument | null =>
  DESIGN_DOCUMENTS.includes(value as DesignDocument) ? (value as DesignDocument) : null;

// 保存されている model(形の保証の無い JSON)を、表示できる形にそろえる。
export function toProcedureDoc(model: Record<string, unknown> | null): ProcedureDocModel {
  return {
    units: list(model?.units).map((unit) => ({
      unit_id: String(unit.unit_id ?? ""),
      // Phase-42-1:追記
      unit_key: String(unit.unit_key ?? ""),
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
        // Phase-31-5:追記
        fix_document: toDocument(finding.fix_document),
      })),
    })),
  };
}

// Phase-31-5：更新
// // 単位の一覧の1行。hasProcedure は、段階7と ID・タスク名の合う手順書があるか。
// ↓↓
// 単位の一覧の1行。hasProcedure は、作業単位と ID・タスク名の合う手順書があるか。
export type ProcedureUnit = {
  id: string;
  // Phase-42-1:追記
  key: string; // 単位のキー(タスクにキーが無ければ単位の ID。devex-api の PlanUnit.key と同じ)
  milestone: string;
  kind: UnitKind;
  title: string;
  functionIds: string[];
  dependsOn: string[];
  hasProcedure: boolean;
};

// Phase-31-5：更新
// // 段階7の作業単位を、計画の並び順で返す。依存は前の単位だけを指すので、この順が依存順になる
// ↓↓
// 作業単位(段階7と同じ形)を、計画の並び順で返す。依存は前の単位だけを指すので、この順が依存順になる
// (並べ替えは要らない)。
export function procedureUnits(plan: PlanModel, doc: ProcedureDocModel): ProcedureUnit[] {
  const titles = new Map(doc.units.map((unit) => [unit.unit_id, unit.title.trim()]));
  return plan.milestones.flatMap((milestone, m) =>
    milestone.tasks.map((task, t) => {
      const id = taskId(m, t);
      return {
        id,
        // Phase-42-1:追記
        key: task.key || id,
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

// Phase-38(完了後の調整):追記
// 計画と合わない手順書(単位の ID が計画に無い、または ID は在るがタスク名が違う)。文書の再生成や
// Phase-42-1：更新
// // 段階7の並べ替えで単位が変わると残る。自動では消さず、人が今の単位へ付け替えるか消す。
// ↓↓
// 段階7の改名で単位が変わると残る(並べ替えは devex-api がキーで付け直すので残らない)。自動では消さず、
// 人が今の単位へ付け替えるか消す。
// index は doc.units の中の位置(同じ ID の手順書が2つあっても区別できるように)。
export type StrayProcedure = { index: number; unitId: string; title: string; fileCount: number };

export function strayProcedures(plan: PlanModel, doc: ProcedureDocModel): StrayProcedure[] {
  const titles = new Map(procedureUnits(plan, doc).map((unit) => [unit.id, unit.title.trim()]));
  return doc.units.flatMap((unit, index) =>
    titles.get(unit.unit_id.trim()) === unit.title.trim()
      ? []
      : [{ index, unitId: unit.unit_id, title: unit.title, fileCount: unit.files.length }],
  );
}

// 付け替え先の候補: 計画の単位のうち、その ID の手順書がまだ無いもの。ID は同じでタスク名だけ違う
// 手順書なら、自分の ID も候補にする(付け替えてもほかの手順書と ID が重ならない)。
export function reassignTargets(
  plan: PlanModel,
  doc: ProcedureDocModel,
  stray: StrayProcedure,
): ProcedureUnit[] {
  const taken = new Set(
    doc.units.filter((_, index) => index !== stray.index).map((unit) => unit.unit_id.trim()),
  );
  return procedureUnits(plan, doc).filter((unit) => !taken.has(unit.id));
}

// Phase-42-1：更新
// // 手順書の単位の ID とタスク名を、付け替え先の単位のものにする(中身は変えない)。
// ↓↓
// 手順書の単位のキー・ID・タスク名を、付け替え先の単位のものにする(中身は変えない)。
export function reassignUnit(
  doc: ProcedureDocModel,
  index: number,
  // Phase-42-1：更新
  // target: { id: string; title: string },
  // ↓↓
  target: { id: string; key: string; title: string },
): ProcedureDocModel {
  return {
    units: doc.units.map((unit, i) =>
      // Phase-42-1：更新
      // i === index ? { ...unit, unit_id: target.id, title: target.title } : unit,
      // ↓↓
      i === index
        ? { ...unit, unit_id: target.id, unit_key: target.key, title: target.title }
        : unit,
    ),
  };
}

// 位置で手順書を1つ消す(計画と合わない手順書は、同じ ID の手順書と区別するため位置で消す)。
export function removeUnitAt(doc: ProcedureDocModel, index: number): ProcedureDocModel {
  return { units: doc.units.filter((_, i) => i !== index) };
}

// 計画と合わない手順書をすべて消す。
export function removeStrayProcedures(plan: PlanModel, doc: ProcedureDocModel): ProcedureDocModel {
  const stray = new Set(strayProcedures(plan, doc).map((item) => item.index));
  return { units: doc.units.filter((_, i) => !stray.has(i)) };
}

// Phase-31-5：更新
// // 未定義・要決定の1件。unit が null なら単位によらない指摘。fixStage は直す先の段階。
// ↓↓
// 未定義・要決定の1件。unit が null なら単位によらない指摘。fixStage は直す先の段階、fixDocument は
// 簡易モードの直す先の文書(あれば fixStage より優先する)。
export type Finding = {
  level: FindingLevel;
  source: "check" | "ai";
  unit: string | null;
  target: string;
  message: string;
  fixStage: number;
  // Phase-31-5:追記
  fixDocument: DesignDocument | null;
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
            // Phase-31-5:追記
            fixDocument: issue.fix_document ?? null,
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
      // Phase-31-5:追記
      fixDocument: finding.fix_document ?? null,
    })),
  );
  return sortFindings([...checks, ...ai]);
// Phase-31-5:追記
}

// 直す先の行き先。document は文書の画面(SCR-005)で再生成する、stage はその段階へ移る、null は直す先が
// 無い(手順書の上の指摘)。
export type FixTarget =
  | { kind: "document"; document: DesignDocument }
  | { kind: "stage"; stage: number }
  | null;

export function fixTarget(fixStage: number, fixDocument: DesignDocument | null | undefined): FixTarget {
  if (fixDocument) return { kind: "document", document: fixDocument };
  return fixStage >= 1 && fixStage < 8 ? { kind: "stage", stage: fixStage } : null;
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
