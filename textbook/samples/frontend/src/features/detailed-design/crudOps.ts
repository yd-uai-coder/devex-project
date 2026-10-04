// 作成：Phase-18-8
// 写経レベル: コア ── DFD から決まる R を人の編集でも守り、書き換えたセルの下書きの印を外す。
import type { CrudCell, CrudModel, DfdAccess } from "@/features/detailed-design/api/types";

// 段階3(データモデル)の CRUD 図の編集操作(純粋関数)。どれも新しいモデルを返し、引数は変えない。
// DFD の線から決まる部分(読みの R)はバックエンドの merge_crud と同じ規則で守り、人の編集でも外させない。
// 人が編集したセルは、AI の下書きの印(draft)を外す(段階3の承認で残りの印も外れる。Phase 18)。

const CRUD_OPS = "CRUD";

// データストアとテーブルを突き合わせるための名前(バックエンドの table_key と同じ)。
export function tableKey(name: string): string {
  return name.trim().toLowerCase();
}

// 操作の文字列を C・R・U・D の順に並べ直す(大文字にし、C/R/U/D 以外の文字は捨てる)。
export function normalizeOps(ops: string): string {
  const letters = new Set(ops.toUpperCase());
  return [...CRUD_OPS].filter((op) => letters.has(op)).join("");
}

// 保存されている model(形の保証の無い JSON)を、編集できる形にそろえる。
export function toCrud(model: Record<string, unknown> | null): CrudModel {
  const cells = Array.isArray(model?.cells)
    ? (model.cells as Partial<CrudCell>[]).map(
        (cell): CrudCell => ({
          function_id: String(cell.function_id ?? ""),
          table: String(cell.table ?? ""),
          ops: String(cell.ops ?? ""),
          draft: Boolean(cell.draft),
        }),
      )
    : [];
  return { cells };
}

// 下書きの内容があるか(作り直しの確認を出すかの判定。バックエンドの _has_draft と同じ)。
export function hasCrudDraft(model: CrudModel): boolean {
  return model.cells.length > 0;
}

// AI の下書きのまま残っているセルの数。
export function countDrafts(model: CrudModel): number {
  return model.cells.filter((cell) => cell.draft).length;
}

const sameCell = (cell: CrudCell, functionId: string, table: string) =>
  cell.function_id === functionId && tableKey(cell.table) === tableKey(table);

// 処理 × テーブルのセル(無ければ null)。
export function cellOf(model: CrudModel, functionId: string, table: string): CrudCell | null {
  return model.cells.find((cell) => sameCell(cell, functionId, table)) ?? null;
}

// 処理 × テーブルについて、DFD の線から決まっている読み・書き込み。
export function accessOf(
  accesses: DfdAccess[],
  functionId: string,
  table: string,
): { read: boolean; write: boolean } {
  const matches = accesses.filter(
    (a) => a.function_id === functionId && tableKey(a.table) === tableKey(table),
  );
  return {
    read: matches.some((a) => a.kind === "read"),
    write: matches.some((a) => a.kind === "write"),
  };
}

// セルの操作を人が書き換える。DFD に読みの線があるセルは R を必ず残す。操作が空になり、DFD に
// 書き込みの線も無ければセルを消す(書き込みの線があれば、空のまま残して検証で C/U/D を求める)。
// 書き換えたセルは下書きの印を外す。
export function setCellOps(
  model: CrudModel,
  functionId: string,
  table: string,
  text: string,
  accesses: DfdAccess[],
): CrudModel {
  const access = accessOf(accesses, functionId, table);
  const ops = normalizeOps(access.read ? `${text}R` : text);
  const others = model.cells.filter((cell) => !sameCell(cell, functionId, table));
  const existing = cellOf(model, functionId, table);
  if (!ops && !access.write) return { cells: others };
  const next: CrudCell = { function_id: functionId, table: existing?.table ?? table, ops, draft: false };
  return existing
    ? { cells: model.cells.map((cell) => (sameCell(cell, functionId, table) ? next : cell)) }
    : { cells: [...model.cells, next] };
}

// CRUD 図の列。ER のテーブルの並びに、ER に無いテーブルのセル(直す必要がある)を後ろに足す。
// ER に同じ名前のテーブルが2つあっても、列は1つにする(列の key が重ならないように。名前の重複は
// 段階3の検証のエラー DUPLICATE_TABLE で知らせる。Phase 18)。
export function crudTables(erTables: string[], model: CrudModel): string[] {
  // Phase-18-8：更新(画面確認後の修正。ER のテーブル名の重複も除く)
  // const keys = new Set(erTables.map(tableKey));
  // ↓↓
  const keys = new Set<string>();
  const unique: string[] = [];
  for (const table of erTables) {
    const key = tableKey(table);
    if (!keys.has(key)) {
      keys.add(key);
      unique.push(table);
    }
  }
  const extra: string[] = [];
  for (const cell of model.cells) {
    const key = tableKey(cell.table);
    if (!keys.has(key)) {
      keys.add(key);
      extra.push(cell.table);
    }
  }
  // Phase-18-8：更新
  // return [...erTables, ...extra];
  // ↓↓
  return [...unique, ...extra];
}
