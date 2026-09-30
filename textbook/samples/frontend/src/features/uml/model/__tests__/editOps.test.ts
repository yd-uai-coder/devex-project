// 作成：Phase-11-6
import { describe, expect, it } from "vitest";
import {
  addColumn,
  addElement,
  addRelation,
  deleteColumn,
  deleteElement,
  deleteRelation,
  nextId,
  updateColumn,
  updateElement,
  updateRelation,
} from "../editOps";
import {
  COMPONENT_MODEL,
  DATA_ITEM,
  DFD_MODEL,
  ER_MODEL,
} from "@/features/uml/test-utils/umlFixtures";

describe("nextId", () => {
  it("要素と関係の両方で使われていない最小の番号を返す", () => {
    expect(nextId(COMPONENT_MODEL, "c")).toBe("c3");
    expect(nextId(COMPONENT_MODEL, "r")).toBe("r2");
    expect(nextId(COMPONENT_MODEL, "x")).toBe("x1");
  });
});

describe("addElement", () => {
  it("記法ごとの既定の要素を追加し、新しい id を返す", () => {
    const component = addElement(COMPONENT_MODEL);
    const er = addElement(ER_MODEL);
    const store = addElement(DFD_MODEL, "data_store");

    expect(component.id).toBe("c3");
    expect(component.model.elements.at(-1)).toMatchObject({ id: "c3", kind: "module" });
    expect(er.model.elements.at(-1)).toMatchObject({ kind: "table", columns: [{ name: "id" }] });
    expect(store.id).toBe("s2");
    expect(store.model.elements.at(-1)).toMatchObject({ element_type: "data_store" });
  });

  it("引数のモデルを書き換えない", () => {
    addElement(COMPONENT_MODEL);

    expect(COMPONENT_MODEL.elements).toHaveLength(2);
  });
});

describe("updateElement", () => {
  it("指定した要素の属性だけを更新し、記法に無い属性は足さない", () => {
    const component = updateElement(COMPONENT_MODEL, "c1", { name: "認証", layer: "UI層" });
    const er = updateElement(ER_MODEL, "t1", { name: "accounts", layer: "無視される" });

    expect(component.elements[0]).toMatchObject({ name: "認証", layer: "UI層" });
    expect(component.elements[1]).toEqual(COMPONENT_MODEL.elements[1]);
    expect(er.elements[0]).toMatchObject({ name: "accounts" });
    expect(er.elements[0]).not.toHaveProperty("layer");
  });
});

describe("deleteElement", () => {
  it("要素と、その要素につながる関係を消す", () => {
    const model = deleteElement(DFD_MODEL, "p1");

    expect(model.elements.map((el) => el.id)).toEqual(["e1", "s1"]);
    expect(model.relations).toEqual([]);
  });
});

describe("addRelation / updateRelation / deleteRelation", () => {
  it("記法ごとの既定の種別で関係を追加する", () => {
    const component = addRelation(COMPONENT_MODEL, "c2", "c1");
    const er = addRelation(ER_MODEL, "t2", "t1");

    expect(component.model.relations.at(-1)).toEqual({
      id: "r2",
      source_id: "c2",
      target_id: "c1",
      relation_type: "depends_on",
    });
    expect(er.model.relations.at(-1)).toMatchObject({ relation_type: "one_to_many" });
  });

  it("DFD のフローはデータ項目の指定が無ければ追加しない", () => {
    expect(() => addRelation(DFD_MODEL, "p1", "s1")).toThrow("データ項目");
    const { model, id } = addRelation(DFD_MODEL, "p1", "s1", { dataItemId: DATA_ITEM.id });

    expect(id).toBe("f3");
    expect(model.relations.at(-1)).toMatchObject({ data_item_id: DATA_ITEM.id });
  });

  it("関係の属性を更新し、削除する", () => {
    const updated = updateRelation(ER_MODEL, "r1", { relation_type: "one_to_one" });
    const deleted = deleteRelation(updated, "r1");

    expect(updated.relations[0]).toMatchObject({ relation_type: "one_to_one" });
    expect(deleted.relations).toEqual([]);
  });
});

describe("ER のカラム表", () => {
  it("カラムを追加・更新・削除する", () => {
    const added = addColumn(ER_MODEL, "t1");
    const updated = updateColumn(added, "t1", 1, { name: "email", nullable: false });
    const deleted = deleteColumn(updated, "t1", 0);

    const columnsOf = (m: typeof ER_MODEL) => m.elements[0].columns;
    expect(columnsOf(added as typeof ER_MODEL)).toHaveLength(2);
    expect(columnsOf(updated as typeof ER_MODEL)[1]).toMatchObject({ name: "email", nullable: false });
    expect(columnsOf(deleted as typeof ER_MODEL).map((c) => c.name)).toEqual(["email"]);
  });

  it("ER 以外のモデルはそのまま返す", () => {
    expect(addColumn(COMPONENT_MODEL, "c1")).toBe(COMPONENT_MODEL);
  });
});
