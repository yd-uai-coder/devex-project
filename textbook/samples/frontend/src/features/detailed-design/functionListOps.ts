// 作成：Phase-16-6
// 写経レベル: コア ── 処理IDを next_number から振り、消した番号を再利用しないこと。グループの改名で行も付け替えること。
import type {
  FunctionKind,
  FunctionListModel,
  FunctionRow,
} from "@/features/detailed-design/api/types";

// 段階1(機能一覧)の編集操作(純粋関数)。どれも新しいモデルを返し、引数は変えない。
// 処理IDの規則はバックエンド(app/detailed_design/function_list.py)と同じ:
// 新しい行は next_number から振り、消した行の番号は再利用しない(後の段階の参照が
// 別の処理を指さないため)。

export const FUNCTION_KINDS: FunctionKind[] = [
  "API",
  "API+バッチ",
  "バッチ",
  "画面",
  "その他",
];

export function formatFunctionId(number: number): string {
  return `F-${String(number).padStart(2, "0")}`;
}

// 保存されている model(形の保証の無い JSON)を、編集できる形にそろえる。
export function toFunctionList(
  model: Record<string, unknown> | null,
): FunctionListModel {
  const groups = Array.isArray(model?.groups)
    ? (model.groups as unknown[]).map(String)
    : [];
  const functions = Array.isArray(model?.functions)
    ? (model.functions as Partial<FunctionRow>[]).map(
        (row): FunctionRow => ({
          id: String(row.id ?? ""),
          name: String(row.name ?? ""),
          kind: FUNCTION_KINDS.includes(row.kind as FunctionKind)
            ? (row.kind as FunctionKind)
            : "API",
          trigger: String(row.trigger ?? ""),
          screens: Array.isArray(row.screens) ? row.screens.map(String) : [],
          group_initial: String(row.group_initial ?? ""),
          group: String(row.group ?? ""),
          summary: String(row.summary ?? ""),
        }),
      )
    : [];
  const nextNumber =
    typeof model?.next_number === "number" ? model.next_number : 1;
  return { groups, functions, next_number: nextNumber };
}

export function updateRow(
  model: FunctionListModel,
  id: string,
  patch: Partial<Omit<FunctionRow, "id" | "group_initial">>,
): FunctionListModel {
  return {
    ...model,
    functions: model.functions.map((row) =>
      row.id === id ? { ...row, ...patch } : row,
    ),
  };
}

// 末尾に空の行を足す。機能グループは先頭のグループにしておく(人が選び直す)。
export function addRow(model: FunctionListModel): FunctionListModel {
  const row: FunctionRow = {
    id: formatFunctionId(model.next_number),
    name: "",
    kind: "API",
    trigger: "",
    screens: [],
    group_initial: "",
    group: model.groups[0] ?? "",
    summary: "",
  };
  return {
    ...model,
    functions: [...model.functions, row],
    next_number: model.next_number + 1,
  };
}

// 行を消す。next_number は戻さない(消した番号を再利用しない)。
export function removeRow(
  model: FunctionListModel,
  id: string,
): FunctionListModel {
  return { ...model, functions: model.functions.filter((r) => r.id !== id) };
}

// 機能グループを足す。空の名前・既にある名前は足さない(同じモデルを返す)。
export function addGroup(
  model: FunctionListModel,
  name: string,
): FunctionListModel {
  const trimmed = name.trim();
  if (!trimmed || model.groups.includes(trimmed)) return model;
  return { ...model, groups: [...model.groups, trimmed] };
}

// 機能グループの名前を変え、そのグループの行もすべて付け替える。
// 空の名前・既にある別のグループの名前には変えない(2つのグループが混ざるのを防ぐ)。
export function renameGroup(
  model: FunctionListModel,
  from: string,
  to: string,
): FunctionListModel {
  const trimmed = to.trim();
  if (!trimmed || trimmed === from || model.groups.includes(trimmed)) {
    return model;
  }
  return {
    ...model,
    groups: model.groups.map((g) => (g === from ? trimmed : g)),
    functions: model.functions.map((row) =>
      row.group === from ? { ...row, group: trimmed } : row,
    ),
  };
}

export function isGroupUsed(model: FunctionListModel, group: string): boolean {
  return model.functions.some((row) => row.group === group);
}

// 機能グループを消す。処理が残っているグループは消さない(先に行を別のグループへ移す)。
export function removeGroup(
  model: FunctionListModel,
  group: string,
): FunctionListModel {
  if (isGroupUsed(model, group)) return model;
  return { ...model, groups: model.groups.filter((g) => g !== group) };
}

// 関連画面の入力欄(「SCR-001/SCR-002」)と配列の相互変換。
export function screensToText(screens: string[]): string {
  return screens.join("/");
}

export function textToScreens(text: string): string[] {
  return text
    .split(/[/、,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
