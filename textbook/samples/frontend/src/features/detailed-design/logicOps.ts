// 作成：Phase-21-5｜更新：Phase-21-5(画面確認後の修正。処理ごとのタブ),29-1
// 写経レベル: コア ── L-ID を並び順から導き、05↔06 を (モジュール, 関数) と (callee, call) の一致で導く。
// Phase-29-1:追記 ── @/features/detailed-design/procedureOps.callsFunction(isExternalActor は削除)
import type {
  LogicModel,
  LogicRow,
  LogicTarget,
  ProcedureModel,
  PseudoStep,
} from "@/features/detailed-design/api/types";
import { callsFunction, numberSteps, stepId } from "@/features/detailed-design/procedureOps";

// 段階6(処理ロジックの詳細)の編集操作と、05↔06 の紐づけを導く表(候補・呼ばれる手順・逆引き・
// L-ID の引き当て)。すべて純粋関数で、どれも新しいモデルを返し引数は変えない(Phase 21)。
// L-ID は保存せず並び順から導き、紐づけは (モジュール, 関数) と手順の (callee, call) の一致から導く
// (バックエンドの app/detailed_design/logic.py と同じ規則)。

const TEXT_FIELDS = ["signature", "args", "returns", "raises", "pre", "post"] as const;

// 保存されている model(形の保証の無い JSON)を、編集できる形にそろえる。
export function toLogics(model: Record<string, unknown> | null): LogicModel {
  const logics = Array.isArray(model?.logics)
    ? (model.logics as Partial<LogicRow>[]).map((row): LogicRow => {
        const normalized: LogicRow = {
          module: String(row.module ?? ""),
          function: String(row.function ?? ""),
          signature: "",
          args: "",
          returns: "",
          raises: "",
          pre: "",
          post: "",
          pseudo: Array.isArray(row.pseudo)
            ? (row.pseudo as Partial<PseudoStep>[]).map((step) => ({
                text: String(step.text ?? ""),
                sub: Array.isArray(step.sub) ? step.sub.map(String) : [],
              }))
            : [],
        };
        for (const field of TEXT_FIELDS) normalized[field] = String(row[field] ?? "");
        return normalized;
      })
    : [];
  return { logics };
}

// 並び順(0始まり)から L-ID を導く(L-01…)。
export function logicId(index: number): string {
  return `L-${String(index + 1).padStart(2, "0")}`;
}

// (モジュール, 関数) の鍵(バックエンドの logic_key と同じ形)。
export function logicKey(module: string, fn: string): string {
  return `${module.trim()}::${fn.trim()}`;
}

export function keyOf(row: { module: string; function: string }): string {
  return logicKey(row.module, row.function);
}

// 下書き(または人の記入)がある関数か。シグネチャか擬似フローのどちらかがあれば、ある。
export function isDrafted(row: LogicRow): boolean {
  return row.signature.trim() !== "" || row.pseudo.length > 0;
}

// まだ下書きの無い関数(バックエンドの pending_logic_keys と同じ)。
export function pendingLogics(model: LogicModel): LogicTarget[] {
  return model.logics
    .filter((row) => !isDrafted(row))
    .map((row) => ({ module: row.module, function: row.function }));
}

export type LogicCandidate = {
  module: string;
  function: string;
  stepIds: string[]; // その関数を呼ぶ手順の手順ID(段階5の並び順)
};

// Phase-29-1：更新
// // 段階5の手順から、段階6で選べる関数を集める(最初に現れた順)。対象は、分岐でなく、呼び出し先が
// // モジュール(「/」を含むパス)で、呼ぶ関数が空でない行。
// ↓↓
// 段階5の手順から、段階6で選べる関数を集める(最初に現れた順)。対象は、モジュールの関数を呼ぶ行
// (callsFunction。分岐・戻り・外部の役者は除く)。
export function logicCandidates(procedures: ProcedureModel): LogicCandidate[] {
  const found = new Map<string, LogicCandidate>();
  for (const procedure of procedures.procedures) {
    const numbers = numberSteps(procedure.steps);
    procedure.steps.forEach((step, i) => {
      // Phase-29-1：更新
      // const callee = step.callee.trim();
      // const call = step.call.trim();
      // if (step.is_branch || !callee || !call || isExternalActor(callee)) return;
      // ↓↓
      if (!callsFunction(step)) return;
      const callee = step.callee.trim();
      const call = step.call.trim();
      const key = logicKey(callee, call);
      const candidate = found.get(key) ?? { module: callee, function: call, stepIds: [] };
      candidate.stepIds.push(stepId(procedure.function_id, numbers[i]));
      found.set(key, candidate);
    });
  }
  return [...found.values()];
}

// (モジュール, 関数) を呼ぶ手順の手順ID(06 の「呼ばれる手順」)。
export function callingSteps(procedures: ProcedureModel, module: string, fn: string): string[] {
  const key = logicKey(module, fn);
  return logicCandidates(procedures).find((c) => keyOf(c) === key)?.stepIds ?? [];
}

// 関数の鍵 → L-ID(05 の手順の行の「詳細 L-02」バッジに使う)。
export function logicIdsByKey(model: LogicModel): Map<string, string> {
  return new Map(model.logics.map((row, i) => [keyOf(row), logicId(i)]));
}

export type ReverseRow = {
  id: string; // L-ID
  row: LogicRow;
  stepIds: string[];
};

// 06 章の冒頭の逆引き(L-ID/関数/モジュール/呼ばれる手順)。
export function buildReverseIndex(model: LogicModel, procedures: ProcedureModel): ReverseRow[] {
  const steps = new Map(logicCandidates(procedures).map((c) => [keyOf(c), c.stepIds]));
  return model.logics.map((row, i) => ({
    id: logicId(i),
    row,
    stepIds: steps.get(keyOf(row)) ?? [],
  }));
}

const EMPTY_ROW: Omit<LogicRow, "module" | "function"> = {
  signature: "",
  args: "",
  returns: "",
  raises: "",
  pre: "",
  post: "",
  pseudo: [],
};

// 詳細を書く関数を選ぶ・外す。選んだ関数は候補の順(段階5で最初に呼ばれた順)に並べる
// (候補に無い関数 ── 段階5を直して呼ばれなくなったもの ── は末尾のまま)。
export function toggleLogic(
  model: LogicModel,
  candidates: LogicCandidate[],
  target: LogicTarget,
  checked: boolean,
): LogicModel {
  const key = keyOf(target);
  if (!checked) return { logics: model.logics.filter((row) => keyOf(row) !== key) };
  if (model.logics.some((row) => keyOf(row) === key)) return model;
  const order = new Map(candidates.map((c, i) => [keyOf(c), i]));
  const rank = (row: LogicRow) => order.get(keyOf(row)) ?? Number.MAX_SAFE_INTEGER;
  const added: LogicRow = { module: target.module, function: target.function, ...EMPTY_ROW };
  return { logics: [...model.logics, added].sort((a, b) => rank(a) - rank(b)) };
}

export function updateLogic(
  model: LogicModel,
  key: string,
  patch: Partial<Omit<LogicRow, "module" | "function">>,
): LogicModel {
  return { logics: model.logics.map((row) => (keyOf(row) === key ? { ...row, ...patch } : row)) };
}

function updatePseudoSteps(
  model: LogicModel,
  key: string,
  change: (pseudo: PseudoStep[]) => PseudoStep[],
): LogicModel {
  return {
    logics: model.logics.map((row) =>
      keyOf(row) === key ? { ...row, pseudo: change(row.pseudo) } : row,
    ),
  };
}

// 擬似フローの末尾に段を足す。
export function addPseudoStep(model: LogicModel, key: string): LogicModel {
  return updatePseudoSteps(model, key, (pseudo) => [...pseudo, { text: "", sub: [] }]);
}

export function updatePseudoStep(
  model: LogicModel,
  key: string,
  index: number,
  patch: Partial<PseudoStep>,
): LogicModel {
  return updatePseudoSteps(model, key, (pseudo) =>
    pseudo.map((step, i) => (i === index ? { ...step, ...patch } : step)),
  );
}

export function removePseudoStep(model: LogicModel, key: string, index: number): LogicModel {
  return updatePseudoSteps(model, key, (pseudo) => pseudo.filter((_, i) => i !== index));
}

// 下位の箇条の入力(1行1箇条)と配列の変換。空の行は保存の前に残してよい(検証は箇条の中身を見ない)。
export function subToText(sub: string[]): string {
  return sub.join("\n");
}

export function textToSub(text: string): string[] {
  return text === "" ? [] : text.split("\n");
}

// Phase-21-5:追記(画面確認後の修正)
// ── 処理ごとのタブ(Phase 21 の画面確認後) ──
// 候補が多いときに、段階5の処理ごとに候補と詳細を切り替えて見せる。データ(model)・L-ID・逆引きは
// 全体のまま変えず、見せ方だけを処理ごとに分ける。

export type TabCandidate = LogicCandidate & {
  shared: boolean; // 2つ以上の処理から呼ばれる(共通の関数)
};

export type ProcedureTab = {
  functionId: string; // 段階5の処理ID
  candidates: TabCandidate[]; // その処理の手順から呼ばれる関数(候補の順)
};

// 手順ID(F-01#4a)の処理ID の部分。
function functionIdOf(stepIdValue: string): string {
  return stepIdValue.split("#")[0];
}

// 段階5の処理の順に、その処理の手順から呼ばれる候補を並べる。共通の関数は、呼ぶ処理すべてのタブに出す。
export function candidatesByProcedure(procedures: ProcedureModel): ProcedureTab[] {
  const candidates = logicCandidates(procedures);
  return procedures.procedures.map((procedure) => ({
    functionId: procedure.function_id,
    candidates: candidates
      .filter((c) => c.stepIds.some((id) => functionIdOf(id) === procedure.function_id))
      .map((c) => ({
        ...c,
        shared: new Set(c.stepIds.map(functionIdOf)).size > 1,
      })),
  }));
}

// 関数がその処理から呼ばれるか(手順ID の処理ID の部分で判定する)。
export function isCalledFrom(candidate: LogicCandidate, functionId: string): boolean {
  return candidate.stepIds.some((id) => functionIdOf(id) === functionId);
}

export type LogicStatus = "unselected" | "pending" | "drafted";

// 関数の状態: 未選択 / 選んだが下書きが無い(未生成) / 下書きがある(生成済)。
export function logicStatus(model: LogicModel, key: string): LogicStatus {
  const row = model.logics.find((item) => keyOf(item) === key);
  if (!row) return "unselected";
  return isDrafted(row) ? "drafted" : "pending";
}

// タブの未選択の候補をすべて選ぶ(選んだ関数・生成済の関数はそのまま)。並びは toggleLogic と同じ。
export function selectAll(
  model: LogicModel,
  allCandidates: LogicCandidate[],
  tabCandidates: LogicCandidate[],
): LogicModel {
  return tabCandidates.reduce(
    (current, c) => toggleLogic(current, allCandidates, { module: c.module, function: c.function }, true),
    model,
  );
}

// タブの未生成の関数(選んだが下書きの無いもの。生成の対象)。
export function pendingInTab(model: LogicModel, tabCandidates: LogicCandidate[]): LogicTarget[] {
  return tabCandidates
    .filter((c) => logicStatus(model, keyOf(c)) === "pending")
    .map((c) => ({ module: c.module, function: c.function }));
}
