// 作成：Phase-23-5
// 写経レベル: 定型 ── 純粋関数の入出力の確認。
import { describe, expect, it } from "vitest";
import { CROSSCUTTING_TOPICS } from "@/features/detailed-design/api/types";
import {
  addCrossCutting,
  addMilestone,
  addRisk,
  addTask,
  hasPlanDraft,
  milestoneId,
  missingTopics,
  moveMilestone,
  removeCrossCutting,
  removeMilestone,
  removeRisk,
  removeTask,
  toPlan,
  updateCrossCutting,
  updateMilestone,
  updateRisk,
  updateTask,
} from "@/features/detailed-design/planOps";
import { makePlan } from "@/features/detailed-design/test-utils/stageFixtures";

// SUT: planOps(段階7の編集操作)と、型の定数(api/types の PRIORITIES・TASK_AREAS・CROSSCUTTING_TOPICS)
// ドライバ: 各テスト / スタブ不要 ── どれも純粋関数(副作用なし)で、外部依存を呼ばないため。
describe("planOps", () => {
  it("統合スモーク: 保存済みの model を読み、編集しても元の model は変わらない", () => {
    const saved = makePlan();
    const plan = toPlan(saved as unknown as Record<string, unknown>);
    expect(plan).toEqual(saved);
    expect(hasPlanDraft(plan)).toBe(true);

    const edited = updateTask(plan, 0, 0, { title: "変更" });
    expect(edited.milestones[0].tasks[0].title).toBe("変更");
    expect(plan.milestones[0].tasks[0].title).toBe("予約の API を作る");
  });

  it("toPlan は空・形の崩れた値をそろえる(優先度・区分は選択肢に無ければ既定値)", () => {
    expect(toPlan(null)).toEqual({ crosscutting: [], milestones: [], environment: "", risks: [] });
    const plan = toPlan({
      crosscutting: [{ topic: "認証" }],
      milestones: [{ name: "a", priority: "Won't", tasks: [{ area: "運用", title: "t" }] }],
    });
    expect(plan.crosscutting).toEqual([{ topic: "認証", policy: "", modules: [] }]);
    expect(plan.milestones[0].priority).toBe("Must");
    expect(plan.milestones[0].tasks[0]).toEqual({
      area: "バックエンド",
      title: "t",
      modules: [],
      function_ids: [],
    });
    expect(hasPlanDraft(toPlan(null))).toBe(false);
  });

  it("milestoneId は並び順から M-01 の形で導く", () => {
    expect([0, 9, 99].map(milestoneId)).toEqual(["M-01", "M-10", "M-100"]);
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

  it("マイルストーンとその中のタスクを足す・直す・消す", () => {
    let plan = addMilestone(toPlan(null));
    plan = updateMilestone(plan, 0, { name: "M", priority: "Could" });
    plan = addTask(plan, 0);
    plan = updateTask(plan, 0, 0, { area: "テスト", function_ids: ["F-01"] });
    expect(plan.milestones[0]).toMatchObject({ name: "M", priority: "Could" });
    expect(plan.milestones[0].tasks).toEqual([
      { area: "テスト", title: "", modules: [], function_ids: ["F-01"] },
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
});
