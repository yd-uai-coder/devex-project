// 作成：Phase-17-8
// 写経レベル: 定型
import { describe, expect, it } from "vitest";
import { fieldsToText, isDuplicateName, textToFields } from "../dataDictionaryOps";

describe("dataDictionaryOps", () => {
  it("fieldsToText と textToFields は「名前:型」の並びを行き来する", () => {
    const fields = [
      { name: "id", type: "UUID" },
      { name: "note", type: null },
    ];

    expect(fieldsToText(fields)).toBe("id:UUID, note");
    expect(textToFields("id:UUID, note、 ,start_at : timestamp")).toEqual([
      { name: "id", type: "UUID", required: null },
      { name: "note", type: null, required: null },
      { name: "start_at", type: "timestamp", required: null },
    ]);
  });

  it("textToFields は同じ名前のフィールドの必須の指定を引き継ぐ", () => {
    const previous = [{ name: "id", type: "UUID", required: true }];

    expect(textToFields("id:str", previous)).toEqual([{ name: "id", type: "str", required: true }]);
  });

  it("isDuplicateName は自分以外の同じ名前を見つける", () => {
    const items = [
      { id: "i1", name: "予約" },
      { id: "i2", name: "備品" },
    ];

    expect(isDuplicateName(" 予約 ", items, null)).toBe(true);
    expect(isDuplicateName("予約", items, "i1")).toBe(false);
    expect(isDuplicateName("会計", items, null)).toBe(false);
  });
});
