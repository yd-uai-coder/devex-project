// 作成：Phase-44-1｜更新：Phase-44-4,44(完了後の調整)
// Phase-44-4:追記 ── @/features/detailed-design/api/types(MAX_LOGIC_TARGETS, MAX_PROCEDURE_DOC_TARGETS, MAX_PROCEDURE_TARGETS, RegenerationTargetRead)
import {
  MAX_LOGIC_TARGETS,
  MAX_PROCEDURE_DOC_TARGETS,
  MAX_PROCEDURE_TARGETS,
  type DesignImpactRead,
  type DesignStageRead,
  type ElementChangeKind,
  type ImpactMarkRead,
  type LogicTarget,
  type PlanModel,
  type RegenerationTargetRead,
} from "@/features/detailed-design/api/types";
import { toCrud } from "@/features/detailed-design/crudOps";
import { toFunctionList } from "@/features/detailed-design/functionListOps";
import { DESIGN_DOCUMENT_LABELS } from "@/features/detailed-design/labels";
import { logicKey, toLogics } from "@/features/detailed-design/logicOps";
import { toModuleList } from "@/features/detailed-design/moduleListOps";
import { taskId, toPlan } from "@/features/detailed-design/planOps";

// 変更の影響の画面(作業領域の「変更の影響」パネル・段階の表の行の印・「表で見る」)が使う純粋関数。
// 要素のキーは devex-api app/detailed_design/impact/elements.py と同じ形で組み立てる。

export const elementKey = {
  fn: (id: string) => `fn:${id}`,
  summary: (functionId: string) => `summary:${functionId}`,
  // テーブルは前後の空白を除いて小文字にした名前(devex-api の table_key)
  table: (name: string) => `table:${tableName(name)}`,
  crud: (functionId: string, table: string) => `crud:${functionId}×${tableName(table)}`,
  module: (path: string) => `module:${path}`,
  proc: (functionId: string) => `proc:${functionId}`,
  logic: (module: string, fn: string) => `logic:${logicKey(module, fn)}`,
  task: (unitKey: string) => `task:${unitKey}`,
  cc: (topic: string) => `cc:${topic}`,
  unit: (unitKey: string) => `unit:${unitKey}`,
};

function tableName(name: string): string {
  return name.trim().toLowerCase();
}

export const CHANGE_KIND_LABELS: Record<ElementChangeKind, string> = {
  added: "増えた",
  removed: "消えた",
  content: "内容の変更",
  rename: "改名",
};

// 変わった場所(stage:<n> / doc:<doc_type>)の表示
const DOC_LABELS: Record<string, string> = DESIGN_DOCUMENT_LABELS;

export function sourceLabel(source: string): string {
  if (source.startsWith("stage:")) return `段階${source.slice("stage:".length)}`;
  if (source.startsWith("doc:")) {
    const doc = source.slice("doc:".length);
    return DOC_LABELS[doc] ?? doc;
  }
  return source;
}

// たどった道の表示(先頭が変わった要素)
export function pathText(path: string[]): string {
  return path.join(" → ");
}

// 影響を取りに行く必要があるか。記録した印があるか、承認の後に編集した段階(承認すると届く印 pending
// がありうる)があるときだけ取る(簡易モードは段階8だけで印が無いので取らない)。
export function mayHaveImpact(stages: DesignStageRead[]): boolean {
  if (stages[0]?.mode !== "detailed") return false;
  return stages.some(
    (s) =>
      (s.impact_open ?? 0) + (s.impact_reviewed ?? 0) > 0 ||
      (s.approved_version !== null && s.state !== "approved"),
  );
}

// 段階に届いた印(要素のキー → 印)。同じ要素に記録した印と pending の印があれば、記録した印を残す。
export function marksByKey(
  impact: DesignImpactRead | null,
  stage: number,
): Map<string, ImpactMarkRead> {
  const marks = new Map<string, ImpactMarkRead>();
  const item = impact?.stages.find((s) => s.stage === stage);
  for (const mark of item?.marks ?? []) {
    const previous = marks.get(mark.key);
    if (previous === undefined || (previous.pending && !mark.pending)) marks.set(mark.key, mark);
  }
  return marks;
}

// 印の状態の表示(見直し・確認済み・承認すると付く)
export type MarkStatus = "open" | "reviewed" | "pending";

export function markStatus(mark: ImpactMarkRead): MarkStatus {
  if (mark.pending) return "pending";
  return mark.reviewed ? "reviewed" : "open";
}

export const MARK_STATUS_LABELS: Record<MarkStatus, string> = {
  open: "見直し",
  reviewed: "確認済み",
  pending: "承認すると付く",
};

// 段階の、未確認の記録した印のキー(「この段階の未確認をすべて確認済みにする」の対象)
export function openMarkKeys(impact: DesignImpactRead | null, stage: number): string[] {
  return [...marksByKey(impact, stage).values()]
    .filter((m) => markStatus(m) === "open")
    .map((m) => m.key);
}

// Phase-44(完了後の調整):追記
// 印のある段階と、その段階の未確認の記録した印の数(段階の順。パネルの段階の絞り込みのボタン)
export function stageMarkSummary(
  impact: DesignImpactRead | null,
): { stage: number; open: number }[] {
  return (impact?.stages ?? [])
    .filter((s) => s.marks.length > 0)
    .map((s) => ({ stage: s.stage, open: s.open }));
}

// パネルに出す印(「未確認のみ」なら、確認済みと承認すると付く印を除く)
export function visibleMarks(marks: ImpactMarkRead[], openOnly: boolean): ImpactMarkRead[] {
  return openOnly ? marks.filter((m) => markStatus(m) === "open") : marks;
}

// 印か変わったものがあるか(無ければパネルを出さない)
export function hasImpact(impact: DesignImpactRead | null): boolean {
  return (impact?.stages ?? []).some((s) => s.marks.length > 0 || s.changes.length > 0);
}

// 未確認の記録した印の件数(全段階)
export function openTotal(impact: DesignImpactRead | null): number {
  return (impact?.stages ?? []).reduce((sum, s) => sum + s.open, 0);
}

// Phase-44-4:追記
// 1回の部分再生成で選べる候補の数(段階ごとの生成の上限。devex-api と同じ)
export const REGENERATION_LIMITS: Record<number, number> = {
  5: MAX_PROCEDURE_TARGETS,
  6: MAX_LOGIC_TARGETS,
  8: MAX_PROCEDURE_DOC_TARGETS,
};

// 再生成の候補を段階ごとにまとめる(段階の順)
export function regenerationGroups(
  targets: RegenerationTargetRead[],
): { stage: number; targets: RegenerationTargetRead[] }[] {
  const stages = [...new Set(targets.map((t) => t.stage))].sort((a, b) => a - b);
  return stages.map((stage) => ({ stage, targets: targets.filter((t) => t.stage === stage) }));
}

// ── ここから Phase-44-1 の作成分 ──
// 部分再生成の引数。段階5は処理ID、段階6は(モジュール, 関数)、段階8は単位の ID(段階8の作業単位
// plan で、単位のキーから今の表示の ID を引く)。引けないキーは捨てる。
export type RegenerationArgs = {
  functionIds?: string[];
  logics?: LogicTarget[];
  unitIds?: string[];
};

export function regenerationArgs(
  stage: number,
  keys: string[],
  plan: Record<string, unknown> | null,
): RegenerationArgs {
  if (stage === 5) {
    return { functionIds: stripPrefix(keys, "proc:") };
  }
  if (stage === 6) {
    const logics = stripPrefix(keys, "logic:").flatMap((key) => {
      const at = key.indexOf("::");
      return at < 0 ? [] : [{ module: key.slice(0, at), function: key.slice(at + 2) }];
    });
    return { logics };
  }
  if (stage === 8) {
    const ids = unitIdsByKey(toPlan(plan));
    return { unitIds: stripPrefix(keys, "unit:").flatMap((key) => ids.get(key) ?? []) };
  }
  return {};
}

function stripPrefix(keys: string[], prefix: string): string[] {
  return keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
}

// 単位のキー → 表示の ID(キーの無い単位は ID をキーとみなす。devex-ui の procedureUnits と同じ)
function unitIdsByKey(plan: PlanModel): Map<string, string> {
  const ids = new Map<string, string>();
  plan.milestones.forEach((milestone, m) =>
    milestone.tasks.forEach((task, t) => {
      const id = taskId(m, t);
      ids.set(task.key || id, id);
    }),
  );
  return ids;
}

// 「段階Nで直す」の直す先(LLM が書く文字列。「段階3 reservations」「F-01」「M-01-T02」など)から、
// 段階の表の要素のキーを推定する。当たらなければ null(段階を開くだけ)。
export function resolveFixTarget(
  stage: number,
  text: string,
  stages: DesignStageRead[],
): string | null {
  const model = stages.find((s) => s.stage === stage)?.model ?? null;
  const fid = text.match(/F-\d+/)?.[0] ?? null;
  const has = (word: string) => word.trim() !== "" && text.toLowerCase().includes(word.trim().toLowerCase());
  switch (stage) {
    case 1:
      return fid && toFunctionList(model).functions.some((f) => f.id === fid) ? elementKey.fn(fid) : null;
    case 2:
      return fid ? elementKey.summary(fid) : null;
    case 3: {
      const cells = toCrud(model).cells;
      const tables = longestFirst([
        ...cells.map((c) => c.table),
        ...(stages.find((s) => s.stage === 3)?.dfd_accesses ?? []).map((a) => a.table),
      ]).filter(has);
      if (tables.length === 0) return null;
      const cell = fid ? cells.find((c) => c.function_id === fid && tableName(c.table) === tableName(tables[0])) : undefined;
      return cell ? elementKey.crud(cell.function_id, cell.table) : elementKey.table(tables[0]);
    }
    case 4: {
      const path = longestFirst(toModuleList(model).modules.map((m) => m.path)).find(has);
      return path ? elementKey.module(path) : null;
    }
    case 5:
      return fid ? elementKey.proc(fid) : null;
    case 6: {
      const rows = toLogics(model).logics.filter((row) => has(row.function));
      const row = rows.find((r) => has(r.module)) ?? (rows.length === 1 ? rows[0] : undefined);
      return row ? elementKey.logic(row.module, row.function) : null;
    }
    case 7: {
      const plan = toPlan(model);
      const unitId = text.match(/M-\d+-T\d+/)?.[0];
      if (unitId) {
        const found = [...unitIdsByKey(plan)].find(([, id]) => id === unitId);
        if (found) return elementKey.task(found[0]);
      }
      const topic = longestFirst(plan.crosscutting.map((row) => row.topic)).find(has);
      return topic ? elementKey.cc(topic) : null;
    }
    case 8: {
      const unitId = text.match(/M-\d+-T\d+/)?.[0];
      const plan = toPlan(stages.find((s) => s.stage === 8)?.plan ?? null);
      const found = unitId ? [...unitIdsByKey(plan)].find(([, id]) => id === unitId) : undefined;
      return found ? elementKey.unit(found[0]) : null;
    }
    default:
      return null;
  }
}

// 短い名前が長い名前の一部に当たらないよう、長い順に並べる(重複なし)
function longestFirst(words: string[]): string[] {
  return [...new Set(words.map((w) => w.trim()).filter((w) => w))].sort((a, b) => b.length - a.length);
}

// 段階5・6 のパネルがタブを開くための移動先(既存の focus の target)。段階5は手順ID(F-01#4)か処理ID、
// 段階6は関数の鍵。要素のキーから導けなければ元の文字列のまま。
export function focusTargetFor(stage: number, target: string, key: string | null): string {
  if (stage === 5 && !/^F-\d+(#\d+)?$/.test(target) && key?.startsWith("proc:")) {
    return key.slice("proc:".length);
  }
  if (stage === 6 && key?.startsWith("logic:")) return key.slice("logic:".length);
  return target;
}
