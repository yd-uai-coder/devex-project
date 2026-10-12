// 作成：Phase-44-1｜更新：Phase-44-4,44(完了後の調整),46-3
// Phase-44-4:追記 ── ../impactOps(REGENERATION_LIMITS, regenerationGroups)
// Phase-44(完了後の調整):追記 ── ../impactOps(stageMarkSummary, visibleMarks)
import { describe, expect, it } from "vitest";
import {
  elementKey,
  focusTargetFor,
  hasImpact,
  markStatus,
  marksByKey,
  mayHaveImpact,
  openMarkKeys,
  openTotal,
  pathText,
  REGENERATION_LIMITS,
  regenerationArgs,
  regenerationGroups,
  resolveFixTarget,
  sourceLabel,
  stageMarkSummary,
  visibleMarks,
} from "../impactOps";
import {
  makeCrud,
  makeFunctionList,
  makeImpact,
  makeLogics,
  makeMark,
  makeModuleList,
  makePlan,
  makeStages,
} from "../test-utils/stageFixtures";

describe("impactOps", () => {
  it("要素のキーは devex-api と同じ形(テーブルは小文字)", () => {
    expect(elementKey.fn("F-01")).toBe("fn:F-01");
    expect(elementKey.table(" Reservations ")).toBe("table:reservations");
    expect(elementKey.crud("F-01", "Reservations")).toBe("crud:F-01×reservations");
    expect(elementKey.logic(" app/x.py ", "run ")).toBe("logic:app/x.py::run");
    expect(elementKey.unit("U-002")).toBe("unit:U-002");
  });

  it("変わった場所と道を文にする", () => {
    expect(sourceLabel("stage:4")).toBe("段階4");
    expect(sourceLabel("doc:external_design")).toBe("外部設計書");
    expect(pathText(["fn:F-01", "proc:F-01"])).toBe("fn:F-01 → proc:F-01");
  });

  // Phase-46-3：更新
  // it("印か承認後の編集がある詳細設計モードだけ影響を取りに行く", () => {
  // ↓↓
  it("印か承認後の編集があるときだけ影響を取りに行く(簡易モードは記録した印だけ)", () => {
    expect(mayHaveImpact(makeStages())).toBe(false);
    expect(mayHaveImpact(makeStages({ 5: { impact_open: 1 } }))).toBe(true);
    expect(mayHaveImpact(makeStages({ 4: { state: "reviewing", approved_version: 2 } }))).toBe(true);
    expect(mayHaveImpact(makeStages({ 4: { state: "approved", approved_version: 2 } }))).toBe(false);
    // Phase-46-3：更新
    // expect(mayHaveImpact([{ ...makeStages()[7], mode: "simple", impact_open: 1 }])).toBe(false);
    // ↓↓
    const simple = { ...makeStages()[7], mode: "simple" as const };
    expect(mayHaveImpact([{ ...simple, impact_open: 1 }])).toBe(true);
    expect(mayHaveImpact([{ ...simple, impact_reviewed: 1 }])).toBe(true);
    expect(mayHaveImpact([{ ...simple, state: "outdated", approved_version: 1 }])).toBe(false);
  });

  it("段階の印をキーで引き、記録した印を pending より優先する", () => {
    const impact = makeImpact();
    impact.stages[4].marks.push(makeMark({ pending: true, reason: "pending" }));
    impact.stages[4].marks.unshift(makeMark({ pending: true, reason: "pending" }));
    const marks = marksByKey(impact, 5);
    expect(marks.size).toBe(1);
    expect(marks.get("proc:F-01")?.pending).toBe(false);
    expect(marksByKey(null, 5).size).toBe(0);
  });

  it("印の状態・未確認のキー・件数", () => {
    const impact = makeImpact();
    expect(markStatus(makeMark())).toBe("open");
    expect(markStatus(makeMark({ reviewed: true }))).toBe("reviewed");
    expect(markStatus(makeMark({ pending: true }))).toBe("pending");
    expect(openMarkKeys(impact, 5)).toEqual(["proc:F-01"]);
    expect(openMarkKeys(impact, 6)).toEqual([]);
    expect(openMarkKeys(impact, 7)).toEqual([]);
    expect(openTotal(impact)).toBe(2);
    expect(hasImpact(impact)).toBe(true);
    expect(hasImpact({ stages: [], regeneration_targets: [] })).toBe(false);
  });

  it("再生成の候補のキーから部分再生成の引数を導く", () => {
    expect(regenerationArgs(5, ["proc:F-01", "proc:F-03"], null)).toEqual({
      functionIds: ["F-01", "F-03"],
    });
    expect(regenerationArgs(6, ["logic:app/x.py::run"], null)).toEqual({
      logics: [{ module: "app/x.py", function: "run" }],
    });
    // 段階8は単位のキーから今の表示の ID を引く(引けないキーは捨てる)
    expect(regenerationArgs(8, ["unit:U-002", "unit:U-999"], makePlan())).toEqual({
      unitIds: ["M-01-T02"],
    });
  });

  it("「段階Nで直す」の文字列から行のキーを推定する", () => {
    const stages = makeStages({
      1: { model: makeFunctionList() },
      3: { model: makeCrud() },
      4: { model: makeModuleList() },
      6: { model: makeLogics() },
      7: { model: makePlan() },
      8: { plan: makePlan() },
    });
    expect(resolveFixTarget(1, "F-01 の要件", stages)).toBe("fn:F-01");
    expect(resolveFixTarget(1, "F-09", stages)).toBeNull();
    expect(resolveFixTarget(3, "段階3 Reservations", stages)).toBe("table:reservations");
    expect(resolveFixTarget(3, "F-01 の reservations", stages)).toBe("crud:F-01×reservations");
    expect(resolveFixTarget(4, "app/api/routes/reservations.py の依存", stages)).toBe(
      "module:app/api/routes/reservations.py",
    );
    expect(resolveFixTarget(5, "F-01 の手順", stages)).toBe("proc:F-01");
    expect(resolveFixTarget(6, "create_reservation の事前条件", stages)).toBe(
      "logic:app/api/routes/reservations.py::create_reservation",
    );
    expect(resolveFixTarget(7, "M-01-T02 のモジュール", stages)).toBe("task:U-002");
    expect(resolveFixTarget(7, "07章 認証", stages)).toBe("cc:認証");
    expect(resolveFixTarget(8, "M-01-T02", stages)).toBe("unit:U-002");
    expect(resolveFixTarget(4, "どこか", stages)).toBeNull();
  });

  it("段階5・6 のタブを開く移動先を要素のキーから導く", () => {
    expect(focusTargetFor(5, "F-01#4", "proc:F-01")).toBe("F-01#4");
    expect(focusTargetFor(5, "段階5 F-01 の手順", "proc:F-01")).toBe("F-01");
    expect(focusTargetFor(6, "create_reservation", "logic:app/x.py::create_reservation")).toBe(
      "app/x.py::create_reservation",
    );
    expect(focusTargetFor(6, "何か", null)).toBe("何か");
  });

  // Phase-44-4:追記
  it("再生成の候補を段階の順にまとめ、段階ごとの上限を持つ", () => {
    const groups = regenerationGroups([
      { stage: 8, key: "unit:U-002", label: "M-01-T02 の手順書" },
      { stage: 5, key: "proc:F-01", label: "F-01 の手順" },
      { stage: 5, key: "proc:F-02", label: "F-02 の手順" },
    ]);
    expect(groups.map((g) => [g.stage, g.targets.length])).toEqual([
      [5, 2],
      [8, 1],
    ]);
    expect(REGENERATION_LIMITS).toEqual({ 5: 5, 6: 5, 8: 5 });
  });

  // Phase-44(完了後の調整):追記
  it("パネルの絞り込み: 印のある段階と未確認の数、未確認のみの印", () => {
    const impact = makeImpact();
    expect(stageMarkSummary(impact)).toEqual([
      { stage: 5, open: 1 },
      { stage: 6, open: 0 },
      { stage: 7, open: 0 },
      { stage: 8, open: 1 },
    ]);
    const marks = [makeMark(), makeMark({ reviewed: true }), makeMark({ pending: true })];
    expect(visibleMarks(marks, false)).toHaveLength(3);
    expect(visibleMarks(marks, true)).toEqual([marks[0]]);
  });
});
