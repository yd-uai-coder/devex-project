// 作成：Phase-23-5｜更新：Phase-26-5
// 写経レベル: 定型 ── 行の追加・更新・削除が大半。マイルストーンの番号を保存せず並び順から導く点と、タスクを入れ子で更新する点がコア。
// Phase-26-5：更新 ── import の TASK_AREAS・TaskArea を UNIT_KINDS・UnitKind に替えた
import {
  CROSSCUTTING_TOPICS,
  PRIORITIES,
  UNIT_KINDS,
  type CrossCuttingRow,
  type Milestone,
  type PlanModel,
  type PlanTask,
  type Priority,
  type Risk,
  type UnitKind,
} from "@/features/detailed-design/api/types";

// 段階7(横断事項と実装計画)の編集操作(純粋関数)。どれも新しいモデルを返し、引数は変えない。
// 行は名前で引かず並びの位置で扱う(名前は人が書き換える欄で、重複も検証のエラーとして一旦は許すため。
// 段階4のモジュール一覧と同じ)。単位の ID は並び順から導くので、単位を動かす・消す操作は、
// 依存先の ID を新しい並びの ID へ付け替える(relinkDependencies)。

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
      // Phase-26-5：更新
      // function_ids: strings(row.function_ids),
      // tasks: list(row.tasks).map((task) => ({
      //   area: pick<TaskArea>(task.area, TASK_AREAS, "バックエンド"),
      //   title: String(task.title ?? ""),
      //   modules: strings(task.modules),
      //   function_ids: strings(task.function_ids),
      // })),
      // ↓↓
      tasks: list(row.tasks).map((task) => ({
        kind: pick<UnitKind>(task.kind, UNIT_KINDS, "feature"),
        title: String(task.title ?? ""),
        function_ids: strings(task.function_ids),
        depends_on: strings(task.depends_on),
        modules: strings(task.modules),
        config_files: strings(task.config_files),
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

// Phase-26-5:追記
// マイルストーンとタスクの並び順(0始まり)から単位の ID を導く(devex-api の task_id と同じ)。
export function taskId(milestone: number, task: number): string {
  return `${milestoneId(milestone)}-T${String(task + 1).padStart(2, "0")}`;
}

// マイルストーンで動くようにする処理(タスクの処理を、並び順に重複なく。devex-api の
// milestone_functions と同じ)。
export function milestoneFunctions(milestone: Milestone): string[] {
  const ids = milestone.tasks.flatMap((task) => task.function_ids.map((f) => f.trim()));
  return [...new Set(ids.filter((f) => f))];
}

// ── ここから Phase-23-5 の作成分 ──
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
  // Phase-26-5：更新
  // const row: Milestone = { name: "", goal: "", priority: "Must", function_ids: [], tasks: [] };
  // ↓↓
  const row: Milestone = { name: "", goal: "", priority: "Must", tasks: [] };
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
  // Phase-26-5：更新
  // return { ...model, milestones: removeAt(model.milestones, index) };
  // ↓↓
  return relinkDependencies(model, { ...model, milestones: removeAt(model.milestones, index) });
}

// マイルストーンを1つ上(delta=-1)・下(delta=1)へ動かす。端を越える移動は何もしない。
// 番号(M-01…)と単位の ID は並び順から振り直され、依存先も付け替える。
export function moveMilestone(model: PlanModel, index: number, delta: -1 | 1): PlanModel {
  const target = index + delta;
  if (target < 0 || target >= model.milestones.length) return model;
  const milestones = [...model.milestones];
  [milestones[index], milestones[target]] = [milestones[target], milestones[index]];
  // Phase-26-5：更新
  // return { ...model, milestones };
  // ↓↓
  return relinkDependencies(model, { ...model, milestones });
}

// Phase-26-5:追記
// --- タスク(マイルストーンの中。実装手順書の作業単位) ---

// 並べ替え・削除の後の model(after)の依存先を、新しい並びの ID へ付け替える。動かした単位は
// 同じオブジェクトのまま並びが変わるので、前の model(before)のオブジェクトから元の ID を引く。
// 消した単位への依存は外す。単位の一覧に元から無い依存先は、そのまま残す(検証が指摘する)。
export function relinkDependencies(before: PlanModel, after: PlanModel): PlanModel {
  const oldIds = new Map<PlanTask, string>();
  before.milestones.forEach((m, mi) => m.tasks.forEach((t, ti) => oldIds.set(t, taskId(mi, ti))));
  const renamed = new Map<string, string>();
  after.milestones.forEach((m, mi) =>
    m.tasks.forEach((t, ti) => {
      const old = oldIds.get(t);
      if (old !== undefined) renamed.set(old, taskId(mi, ti));
    }),
  );
  const known = new Set(oldIds.values());
  const relink = (ids: string[]) =>
    ids.flatMap((id) => {
      if (!known.has(id.trim())) return [id];
      const next = renamed.get(id.trim());
      return next === undefined ? [] : [next];
    });
  return {
    ...after,
    milestones: after.milestones.map((m) => ({
      ...m,
      tasks: m.tasks.map((t) => ({ ...t, depends_on: relink(t.depends_on) })),
    })),
  };
}

// ── ここから Phase-23-5 の作成分 ──
export function addTask(model: PlanModel, milestone: number): PlanModel {
  // Phase-26-5：更新
  // const task: PlanTask = { area: "バックエンド", title: "", modules: [], function_ids: [] };
  // ↓↓
  const task: PlanTask = {
    kind: "feature",
    title: "",
    function_ids: [],
    depends_on: [],
    modules: [],
    config_files: [],
  };
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
  // Phase-26-5：更新
  // return updateMilestone(model, milestone, { tasks });
  // ↓↓
  return relinkDependencies(model, updateMilestone(model, milestone, { tasks }));
}

// Phase-26-5:追記
// マイルストーンの中でタスクを1つ上(delta=-1)・下(delta=1)へ動かす。端を越える移動は何もしない。
// 単位の ID は振り直され、依存先も付け替える(前へ動かして依存先より前に出ると、検証のエラーになる)。
export function moveTask(
  model: PlanModel,
  milestone: number,
  index: number,
  delta: -1 | 1,
): PlanModel {
  const target = index + delta;
  const current = model.milestones[milestone].tasks;
  if (target < 0 || target >= current.length) return model;
  const tasks = [...current];
  [tasks[index], tasks[target]] = [tasks[target], tasks[index]];
  return relinkDependencies(model, updateMilestone(model, milestone, { tasks }));
}

// ── ここから Phase-23-5 の作成分 ──
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
