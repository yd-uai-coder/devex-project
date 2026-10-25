// 作成：Phase-18-8｜更新：Phase-48-1,109-1
// Phase-109-1:追記 ── ../crudOps.crudTargets, ../crudOps.reassignCrudFunction, ../crudOps.removeCrudFunction, ../crudOps.removeStrayCrud, ../crudOps.strayCrudFunctions, @/features/detailed-design/test-utils/stageFixtures.makeFunctionListWithSpare
import { describe, expect, it } from "vitest";
import {
  accessOf,
  cellOf,
  countDrafts,
  crudTables,
  crudTargets,
  hasCrudDraft,
  normalizeOps,
  reassignCrudFunction,
  removeCrudFunction,
  removeStrayCrud,
  setCellOps,
  strayCrudFunctions,
  tableKey,
  toCrud,
} from "../crudOps";
import type { DfdAccess } from "@/features/detailed-design/api/types";
import {
  makeCrud,
  makeFunctionListWithSpare,
} from "@/features/detailed-design/test-utils/stageFixtures";

// SUT: crudOps の各関数 / ドライバ: 各テスト / スタブ不要 ── 純粋関数で、外部依存を呼ばないため。

const ACCESSES: DfdAccess[] = [
  { function_id: "F-01", table: "reservations", kind: "write" },
  { function_id: "F-02", table: "reservations", kind: "read" },
];

describe("crudOps", () => {
  it("保存された model を編集できる形にそろえる", () => {
    expect(toCrud(null)).toEqual({ cells: [] });
    expect(toCrud({ cells: [{ function_id: "F-01", table: "t", ops: "C" }] })).toEqual({
      cells: [{ function_id: "F-01", table: "t", ops: "C", draft: false }],
    });
    expect(hasCrudDraft(toCrud(null))).toBe(false);
    expect(hasCrudDraft(makeCrud())).toBe(true);
  });

  it("操作を C→R→U→D の順にそろえ、テーブル名は大小と空白を無視して突き合わせる", () => {
    expect(normalizeOps("dxRc")).toBe("CRD");
    expect(tableKey(" Users ")).toBe("users");
    expect(cellOf(makeCrud(), "F-01", "Reservations")?.ops).toBe("C");
    expect(cellOf(makeCrud(), "F-02", "reservations")).toBeNull();
    expect(accessOf(ACCESSES, "F-02", "RESERVATIONS")).toEqual({ read: true, write: false });
  });

  it("セルを書き換えると下書きの印が外れ、DFD の読みの R は外せない", () => {
    const draft = makeCrud("C", true);
    expect(countDrafts(draft)).toBe(1);

    const edited = setCellOps(draft, "F-01", "reservations", "uc", ACCESSES);
    expect(edited.cells).toEqual([
      { function_id: "F-01", table: "reservations", ops: "CU", draft: false },
    ]);
    expect(countDrafts(edited)).toBe(0);

    // Phase-48-1:追記
    // DFD の書き込みの線から推定した印は、保存しても残り、書き換えると外れる
    const inferred = toCrud({
      cells: [{ function_id: "F-01", table: "reservations", ops: "U", draft: true, inferred: true }],
    });
    expect(inferred.cells[0].inferred).toBe(true);
    expect(setCellOps(inferred, "F-01", "reservations", "c", ACCESSES).cells[0].inferred).toBeUndefined();

    const read = setCellOps({ cells: [] }, "F-02", "reservations", "", ACCESSES);
    expect(read.cells).toEqual([
      { function_id: "F-02", table: "reservations", ops: "R", draft: false },
    ]);
  });

  it("空にしたセルは消す。ただし DFD の書き込みがあるセルは空のまま残す", () => {
    const withUsers = setCellOps(makeCrud(), "F-01", "users", "R", ACCESSES);
    expect(setCellOps(withUsers, "F-01", "users", "", ACCESSES).cells).toEqual(makeCrud().cells);
    expect(setCellOps(makeCrud(), "F-01", "reservations", "", ACCESSES).cells).toEqual([
      { function_id: "F-01", table: "reservations", ops: "", draft: false },
    ]);
  });

  it("列は ER のテーブルの並びに、ER に無いテーブルのセルを後ろに足す", () => {
    const model = { cells: [...makeCrud().cells, { ...makeCrud().cells[0], table: "logs" }] };
    expect(crudTables(["users", "Reservations"], model)).toEqual(["users", "Reservations", "logs"]);
  });

  // Phase-18-8:追記(画面確認後の修正)
  it("ER に同じ名前のテーブルが2つあっても、列は1つにする", () => {
    expect(crudTables(["new_table", "users", "New_Table "], { cells: [] })).toEqual([
      "new_table",
      "users",
    ]);
  });
});

// Phase-109-1:追記
describe("crudOps(機能一覧に無い処理)", () => {
  // F-09 は段階1 の作り直しで消えた処理(機能一覧は F-01・F-02)
  const withStray = () => ({
    cells: [
      ...makeCrud().cells,
      { function_id: "F-09", table: "reservations", ops: "RU", draft: true, inferred: true },
      { function_id: "F-09", table: "users", ops: "R", draft: false },
    ],
  });

  it("機能一覧に無い処理のセルを処理ごとにまとめ、付け替え先はセルの無い処理", () => {
    const list = makeFunctionListWithSpare();
    expect(strayCrudFunctions(withStray(), list)).toEqual([
      { functionId: "F-09", tables: ["reservations", "users"] },
    ]);
    expect(crudTargets(withStray(), list).map((fn) => fn.id)).toEqual(["F-02"]);
    expect(strayCrudFunctions(makeCrud(), list)).toEqual([]);
  });

  it("付け替えると操作はそのままで、下書き・推定の印を外す", () => {
    expect(reassignCrudFunction(withStray(), "F-09", "F-02").cells.slice(1)).toEqual([
      { function_id: "F-02", table: "reservations", ops: "RU", draft: false },
      { function_id: "F-02", table: "users", ops: "R", draft: false },
    ]);
  });

  it("1つずつ消す・すべて消す", () => {
    expect(removeCrudFunction(withStray(), "F-09")).toEqual(makeCrud());
    expect(removeStrayCrud(withStray(), makeFunctionListWithSpare())).toEqual(makeCrud());
  });
});
