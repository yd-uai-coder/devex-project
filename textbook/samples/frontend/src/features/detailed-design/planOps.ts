// 作成：Phase-23-5
// 写経レベル: 定型 ── 行の追加・更新・削除が大半。マイルストーンの番号を保存せず並び順から導く点と、タスクを入れ子で更新する点がコア。
import {
  CROSSCUTTING_TOPICS,
  PRIORITIES,
  TASK_AREAS,
  type CrossCuttingRow,
  type Milestone,
  type PlanModel,
  type PlanTask,
  type Priority,
  type Risk,
  type TaskArea,
} from "@/features/detailed-design/api/types";

// 段階7(横断事項と実装計画)の編集操作(純粋関数)。どれも新しいモデルを返し、引数は変えない。
// 行は名前で引かず並びの位置で扱う(名前は人が書き換える欄で、重複も検証のエラーとして一旦は許すため。
// 段階4のモジュール一覧と同じ。Phase 23)。

const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
const pick = <T extends string>(value: unknown, choices: T[], fallback: T): T =>
  choices.includes(value as T) ? (value as T) : fallback;

// 保存されている model(形の保証の無い JSON)を、編集できる形にそろえる。
export function toPlan(model: Record<string, unknown> | null): PlanModel {
  const list = (value: unknown) => (Array.isArray(value) ? (value as Record<string, unknown>[]) : []);
  return {
    crosscutting: list(model?.crosscutting).map((row) => ({
      topic: String(row.topic ?? ""),
      policy: String(row.policy ?? ""),
      modules: strings(row.modules),
    })),
    milestones: list(model?.milestones).map((row) => ({
      name: String(row.name ?? ""),
      goal: String(row.goal ?? ""),
      priority: pick<Priority>(row.priority, PRIORITIES, "Must"),
      function_ids: strings(row.function_ids),
      tasks: list(row.tasks).map((task) => ({
        area: pick<TaskArea>(task.area, TASK_AREAS, "バックエンド"),
        title: String(task.title ?? ""),
        modules: strings(task.modules),
        function_ids: strings(task.function_ids),
      })),
    })),
    environment: String(model?.environment ?? ""),
    risks: list(model?.risks).map((row) => ({
      risk: String(row.risk ?? ""),
      mitigation: String(row.mitigation ?? ""),
    })),
  };
}

// 下書きの内容があるか(作り直しの確認を出すかの判定)。
export function hasPlanDraft(model: PlanModel): boolean {
  return model.crosscutting.length > 0 || model.milestones.length > 0;
}

// 並び順(0始まり)からマイルストーンの番号を導く(devex-api の milestone_id と同じ)。
export function milestoneId(index: number): string {
  return `M-${String(index + 1).padStart(2, "0")}`;
}

// 07 横断事項に必ず書く項目のうち、行の無いもの(検証の MISSING_TOPIC と同じ)。
export function missingTopics(model: PlanModel): string[] {
  const topics = new Set(model.crosscutting.map((row) => row.topic.trim()));
  return CROSSCUTTING_TOPICS.filter((topic) => !topics.has(topic));
}

const replaceAt = <T>(items: T[], index: number, patch: Partial<T>): T[] =>
  items.map((item, i) => (i === index ? { ...item, ...patch } : item));
const removeAt = <T>(items: T[], index: number): T[] => items.filter((_, i) => i !== index);

// --- 横断事項 ---

// 項目を足す。topic を渡すと、その項目名で足す(欠けている既定の項目を足すボタン)。
export function addCrossCutting(model: PlanModel, topic = ""): PlanModel {
  const row: CrossCuttingRow = { topic, policy: "", modules: [] };
  return { ...model, crosscutting: [...model.crosscutting, row] };
}

export function updateCrossCutting(
  model: PlanModel,
  index: number,
  patch: Partial<CrossCuttingRow>,
): PlanModel {
  return { ...model, crosscutting: replaceAt(model.crosscutting, index, patch) };
}

export function removeCrossCutting(model: PlanModel, index: number): PlanModel {
  return { ...model, crosscutting: removeAt(model.crosscutting, index) };
}

// --- マイルストーン ---

export function addMilestone(model: PlanModel): PlanModel {
  const row: Milestone = { name: "", goal: "", priority: "Must", function_ids: [], tasks: [] };
  return { ...model, milestones: [...model.milestones, row] };
}

export function updateMilestone(
  model: PlanModel,
  index: number,
  patch: Partial<Milestone>,
): PlanModel {
  return { ...model, milestones: replaceAt(model.milestones, index, patch) };
}

export function removeMilestone(model: PlanModel, index: number): PlanModel {
  return { ...model, milestones: removeAt(model.milestones, index) };
}

// マイルストーンを1つ上(delta=-1)・下(delta=1)へ動かす。端を越える移動は何もしない。
// 番号(M-01…)は並び順から振り直される。
export function moveMilestone(model: PlanModel, index: number, delta: -1 | 1): PlanModel {
  const target = index + delta;
  if (target < 0 || target >= model.milestones.length) return model;
  const milestones = [...model.milestones];
  [milestones[index], milestones[target]] = [milestones[target], milestones[index]];
  return { ...model, milestones };
}

// --- タスク(マイルストーンの中) ---

export function addTask(model: PlanModel, milestone: number): PlanModel {
  const task: PlanTask = { area: "バックエンド", title: "", modules: [], function_ids: [] };
  const tasks = [...model.milestones[milestone].tasks, task];
  return updateMilestone(model, milestone, { tasks });
}

export function updateTask(
  model: PlanModel,
  milestone: number,
  index: number,
  patch: Partial<PlanTask>,
): PlanModel {
  const tasks = replaceAt(model.milestones[milestone].tasks, index, patch);
  return updateMilestone(model, milestone, { tasks });
}

export function removeTask(model: PlanModel, milestone: number, index: number): PlanModel {
  const tasks = removeAt(model.milestones[milestone].tasks, index);
  return updateMilestone(model, milestone, { tasks });
}

// --- リスク ---

export function addRisk(model: PlanModel): PlanModel {
  const row: Risk = { risk: "", mitigation: "" };
  return { ...model, risks: [...model.risks, row] };
}

export function updateRisk(model: PlanModel, index: number, patch: Partial<Risk>): PlanModel {
  return { ...model, risks: replaceAt(model.risks, index, patch) };
}

export function removeRisk(model: PlanModel, index: number): PlanModel {
  return { ...model, risks: removeAt(model.risks, index) };
}
