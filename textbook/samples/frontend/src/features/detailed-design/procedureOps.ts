// 作成：Phase-20-5
// 写経レベル: コア ── 番号を並び順から導き、分岐を手順に付けて扱う。関与表の列はモジュール一覧のパスだけ。
import type {
  FunctionListModel,
  FunctionRow,
  Procedure,
  ProcedureModel,
  ProcedureStep,
} from "@/features/detailed-design/api/types";

// 段階5(主要処理の手順)の編集操作と、表示に導く表(索引・関与表)。すべて純粋関数で、どれも新しい
// モデルを返し引数は変えない(Phase 20)。手順番号は保存せず、並び順と is_branch から導く
// (バックエンドの number_steps と同じ規則)。

const STEP_FIELDS = [
  "caller",
  "callee",
  "call",
  "data",
  "action",
  "result",
  "db",
  "branch",
] as const;

const EMPTY_STEP: ProcedureStep = {
  caller: "",
  callee: "",
  call: "",
  data: "",
  action: "",
  result: "",
  db: "",
  branch: "",
  is_branch: false,
};

// 保存されている model(形の保証の無い JSON)を、編集できる形にそろえる。
export function toProcedures(model: Record<string, unknown> | null): ProcedureModel {
  const procedures = Array.isArray(model?.procedures)
    ? (model.procedures as Partial<Procedure>[]).map(
        (row): Procedure => ({
          function_id: String(row.function_id ?? ""),
          reason: String(row.reason ?? ""),
          note: String(row.note ?? ""),
          steps: Array.isArray(row.steps)
            ? (row.steps as Partial<ProcedureStep>[]).map((step) => {
                const normalized: ProcedureStep = { ...EMPTY_STEP };
                for (const field of STEP_FIELDS) normalized[field] = String(step[field] ?? "");
                normalized.is_branch = Boolean(step.is_branch);
                return normalized;
              })
            : [],
        }),
      )
    : [];
  return { procedures };
}

// 分岐の番号の添え字(1 → a、26 → z、27 → aa)。
function branchSuffix(index: number): string {
  let letters = "";
  let rest = index;
  while (rest > 0) {
    const mod = (rest - 1) % 26;
    letters = String.fromCharCode(97 + mod) + letters;
    rest = Math.floor((rest - 1) / 26);
  }
  return letters;
}

// 手順番号を並び順から導く。分岐の行は直前の手順の番号に a, b… を付ける。先頭の分岐の行は 0a。
export function numberSteps(steps: ProcedureStep[]): string[] {
  let main = 0;
  let sub = 0;
  return steps.map((step) => {
    if (step.is_branch) {
      sub += 1;
      return `${main}${branchSuffix(sub)}`;
    }
    main += 1;
    sub = 0;
    return String(main);
  });
}

// 文書全体で一意な手順ID(F-01#4、分岐は F-01#4a)。
export function stepId(functionId: string, number: string): string {
  return `${functionId}#${number}`;
}

// 呼び出し先が外部の役者(利用者・スケジューラなど)か。モジュールはパスなので「/」を含む。
export function isExternalActor(callee: string): boolean {
  return !callee.includes("/");
}

// 分岐を除いた手順の数(索引に出す)。
export function mainStepCount(procedure: Procedure): number {
  return procedure.steps.filter((step) => !step.is_branch).length;
}

// まだ手順の無い(下書きを作っていない)処理の処理ID(バックエンドの pending_function_ids と同じ)。
export function pendingFunctionIds(model: ProcedureModel): string[] {
  return model.procedures.filter((p) => p.steps.length === 0).map((p) => p.function_id);
}

// 手順を書く処理を選ぶ・外す。選んだ処理は機能一覧の順に並べる(機能一覧に無い処理は末尾のまま)。
export function toggleProcedure(
  model: ProcedureModel,
  functionList: FunctionListModel,
  functionId: string,
  checked: boolean,
): ProcedureModel {
  const exists = model.procedures.some((p) => p.function_id === functionId);
  if (!checked) {
    return { procedures: model.procedures.filter((p) => p.function_id !== functionId) };
  }
  if (exists) return model;
  const order = new Map(functionList.functions.map((fn, index) => [fn.id, index]));
  const rank = (id: string) => order.get(id) ?? Number.MAX_SAFE_INTEGER;
  const added: Procedure = { function_id: functionId, reason: "", note: "", steps: [] };
  const procedures = [...model.procedures, added].sort(
    (a, b) => rank(a.function_id) - rank(b.function_id),
  );
  return { procedures };
}

export function updateProcedure(
  model: ProcedureModel,
  functionId: string,
  patch: Partial<Omit<Procedure, "function_id">>,
): ProcedureModel {
  return {
    procedures: model.procedures.map((p) =>
      p.function_id === functionId ? { ...p, ...patch } : p,
    ),
  };
}

function updateSteps(
  model: ProcedureModel,
  functionId: string,
  change: (steps: ProcedureStep[]) => ProcedureStep[],
): ProcedureModel {
  return {
    procedures: model.procedures.map((p) =>
      p.function_id === functionId ? { ...p, steps: change(p.steps) } : p,
    ),
  };
}

// 末尾に手順の行を足す。
export function addStep(model: ProcedureModel, functionId: string): ProcedureModel {
  return updateSteps(model, functionId, (steps) => [...steps, { ...EMPTY_STEP }]);
}

// index の手順に分岐の行を足す。その手順に付いている分岐の行の後ろに置く。
export function addBranch(
  model: ProcedureModel,
  functionId: string,
  index: number,
): ProcedureModel {
  return updateSteps(model, functionId, (steps) => {
    let at = index + 1;
    while (at < steps.length && steps[at].is_branch) at += 1;
    return [...steps.slice(0, at), { ...EMPTY_STEP, is_branch: true }, ...steps.slice(at)];
  });
}

export function updateStep(
  model: ProcedureModel,
  functionId: string,
  index: number,
  patch: Partial<ProcedureStep>,
): ProcedureModel {
  return updateSteps(model, functionId, (steps) =>
    steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
  );
}

// 行を消す。手順の行を消すと、その手順に付いている分岐の行も消す(前の手順の分岐に付け替わらないように)。
export function removeStep(
  model: ProcedureModel,
  functionId: string,
  index: number,
): ProcedureModel {
  return updateSteps(model, functionId, (steps) => {
    if (steps[index]?.is_branch) return steps.filter((_, i) => i !== index);
    let end = index + 1;
    while (end < steps.length && steps[end].is_branch) end += 1;
    return [...steps.slice(0, index), ...steps.slice(end)];
  });
}

export type IndexRow = {
  procedure: Procedure;
  fn: FunctionRow | null; // 機能一覧に無い処理(段階1から消えた)は null
  stepCount: number;
};

// 05 章の冒頭の索引(処理ID/名称/トリガー/選定理由/手順数)。紐づく 06 の項目は段階6(Phase 21)で足す。
export function buildIndex(model: ProcedureModel, functionList: FunctionListModel): IndexRow[] {
  const functions = new Map(functionList.functions.map((fn) => [fn.id, fn]));
  return model.procedures.map((procedure) => ({
    procedure,
    fn: functions.get(procedure.function_id) ?? null,
    stepCount: mainStepCount(procedure),
  }));
}

export type Involvement = {
  // 列: 呼び出し先として現れるモジュール(段階4のモジュール一覧の並び)
  modules: string[];
  // 行: 処理ID → モジュールのパス → そのモジュールが呼ばれる手順番号
  cells: Map<string, Map<string, string[]>>;
};

// 処理 × モジュールの関与表。CRUD 図と同じ格子で、セルには手順番号を入れる。列はモジュール一覧の
// パスと完全一致する呼び出し先だけ(外部の役者・一覧に無いパスは含めない。後者は検証のエラー)。
export function buildInvolvement(model: ProcedureModel, modulePaths: string[]): Involvement {
  const known = new Set(modulePaths);
  const used = new Set<string>();
  const cells = new Map<string, Map<string, string[]>>();
  for (const procedure of model.procedures) {
    const row = new Map<string, string[]>();
    const numbers = numberSteps(procedure.steps);
    procedure.steps.forEach((step, i) => {
      const callee = step.callee.trim();
      if (step.is_branch || !known.has(callee)) return;
      used.add(callee);
      row.set(callee, [...(row.get(callee) ?? []), numbers[i]]);
    });
    cells.set(procedure.function_id, row);
  }
  return { modules: modulePaths.filter((path) => used.has(path)), cells };
}
