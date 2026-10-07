// 作成：Phase-20-5｜更新：Phase-29-1
// 写経レベル: コア ── 編集操作と、索引・関与表の導き方を確かめる。
// Phase-29-1:追記 ── ../procedureOps.callsFunction
import { describe, expect, it } from "vitest";
import type { FunctionListModel } from "@/features/detailed-design/api/types";
import {
  addBranch,
  addStep,
  buildIndex,
  buildInvolvement,
  callsFunction,
  isExternalActor,
  mainStepCount,
  numberSteps,
  pendingFunctionIds,
  removeStep,
  stepId,
  toggleProcedure,
  toProcedures,
  updateProcedure,
  updateStep,
} from "../procedureOps";
import {
  makeBranch,
  makeFunctionList,
  makeProcedures,
  makeStep,
} from "../test-utils/stageFixtures";

// SUT: procedureOps の各関数 / ドライバ: 各テスト / スタブ不要 ── どれも純粋関数(副作用なし)で、
// 外部依存を呼ばないため。

const ROUTE = "app/api/routes/reservations.py";
const SERVICE = "app/services/reservation.py";

function twoFunctions(): FunctionListModel {
  const list = makeFunctionList();
  return {
    ...list,
    functions: [
      ...list.functions,
      { ...list.functions[0], id: "F-02", name: "予約を一覧する", trigger: "GET /api/v1/reservations" },
    ],
  };
}

describe("procedureOps", () => {
  it("統合スモーク: 保存された model を整え、手順番号・関与表・索引を導く", () => {
    const model = toProcedures(makeProcedures() as unknown as Record<string, unknown>);

    expect(model).toEqual(makeProcedures());
    expect(numberSteps(model.procedures[0].steps)).toEqual(["1", "1a"]);
    const involvement = buildInvolvement(model, [SERVICE, ROUTE]);
    expect(involvement.modules).toEqual([ROUTE]);
    expect(involvement.cells.get("F-01")?.get(ROUTE)).toEqual(["1"]);
    expect(buildIndex(model, makeFunctionList())[0]).toMatchObject({
      fn: { name: "予約を登録する" },
      stepCount: 1,
    });
  });

  it("toProcedures は欠けた欄を空にし、形の違う model を空にする", () => {
    expect(toProcedures(null)).toEqual({ procedures: [] });
    expect(toProcedures({ procedures: "x" })).toEqual({ procedures: [] });
    const model = toProcedures({ procedures: [{ function_id: "F-01", steps: [{ action: "a" }] }] });
    expect(model.procedures[0]).toEqual({
      function_id: "F-01",
      reason: "",
      note: "",
      steps: [{ ...makeBranch("a", ""), is_branch: false }],
    });
  });

  // Phase-29-1:追記
  it("toProcedures は種別の無い・知らない種別の行を同期の呼び出しとして読む", () => {
    const model = toProcedures({
      procedures: [
        { function_id: "F-01", steps: [{ action: "a" }, { kind: "x" }, { kind: "return" }] },
      ],
    });
    expect(model.procedures[0].steps.map((s) => s.kind)).toEqual(["call", "call", "return"]);
  });

  it("callsFunction はモジュールの関数を呼ぶ行だけ(分岐・戻り・外部の役者・空の関数を除く)", () => {
    expect(callsFunction(makeStep())).toBe(true);
    expect(callsFunction(makeStep({ kind: "async" }))).toBe(true);
    expect(callsFunction(makeStep({ kind: "return" }))).toBe(false);
    expect(callsFunction(makeBranch())).toBe(false);
    expect(callsFunction(makeStep({ callee: "利用者" }))).toBe(false);
    expect(callsFunction(makeStep({ call: " " }))).toBe(false);
  });

  it("関与表は戻りの行を含めない", () => {
    const model = {
      procedures: [
        {
          function_id: "F-01",
          reason: "",
          note: "",
          steps: [makeStep(), makeStep({ caller: SERVICE, callee: ROUTE, kind: "return" as const })],
        },
      ],
    };
    expect(buildInvolvement(model, [ROUTE]).cells.get("F-01")?.get(ROUTE)).toEqual(["1"]);
  });

  it("numberSteps は分岐に a, b… を付け、z の次は aa、先頭の分岐は 0a にする", () => {
    expect(numberSteps([makeBranch(), makeStep(), makeBranch(), makeBranch(), makeStep()])).toEqual(
      ["0a", "1", "1a", "1b", "2"],
    );
    const many = numberSteps([makeStep(), ...Array.from({ length: 27 }, () => makeBranch())]);
    expect(many[26]).toBe("1z");
    expect(many[27]).toBe("1aa");
    expect(stepId("F-01", "4a")).toBe("F-01#4a");
  });

  it("外部の役者は「/」を含まない名前。手順数は分岐を数えない", () => {
    expect(isExternalActor("利用者")).toBe(true);
    expect(isExternalActor(ROUTE)).toBe(false);
    expect(mainStepCount(makeProcedures().procedures[0])).toBe(1);
  });

  it("処理を選ぶと機能一覧の順に並び、外すと消える。手順の無い処理が生成の対象", () => {
    const list = twoFunctions();
    let model = toggleProcedure({ procedures: [] }, list, "F-02", true);
    model = toggleProcedure(model, list, "F-01", true);
    model = toggleProcedure(model, list, "F-01", true);

    expect(model.procedures.map((p) => p.function_id)).toEqual(["F-01", "F-02"]);
    model = updateProcedure(model, "F-01", { steps: [makeStep()], reason: "理由" });
    expect(pendingFunctionIds(model)).toEqual(["F-02"]);
    expect(toggleProcedure(model, list, "F-01", false).procedures.map((p) => p.function_id)).toEqual(
      ["F-02"],
    );
  });

  it("分岐はその手順の分岐の後ろに足し、手順を消すと付いている分岐も消える", () => {
    const base = makeProcedures(); // [手順1, 分岐1a]
    let model = addStep(base, "F-01"); // [1, 1a, 2]
    model = addBranch(model, "F-01", 0); // [1, 1a, 1b, 2]
    const steps = model.procedures[0].steps;

    expect(numberSteps(steps)).toEqual(["1", "1a", "1b", "2"]);
    expect(steps[2].is_branch).toBe(true);
    expect(base.procedures[0].steps).toHaveLength(2); // 引数は変えない

    model = updateStep(model, "F-01", 3, { callee: SERVICE });
    expect(model.procedures[0].steps[3].callee).toBe(SERVICE);
    expect(numberSteps(removeStep(model, "F-01", 1).procedures[0].steps)).toEqual(["1", "1a", "2"]);
    const removed = removeStep(model, "F-01", 0).procedures[0].steps;
    expect(removed.map((s) => s.callee)).toEqual([SERVICE]);
  });

  it("関与表の列はモジュール一覧の並びで、外部の役者・一覧に無いパス・分岐は含めない", () => {
    const model = {
      procedures: [
        {
          function_id: "F-01",
          reason: "",
          note: "",
          steps: [
            makeStep({ callee: ROUTE }),
            makeBranch(),
            makeStep({ callee: ` ${SERVICE} ` }),
            makeStep({ callee: "app/missing.py" }),
            makeStep({ callee: SERVICE }),
            makeStep({ callee: "利用者" }),
          ],
        },
        { function_id: "F-02", reason: "", note: "", steps: [] },
      ],
    };

    const involvement = buildInvolvement(model, [SERVICE, "app/main.py", ROUTE]);

    expect(involvement.modules).toEqual([SERVICE, ROUTE]);
    expect(involvement.cells.get("F-01")?.get(SERVICE)).toEqual(["2", "4"]);
    expect(involvement.cells.get("F-02")?.size).toBe(0);
  });

  it("索引は機能一覧に無い処理を fn: null にする", () => {
    const index = buildIndex(
      { procedures: [{ function_id: "F-09", reason: "", note: "", steps: [] }] },
      makeFunctionList(),
    );
    expect(index[0]).toMatchObject({ fn: null, stepCount: 0 });
  });
});
