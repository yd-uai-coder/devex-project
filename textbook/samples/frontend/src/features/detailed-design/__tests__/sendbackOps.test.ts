// 作成：Phase-54-3
import { describe, expect, it } from "vitest";
import { sendbackArgs, sendbackStage } from "../sendbackOps";
import { makeFunctionList, makeLogics, makeModuleList, makeProcedures, makeStages } from "../test-utils/stageFixtures";
import { finding } from "@/features/design-review/test-utils/reviewFixtures";

// SUT は sendbackStage・sendbackArgs(純粋関数)、ドライバは vitest。スタブ不要 ── 対象が純粋(副作用なし)で
// 外部依存を呼ばないため。
describe("sendbackOps", () => {
  const stages = makeStages({
    1: { model: makeFunctionList() },
    4: { model: makeModuleList() },
    5: { model: makeProcedures() },
    6: { model: makeLogics() },
  });

  it("作り直す段階は、最も多くの指摘が当たる段階(同数なら上流)", () => {
    const moduleFinding = finding({ id: "m", targets: ["app/api/routes/reservations.py"] });
    const fn = finding({ id: "f", targets: ["F-01"] });
    expect(sendbackStage([moduleFinding], stages)).toBe(4);
    expect(sendbackStage([moduleFinding, moduleFinding], stages)).toBe(4);
    // F-01 は段階1(処理)に当たる。モジュールと同数なら上流の段階1
    expect(sendbackStage([fn, moduleFinding], stages)).toBe(1);
  });

  it("どの段階にも当たらなければ、実装計画書(詳細)の指摘は段階7、それ以外は null", () => {
    expect(sendbackStage([finding({ targets: ["FR-001"], documents: ["detailed_plan"] })], stages)).toBe(7);
    expect(sendbackStage([finding({ targets: ["FR-001"], documents: ["detailed_design"] })], stages)).toBeNull();
  });

  it("段階5・6 は指摘の対象から作り直す行を決め、決まらなければ null。ほかは段階全体", () => {
    expect(sendbackArgs(5, [finding({ targets: ["F-01"] })], stages)).toEqual({ functionIds: ["F-01"] });
    expect(sendbackArgs(6, [finding({ targets: ["app/api/routes/reservations.py::create_reservation"] })], stages)).toEqual({
      logics: [{ module: "app/api/routes/reservations.py", function: "create_reservation" }],
    });
    expect(sendbackArgs(5, [finding({ targets: ["FR-001"] })], stages)).toBeNull();
    expect(sendbackArgs(3, [finding({ targets: ["FR-001"] })], stages)).toEqual({});
  });
});
