// 作成：Phase-21-5｜更新：Phase-21-5(画面確認後の修正)
// 写経レベル: コア ── 候補のまとめ方・逆引き・L-ID の引き当てが純粋関数で確かめられること。
// Phase-21-5:追記(画面確認後の修正) ── ../logicOps(candidatesByProcedure, isCalledFrom, logicStatus, pendingInTab, selectAll)
import { describe, expect, it } from "vitest";
import type { ProcedureModel } from "@/features/detailed-design/api/types";
import {
  addPseudoStep,
  buildReverseIndex,
  callingSteps,
  candidatesByProcedure,
  isCalledFrom,
  isDrafted,
  keyOf,
  logicCandidates,
  logicId,
  logicIdsByKey,
  logicKey,
  logicStatus,
  pendingInTab,
  pendingLogics,
  removePseudoStep,
  selectAll,
  subToText,
  textToSub,
  toggleLogic,
  toLogics,
  updateLogic,
  updatePseudoStep,
} from "../logicOps";
import {
  makeBranch,
  makeLogic,
  makeLogics,
  makeProcedures,
  makeStep,
} from "../test-utils/stageFixtures";

// SUT: logicOps の各関数 / ドライバ: 各テスト / スタブ不要 ── どれも純粋関数(副作用なし)で、
// 外部依存を呼ばないため。

const ROUTE = "app/api/routes/reservations.py";
const SERVICE = "app/services/reservation.py";
const CREATE = { module: SERVICE, function: "ReservationService.create" };

// F-01 と F-02 が同じサービスの関数を呼ぶ。F-02 は外部の役者・関数の空の行も持つ。
function procedures(): ProcedureModel {
  return {
    procedures: [
      {
        function_id: "F-01",
        reason: "",
        note: "",
        steps: [
          makeStep(),
          makeBranch(),
          makeStep({ caller: ROUTE, callee: SERVICE, call: "ReservationService.create" }),
        ],
      },
      {
        function_id: "F-02",
        reason: "",
        note: "",
        steps: [
          makeStep({ call: "" }),
          makeStep({ caller: ROUTE, callee: SERVICE, call: "ReservationService.create" }),
          makeStep({ caller: ROUTE, callee: "利用者", call: "respond" }),
        ],
      },
    ],
  };
}

describe("logicOps", () => {
  it("統合スモーク: 保存された model を読み、L-ID・呼ばれる手順・逆引きを導く", () => {
    const model = toLogics(makeLogics() as unknown as Record<string, unknown>);
    const [row] = buildReverseIndex(model, makeProcedures());
    expect(row).toMatchObject({ id: "L-01", stepIds: ["F-01#1"] });
    expect(row.row.pseudo).toEqual([{ text: "本文を検証する", sub: ["不正なら 422"] }]);
  });

  it("toLogicsは欠けた欄を空にそろえる", () => {
    expect(toLogics({ logics: [{ module: ROUTE, pseudo: [{ text: "a" }] }] })).toEqual({
      logics: [
        {
          module: ROUTE,
          function: "",
          signature: "",
          args: "",
          returns: "",
          raises: "",
          pre: "",
          post: "",
          pseudo: [{ text: "a", sub: [] }],
        },
      ],
    });
    expect(toLogics(null)).toEqual({ logics: [] });
  });

  it("logicId・logicKeyはバックエンドと同じ形", () => {
    expect([0, 9, 99].map(logicId)).toEqual(["L-01", "L-10", "L-100"]);
    expect(logicKey(` ${SERVICE} `, " create ")).toBe(`${SERVICE}::create`);
    expect(keyOf(CREATE)).toBe(`${SERVICE}::ReservationService.create`);
  });

  it("isDrafted・pendingLogicsはシグネチャか擬似フローの有無で決める", () => {
    const empty = makeLogic({ signature: "", pseudo: [] });
    expect(isDrafted(empty)).toBe(false);
    expect(isDrafted(makeLogic({ signature: "" }))).toBe(true);
    expect(pendingLogics({ logics: [makeLogic(), { ...empty, ...CREATE }] })).toEqual([CREATE]);
  });

  it("logicCandidatesは (呼び出し先, 関数) ごとに呼ばれる手順をまとめ、外部の役者・空の関数・分岐を除く", () => {
    const candidates = logicCandidates(procedures());
    expect(candidates).toEqual([
      { module: ROUTE, function: "create_reservation", stepIds: ["F-01#1"] },
      { ...CREATE, stepIds: ["F-01#2", "F-02#2"] },
    ]);
    expect(callingSteps(procedures(), SERVICE, "ReservationService.create")).toEqual([
      "F-01#2",
      "F-02#2",
    ]);
    expect(callingSteps(procedures(), SERVICE, "missing")).toEqual([]);
  });

  it("logicIdsByKeyは並び順の L-ID を引く", () => {
    const ids = logicIdsByKey({ logics: [makeLogic(), makeLogic(CREATE)] });
    expect(ids.get(keyOf(CREATE))).toBe("L-02");
  });

  it("toggleLogicは候補の順に足し、外すと消える", () => {
    const candidates = logicCandidates(procedures());
    const added = toggleLogic({ logics: [makeLogic(CREATE)] }, candidates, {
      module: ROUTE,
      function: "create_reservation",
    }, true);
    expect(added.logics.map((row) => row.function)).toEqual([
      "create_reservation",
      "ReservationService.create",
    ]);
    expect(added.logics[0].signature).toBe("");
    expect(toggleLogic(added, candidates, CREATE, true)).toBe(added);
    expect(toggleLogic(added, candidates, CREATE, false).logics).toHaveLength(1);
  });

  it("updateLogicと擬似フローの段の追加・更新・削除", () => {
    const key = keyOf(makeLogic());
    let model = updateLogic(makeLogics(), key, { pre: "新しい前提" });
    expect(model.logics[0].pre).toBe("新しい前提");
    model = addPseudoStep(model, key);
    model = updatePseudoStep(model, key, 1, { text: "保存する", sub: ["commit"] });
    expect(model.logics[0].pseudo[1]).toEqual({ text: "保存する", sub: ["commit"] });
    model = removePseudoStep(model, key, 0);
    expect(model.logics[0].pseudo.map((p) => p.text)).toEqual(["保存する"]);
  });

  it("下位の箇条は1行1箇条で入力する", () => {
    expect(subToText(["a", "b"])).toBe("a\nb");
    expect(textToSub("a\nb")).toEqual(["a", "b"]);
    expect(textToSub("")).toEqual([]);
  });

  // Phase-21-5:追記(画面確認後の修正) ── 処理ごとのタブ
  it("candidatesByProcedureは処理ごとに候補を並べ、共通の関数は両方のタブに印を付けて出す", () => {
    const [f01, f02] = candidatesByProcedure(procedures());
    expect(f01.functionId).toBe("F-01");
    expect(f01.candidates.map((c) => [c.function, c.shared])).toEqual([
      ["create_reservation", false],
      ["ReservationService.create", true],
    ]);
    expect(f02.candidates.map((c) => [c.function, c.shared])).toEqual([
      ["ReservationService.create", true],
    ]);
    expect(isCalledFrom(f02.candidates[0], "F-01")).toBe(true);
    expect(isCalledFrom(f01.candidates[0], "F-02")).toBe(false);
  });

  it("logicStatusは未選択・未生成・生成済を返す", () => {
    const model = { logics: [makeLogic(), makeLogic({ ...CREATE, signature: "", pseudo: [] })] };
    expect(logicStatus(model, keyOf(makeLogic()))).toBe("drafted");
    expect(logicStatus(model, keyOf(CREATE))).toBe("pending");
    expect(logicStatus(model, logicKey(SERVICE, "missing"))).toBe("unselected");
  });

  it("selectAllはタブの未選択だけを足し、選んだ関数の詳細は変えない", () => {
    const all = logicCandidates(procedures());
    const [f01] = candidatesByProcedure(procedures());
    const model = selectAll(makeLogics(), all, f01.candidates);
    expect(model.logics.map((row) => row.function)).toEqual([
      "create_reservation",
      "ReservationService.create",
    ]);
    expect(model.logics[0]).toEqual(makeLogic());
  });

  it("pendingInTabはタブの未生成の関数だけを返す", () => {
    const [f01] = candidatesByProcedure(procedures());
    const model = { logics: [makeLogic(), makeLogic({ ...CREATE, signature: "", pseudo: [] })] };
    expect(pendingInTab(model, f01.candidates)).toEqual([CREATE]);
  });
});
