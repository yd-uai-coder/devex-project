// 作成：Phase-17-6｜更新：Phase-109-1
// 写経レベル: コア ── グループの上限と、「内容がある」の判定をバックエンドとそろえる。
// Phase-109-1:追記 ── @/features/detailed-design/api/types.FunctionRow
import {
  MAX_DFD_GROUPS,
  type DataFlowModel,
  type FunctionListModel,
  type FunctionRow,
  type ProcessSummaryRow,
} from "@/features/detailed-design/api/types";

// 段階2(データフロー)の編集操作(純粋関数)。どれも新しいモデルを返し、引数は変えない。
// 処理概要表の行は段階1の処理IDで処理を指す。表は機能一覧の並びで出すので、行の並び替えは
// しない(バックエンドの merge_summaries も機能一覧の並びで返す)。

// 保存されている model(形の保証の無い JSON)を、編集できる形にそろえる。
export function toDataFlow(model: Record<string, unknown> | null): DataFlowModel {
  const dfdGroups = Array.isArray(model?.dfd_groups)
    ? (model.dfd_groups as unknown[]).map(String)
    : [];
  const summaries = Array.isArray(model?.summaries)
    ? (model.summaries as Partial<ProcessSummaryRow>[]).map(
        (row): ProcessSummaryRow => ({
          function_id: String(row.function_id ?? ""),
          input: String(row.input ?? ""),
          process: String(row.process ?? ""),
          output: String(row.output ?? ""),
        }),
      )
    : [];
  return { dfd_groups: dfdGroups, summaries };
}

// 下書きの内容があるか(作り直しの確認を出すかの判定)。グループの選択だけを保存した状態は
// 内容なしとみなす(バックエンドの _has_draft と同じ)。
export function hasDraft(model: DataFlowModel): boolean {
  return model.summaries.length > 0;
}

// DFD を描くグループを選ぶ・外す。上限(MAX_DFD_GROUPS)に達していれば、選ぶ操作は無視する。
export function toggleDfdGroup(
  model: DataFlowModel,
  group: string,
  selected: boolean,
): DataFlowModel {
  if (!selected) {
    return { ...model, dfd_groups: model.dfd_groups.filter((g) => g !== group) };
  }
  if (model.dfd_groups.includes(group) || model.dfd_groups.length >= MAX_DFD_GROUPS) {
    return model;
  }
  return { ...model, dfd_groups: [...model.dfd_groups, group] };
}

// 処理の処理概要表の行(無ければ空の行)。
export function summaryOf(model: DataFlowModel, functionId: string): ProcessSummaryRow {
  return (
    model.summaries.find((row) => row.function_id === functionId) ?? {
      function_id: functionId,
      input: "",
      process: "",
      output: "",
    }
  );
}

// 処理概要表の1行を書き換える。まだ行が無い処理なら行を足す。
export function updateSummary(
  model: DataFlowModel,
  functionId: string,
  patch: Partial<Omit<ProcessSummaryRow, "function_id">>,
): DataFlowModel {
  const exists = model.summaries.some((row) => row.function_id === functionId);
  const summaries = exists
    ? model.summaries.map((row) =>
        row.function_id === functionId ? { ...row, ...patch } : row,
      )
    : [...model.summaries, { ...summaryOf(model, functionId), ...patch }];
  return { ...model, summaries };
}

// 機能グループに属する処理の数(グループの選択の横に出す)。
export function countGroupFunctions(functionList: FunctionListModel, group: string): number {
  return functionList.functions.filter((row) => row.group === group).length;
}

// Phase-109-1:追記
// ---- 機能一覧に無い処理(段階1 の作り直しで処理 ID が変わって残った行) ----

// 機能一覧に無い処理の処理概要の行。表は機能一覧の処理だけを行にするので画面に出ず、ここから
// 今の処理へ付け替えるか消す。index は summaries の並びの位置。
export type StraySummary = { index: number; functionId: string; process: string };

export function straySummaries(model: DataFlowModel, functionList: FunctionListModel): StraySummary[] {
  const ids = new Set(functionList.functions.map((fn) => fn.id));
  return model.summaries.flatMap((row, index) =>
    ids.has(row.function_id) ? [] : [{ index, functionId: row.function_id, process: row.process }],
  );
}

const isEmptySummary = (row: ProcessSummaryRow) =>
  !row.input.trim() && !row.process.trim() && !row.output.trim();

// 付け替え先に選べる処理(機能一覧にあって、処理概要がまだ空のもの)。
export function summaryTargets(model: DataFlowModel, functionList: FunctionListModel): FunctionRow[] {
  const written = new Set(model.summaries.filter((row) => !isEmptySummary(row)).map((row) => row.function_id));
  return functionList.functions.filter((fn) => !written.has(fn.id));
}

// index の行を、中身はそのままで functionId の処理へ付け替える。付け替え先の空の行があれば置き換え、
// 機能一覧の順に並べ直す(機能一覧に無い行は後ろ)。
export function reassignSummary(
  model: DataFlowModel,
  functionList: FunctionListModel,
  index: number,
  functionId: string,
): DataFlowModel {
  const moved = model.summaries[index];
  if (moved === undefined) return model;
  const rest = model.summaries.filter((row, i) => i !== index && row.function_id !== functionId);
  const order = new Map(functionList.functions.map((fn, i) => [fn.id, i]));
  const rank = (id: string) => order.get(id) ?? Number.MAX_SAFE_INTEGER;
  const summaries = [...rest, { ...moved, function_id: functionId }].sort(
    (a, b) => rank(a.function_id) - rank(b.function_id),
  );
  return { ...model, summaries };
}

export function removeSummaryAt(model: DataFlowModel, index: number): DataFlowModel {
  return { ...model, summaries: model.summaries.filter((_, i) => i !== index) };
}

export function removeStraySummaries(model: DataFlowModel, functionList: FunctionListModel): DataFlowModel {
  const ids = new Set(functionList.functions.map((fn) => fn.id));
  return { ...model, summaries: model.summaries.filter((row) => ids.has(row.function_id)) };
}

// DFD を描くグループのうち、機能一覧に無いもの(グループの選択には出ないので、ここから外す。
// 外すのは toggleDfdGroup で行う)。
export function strayDfdGroups(model: DataFlowModel, functionList: FunctionListModel): string[] {
  const groups = new Set(functionList.groups);
  return model.dfd_groups.filter((group) => !groups.has(group));
}
