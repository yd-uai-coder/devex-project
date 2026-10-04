// 作成：Phase-19-6
// 写経レベル: 定型
import { describe, expect, it } from "vitest";
import {
  addModule,
  componentLayers,
  duplicatePaths,
  hasModuleDraft,
  listToText,
  removeModule,
  textToList,
  toModuleList,
  updateModule,
} from "../moduleListOps";
import { makeModuleList } from "../test-utils/stageFixtures";
import { COMPONENT_MODEL } from "@/features/uml/test-utils/umlFixtures";

// SUT: moduleListOps の各関数 / ドライバ: 各テスト / スタブ不要 ── 純粋関数で外部依存を呼ばないため。

describe("moduleListOps", () => {
  it("保存された model を編集できる形にそろえる(欠けた値は既定値)", () => {
    expect(toModuleList(null)).toEqual({ modules: [] });
    expect(toModuleList({ modules: [{ path: "app/a.py", functions: ["F-01"] }] })).toEqual({
      modules: [
        {
          path: "app/a.py",
          layer: "",
          responsibility: "",
          depends_on: [],
          functions: ["F-01"],
          all_functions: false,
        },
      ],
    });
    expect(hasModuleDraft(toModuleList(null))).toBe(false);
    expect(hasModuleDraft(makeModuleList())).toBe(true);
  });

  it("構成図の層を初出順に、空と重複を除いて返す", () => {
    expect(componentLayers(COMPONENT_MODEL)).toEqual(["API層", "Service層"]);
    expect(
      componentLayers({
        ...COMPONENT_MODEL,
        elements: [
          { ...COMPONENT_MODEL.elements[0], layer: " " },
          { ...COMPONENT_MODEL.elements[1], layer: null },
          COMPONENT_MODEL.elements[1],
          COMPONENT_MODEL.elements[1],
        ],
      }),
    ).toEqual(["Service層"]);
    expect(componentLayers(null)).toEqual([]);
  });

  it("行を足す・直す・消す(引数は変えない)", () => {
    const model = makeModuleList();
    const added = addModule(model, ["service", "api"]);
    expect(added.modules[1]).toMatchObject({ path: "", layer: "service", all_functions: false });
    expect(model.modules).toHaveLength(1);

    const updated = updateModule(added, 1, { path: "app/b.py", all_functions: true });
    expect(updated.modules[1]).toMatchObject({ path: "app/b.py", all_functions: true });
    expect(updated.modules[0]).toBe(added.modules[0]);

    expect(removeModule(updated, 0).modules.map((row) => row.path)).toEqual(["app/b.py"]);
  });

  it("入力欄の文字列と配列を相互に変換する", () => {
    expect(listToText(["F-01", "F-02"])).toBe("F-01, F-02");
    expect(textToList(" F-01,F-02、\nsqlalchemy ,, ")).toEqual(["F-01", "F-02", "sqlalchemy"]);
  });

  it("重複したパスを返す(空のパスは数えない)", () => {
    const model = makeModuleList();
    const twice = { modules: [...model.modules, { ...model.modules[0], path: ` ${model.modules[0].path}` }] };
    expect(duplicatePaths(twice)).toEqual(new Set(["app/api/routes/reservations.py"]));
    expect(duplicatePaths({ modules: [{ ...model.modules[0], path: "" }, { ...model.modules[0], path: " " }] }).size).toBe(0);
  });
});
