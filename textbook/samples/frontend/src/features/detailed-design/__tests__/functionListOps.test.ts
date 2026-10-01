// 作成：Phase-16-6
// 写経レベル: コア ── 編集操作の規則を確かめる。
import { describe, expect, it } from "vitest";
import {
  addGroup,
  addRow,
  formatFunctionId,
  isGroupUsed,
  removeGroup,
  removeRow,
  renameGroup,
  screensToText,
  textToScreens,
  toFunctionList,
  updateRow,
} from "../functionListOps";
import { makeFunctionList } from "../test-utils/stageFixtures";

describe("functionListOps", () => {
  it("toFunctionListは保存された JSON を編集できる形にそろえる", () => {
    expect(toFunctionList(null)).toEqual({ groups: [], functions: [], next_number: 1 });
    const model = toFunctionList({
      groups: ["a"],
      functions: [
        { id: "F-01", name: "x", kind: "不明" },
        { id: "F-02", name: "y", kind: "画面" },
      ],
      next_number: 3,
    });
    expect(model.functions[1].kind).toBe("画面");
    expect(model.functions[0]).toMatchObject({
      id: "F-01",
      name: "x",
      kind: "API",
      screens: [],
      group: "",
    });
  });

  it("addRowは next_number から振り、removeRowは番号を戻さない", () => {
    const added = addRow(makeFunctionList());
    expect(added.functions.map((f) => f.id)).toEqual(["F-01", "F-02"]);
    expect(added.functions[1].group).toBe("reservations");
    expect(added.next_number).toBe(3);

    const removed = removeRow(added, "F-02");
    expect(removed.functions.map((f) => f.id)).toEqual(["F-01"]);
    expect(addRow(removed).functions[1].id).toBe("F-03");
    expect(formatFunctionId(12)).toBe("F-12");
  });

  it("updateRowは指定した行だけを変える", () => {
    const model = updateRow(makeFunctionList(), "F-01", { name: "予約する" });
    expect(model.functions[0].name).toBe("予約する");
    expect(model.functions[0].trigger).toBe("POST /api/v1/reservations");
  });

  it("renameGroupはグループの行も付け替え、既にある名前には変えない", () => {
    const base = addGroup(makeFunctionList(), "予約");
    expect(renameGroup(base, "reservations", "予約")).toBe(base);
    expect(renameGroup(base, "reservations", " ")).toBe(base);

    const renamed = renameGroup(base, "reservations", "予約管理");
    expect(renamed.groups).toEqual(["予約管理", "予約"]);
    expect(renamed.functions[0].group).toBe("予約管理");
  });

  it("addGroupは空や重複を足さず、removeGroupは処理が残るグループを消さない", () => {
    const base = makeFunctionList();
    expect(addGroup(base, "  ")).toBe(base);
    expect(addGroup(base, "reservations")).toBe(base);

    const withEmpty = addGroup(base, "空");
    expect(isGroupUsed(withEmpty, "reservations")).toBe(true);
    expect(removeGroup(withEmpty, "reservations")).toBe(withEmpty);
    expect(removeGroup(withEmpty, "空").groups).toEqual(["reservations"]);
  });

  it("関連画面は「/」区切りの文字列と相互に変換する", () => {
    expect(textToScreens("SCR-001/ SCR-002、,")).toEqual(["SCR-001", "SCR-002"]);
    expect(screensToText(["SCR-001", "SCR-002"])).toBe("SCR-001/SCR-002");
  });
});
