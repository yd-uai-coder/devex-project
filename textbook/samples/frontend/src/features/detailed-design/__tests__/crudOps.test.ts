// 作成：Phase-18-8
import { describe, expect, it } from "vitest";
import {
  accessOf,
  cellOf,
  countDrafts,
  crudTables,
  hasCrudDraft,
  normalizeOps,
  setCellOps,
  tableKey,
  toCrud,
} from "../crudOps";
import type { DfdAccess } from "@/features/detailed-design/api/types";
import { makeCrud } from "@/features/detailed-design/test-utils/stageFixtures";

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
});
