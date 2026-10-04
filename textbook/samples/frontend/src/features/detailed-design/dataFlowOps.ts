// 作成：Phase-17-6
// 写経レベル: コア ── グループの上限と、「内容がある」の判定をバックエンドとそろえる。
import {
  MAX_DFD_GROUPS,
  type DataFlowModel,
  type FunctionListModel,
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
