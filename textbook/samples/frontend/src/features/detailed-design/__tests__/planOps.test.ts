// 作成：Phase-23-5｜更新：Phase-26-5
// 写経レベル: 定型 ── 純粋関数の入出力の確認。
// Phase-26-5:追記 ── UNIT_KINDS, MAX_UNIT_FUNCTIONS, PlanModel(api/types), UNIT_KIND_LABELS(labels), milestoneFunctions, moveTask, relinkDependencies, taskId(planOps)
import { describe, expect, it } from "vitest";
import {
  CROSSCUTTING_TOPICS,
  MAX_UNIT_FUNCTIONS,
  UNIT_KINDS,
  type PlanModel,
} from "@/features/detailed-design/api/types";
import { UNIT_KIND_LABELS } from "@/features/detailed-design/labels";
import {
  addCrossCutting,
  addMilestone,
  addRisk,
  addTask,
  hasPlanDraft,
  milestoneFunctions,
  milestoneId,
  missingTopics,
  moveMilestone,
  moveTask,
  relinkDependencies,
  removeCrossCutting,
  removeMilestone,
  removeRisk,
  removeTask,
  taskId,
  toPlan,
  updateCrossCutting,
  updateMilestone,
  updateRisk,
  updateTask,
} from "@/features/detailed-design/planOps";
import { makePlan } from "@/features/detailed-design/test-utils/stageFixtures";

// SUT: planOps(段階7の編集操作)と、型の定数(api/types の UNIT_KINDS・MAX_UNIT_FUNCTIONS・
// CROSSCUTTING_TOPICS)、種別の表示(labels の UNIT_KIND_LABELS)
// ドライバ: 各テスト / スタブ不要 ── どれも純粋関数(副作用なし)で、外部依存を呼ばないため。

// 依存の付け替えを見るための計画: M-01 に T01・T02(T01 に依存)、M-02 に T01(M-01-T02 に依存)。
function chain(): PlanModel {
  return toPlan({
    milestones: [
      {
        name: "a",
        tasks: [
          { kind: "base", title: "t1" },
          { title: "t2", depends_on: ["M-01-T01"] },
        ],
      },
      { name: "b", tasks: [{ title: "t3", depends_on: ["M-01-T02", "X-99"] }] },
    ],
  });
}

const deps = (plan: PlanModel) =>
  plan.milestones.flatMap((m) => m.tasks.map((t) => [t.title, t.depends_on] as const));
describe("planOps", () => {
  // Phase-26-5：更新
  // it("統合スモーク: 保存済みの model を読み、編集しても元の model は変わらない", () => {
  //   const saved = makePlan();
  //   const plan = toPlan(saved as unknown as Record<string, unknown>);
  //   expect(plan).toEqual(saved);
  //   expect(hasPlanDraft(plan)).toBe(true);
  //
  //   const edited = updateTask(plan, 0, 0, { title: "変更" });
  //   expect(edited.milestones[0].tasks[0].title).toBe("変更");
  //   expect(plan.milestones[0].tasks[0].title).toBe("予約の API を作る");
  // });
  // ↓↓
  it("統合スモーク: 保存済みの model を読み、編集しても元の model は変わらない", () => {
    const saved = makePlan();
    const plan = toPlan(saved as unknown as Record<string, unknown>);
    expect(plan).toEqual(saved);
    expect(hasPlanDraft(plan)).toBe(true);

    const edited = updateTask(plan, 0, 1, { title: "変更" });
    expect(edited.milestones[0].tasks[1].title).toBe("変更");
    expect(plan.milestones[0].tasks[1].title).toBe("予約を登録する");
  });

  // Phase-26-5:追記
  it("toPlan は空・形の崩れた値をそろえる(優先度・種別は選択肢に無ければ既定値)", () => {
    expect(toPlan(null)).toEqual({ crosscutting: [], milestones: [], environment: "", risks: [] });
    const plan = toPlan({
      crosscutting: [{ topic: "認証" }],
      milestones: [{ name: "a", priority: "Won't", tasks: [{ kind: "運用", title: "t" }] }],
    });
    expect(plan.crosscutting).toEqual([{ topic: "認証", policy: "", modules: [] }]);
    expect(plan.milestones[0].priority).toBe("Must");
    expect(plan.milestones[0].tasks[0]).toEqual({
      kind: "feature",
      title: "t",
      function_ids: [],
      depends_on: [],
      modules: [],
      config_files: [],
    });
    expect(hasPlanDraft(toPlan(null))).toBe(false);
  });

  // Phase-26-5:追記
  it("milestoneId・taskId は並び順から M-01・M-01-T01 の形で導く", () => {
    expect([0, 9, 99].map(milestoneId)).toEqual(["M-01", "M-10", "M-100"]);
    expect([taskId(0, 0), taskId(1, 9)]).toEqual(["M-01-T01", "M-02-T10"]);
    expect(UNIT_KINDS.map((kind) => UNIT_KIND_LABELS[kind])).toEqual(["機能", "基盤"]);
    expect(MAX_UNIT_FUNCTIONS).toBe(3);
  });

  // Phase-26-5:追記
  it("milestoneFunctions はタスクの処理を並び順に重複なく返す", () => {
    const plan = toPlan({
      milestones: [{ name: "a", tasks: [{ function_ids: ["F-02", " F-01 "] }, { function_ids: ["F-01", ""] }] }],
    });
    expect(milestoneFunctions(plan.milestones[0])).toEqual(["F-02", "F-01"]);
  });

  it("missingTopics は既定の項目のうち行の無いものを返す", () => {
    const plan = toPlan({ crosscutting: [{ topic: " 認証 " }] });
    expect(missingTopics(plan)).toEqual(CROSSCUTTING_TOPICS.filter((t) => t !== "認証"));
    expect(missingTopics(addCrossCutting(plan, "ログ"))).not.toContain("ログ");
  });

  it("横断事項・リスクを足す・直す・消す", () => {
    let plan = toPlan(null);
    plan = addCrossCutting(plan);
    plan = updateCrossCutting(plan, 0, { topic: "ログ", modules: ["app/main.py"] });
    expect(plan.crosscutting).toEqual([{ topic: "ログ", policy: "", modules: ["app/main.py"] }]);
    expect(removeCrossCutting(plan, 0).crosscutting).toEqual([]);

    plan = updateRisk(addRisk(plan), 0, { risk: "遅延" });
    expect(plan.risks).toEqual([{ risk: "遅延", mitigation: "" }]);
    expect(removeRisk(plan, 0).risks).toEqual([]);
  });

  // Phase-26-5：更新
  // it("マイルストーンとその中のタスクを足す・直す・消す", () => {
  //   let plan = addMilestone(toPlan(null));
  //   plan = updateMilestone(plan, 0, { name: "M", priority: "Could" });
  //   plan = addTask(plan, 0);
  //   plan = updateTask(plan, 0, 0, { area: "テスト", function_ids: ["F-01"] });
  //   expect(plan.milestones[0]).toMatchObject({ name: "M", priority: "Could" });
  //   expect(plan.milestones[0].tasks).toEqual([
  //     { area: "テスト", title: "", modules: [], function_ids: ["F-01"] },
  //   ]);
  //   expect(removeTask(plan, 0, 0).milestones[0].tasks).toEqual([]);
  //   expect(removeMilestone(plan, 0).milestones).toEqual([]);
  // });
  // ↓↓
  it("マイルストーンとその中のタスクを足す・直す・消す", () => {
    let plan = addMilestone(toPlan(null));
    plan = updateMilestone(plan, 0, { name: "M", priority: "Could" });
    plan = addTask(plan, 0);
    plan = updateTask(plan, 0, 0, { kind: "base", config_files: ["Dockerfile"] });
    expect(plan.milestones[0]).toMatchObject({ name: "M", priority: "Could" });
    expect(plan.milestones[0].tasks).toEqual([
      {
        kind: "base",
        title: "",
        function_ids: [],
        depends_on: [],
        modules: [],
        config_files: ["Dockerfile"],
      },
    ]);
    expect(removeTask(plan, 0, 0).milestones[0].tasks).toEqual([]);
    expect(removeMilestone(plan, 0).milestones).toEqual([]);
  });

  it("moveMilestone は隣と入れ替え、端を越える移動は何もしない", () => {
    let plan = toPlan({ milestones: [{ name: "a" }, { name: "b" }] });
    plan = moveMilestone(plan, 1, -1);
    expect(plan.milestones.map((m) => m.name)).toEqual(["b", "a"]);
    expect(moveMilestone(plan, 0, -1)).toBe(plan);
    expect(moveMilestone(plan, 1, 1)).toBe(plan);
  });
  // Phase-26-5:追記
  it("moveTask はマイルストーンの中で入れ替え、依存先の ID を付け替える", () => {
    const plan = moveTask(chain(), 0, 1, -1);
    // t2 が M-01-T01 に、t1 が M-01-T02 になる(t2 は後ろの単位に依存する形になり、検証のエラーで分かる)
    expect(deps(plan)).toEqual([
      ["t2", ["M-01-T02"]],
      ["t1", []],
      ["t3", ["M-01-T01", "X-99"]],
    ]);
    expect(moveTask(plan, 0, 0, -1)).toBe(plan);
    expect(moveTask(plan, 0, 1, 1)).toBe(plan);
  });

  // Phase-26-5:追記
  it("removeTask は消した単位への依存を外し、後ろの単位の ID を詰める", () => {
    const plan = removeTask(chain(), 0, 0);
    expect(deps(plan)).toEqual([
      ["t2", []],
      ["t3", ["M-01-T01", "X-99"]],
    ]);
  });

  // Phase-26-5:追記
  it("moveMilestone・removeMilestone も依存先の ID を付け替える", () => {
    expect(deps(moveMilestone(chain(), 1, -1))).toEqual([
      ["t3", ["M-02-T02", "X-99"]],
      ["t1", []],
      ["t2", ["M-02-T01"]],
    ]);
    expect(deps(removeMilestone(chain(), 0))).toEqual([["t3", ["X-99"]]]);
  });

  // Phase-26-5:追記
  it("relinkDependencies は並びの変わらない model をそのままの依存で返す", () => {
    const plan = chain();
    expect(relinkDependencies(plan, plan)).toEqual(plan);
  });
  // Phase-26-5：削除
  // it("toPlan は空・形の崩れた値をそろえる(優先度・区分は選択肢に無ければ既定値)", () => {
  //   expect(toPlan(null)).toEqual({ crosscutting: [], milestones: [], environment: "", risks: [] });
  //   const plan = toPlan({
  //     crosscutting: [{ topic: "認証" }],
  //     milestones: [{ name: "a", priority: "Won't", tasks: [{ area: "運用", title: "t" }] }],
  //   });
  //   expect(plan.crosscutting).toEqual([{ topic: "認証", policy: "", modules: [] }]);
  //   expect(plan.milestones[0].priority).toBe("Must");
  //   expect(plan.milestones[0].tasks[0]).toEqual({
  //     area: "バックエンド",
  //     title: "t",
  //     modules: [],
  //     function_ids: [],
  //   });
  //   expect(hasPlanDraft(toPlan(null))).toBe(false);
  // });

  // Phase-26-5：削除
  // it("milestoneId は並び順から M-01 の形で導く", () => {
  //   expect([0, 9, 99].map(milestoneId)).toEqual(["M-01", "M-10", "M-100"]);
  // });

});
