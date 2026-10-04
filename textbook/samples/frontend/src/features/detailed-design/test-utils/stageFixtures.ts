// 作成：Phase-15-7｜更新：Phase-16-5,16-6,17-5,18-5,19-5,20-4,21-4
// 写経レベル: 定型 ── テスト用の段階の雛形。
// Phase-16-6:追記 ── @/features/detailed-design/api/types.FunctionListModel
// Phase-17-5:追記 ── @/features/detailed-design/api/types.DataFlowModel
// Phase-18-5:追記 ── @/features/detailed-design/api/types.CrudModel
// Phase-19-5:追記 ── @/features/detailed-design/api/types.ModuleListModel
// Phase-20-4:追記 ── @/features/detailed-design/api/types.ProcedureModel, ProcedureStep
// Phase-21-4:追記 ── @/features/detailed-design/api/types.LogicModel, LogicRow
import type {
  CrudModel,
  DataFlowModel,
  DesignStageRead,
  FunctionListModel,
  LogicModel,
  LogicRow,
  ModuleListModel,
  ProcedureModel,
  ProcedureStep,
} from "@/features/detailed-design/api/types";

// Phase-16-6:追記
// 段階1の検証を通る最小の機能一覧(処理1件・機能グループ1つ。テスト専用)。
export function makeFunctionList(): FunctionListModel {
  return {
    groups: ["reservations"],
    functions: [
      {
        id: "F-01",
        name: "予約を登録する",
        kind: "API",
        trigger: "POST /api/v1/reservations",
        screens: ["SCR-001"],
        group_initial: "reservations",
        group: "reservations",
        summary: "予約を保存する",
      },
    ],
    next_number: 2,
  };
}

// Phase-17-5:追記
// makeFunctionList の処理1件に対応する、段階2の処理概要表(DFD を描くグループは既定で無し。テスト専用)。
export function makeDataFlow(dfdGroups: string[] = []): DataFlowModel {
  return {
    dfd_groups: dfdGroups,
    summaries: [
      { function_id: "F-01", input: "予約の内容", process: "重複を確かめて保存する", output: "予約" },
    ],
  };
}

// Phase-18-5:追記
// makeFunctionList の F-01 が reservations に書く、段階3の CRUD 図(セル1つ。テスト専用)。
export function makeCrud(ops = "C", draft = false): CrudModel {
  return { cells: [{ function_id: "F-01", table: "reservations", ops, draft }] };
}

// Phase-19-5:追記
// makeFunctionList の F-01 に関わる、段階4のモジュール一覧(行1つ。テスト専用)。
export function makeModuleList(layer = "api"): ModuleListModel {
  return {
    modules: [
      {
        path: "app/api/routes/reservations.py",
        layer,
        responsibility: "予約の API",
        depends_on: [],
        functions: ["F-01"],
        all_functions: false,
      },
    ],
  };
}

// Phase-20-4:追記
// 手順の行(既定は利用者 → ルーター。テスト専用)。
export function makeStep(patch: Partial<ProcedureStep> = {}): ProcedureStep {
  return {
    caller: "利用者",
    callee: "app/api/routes/reservations.py",
    call: "create_reservation",
    data: "予約リクエスト",
    action: "本文を検証する",
    result: "予約",
    db: "reservations C",
    branch: "1a へ",
    is_branch: false,
    ...patch,
  };
}

// 分岐の行(テスト専用)。
export function makeBranch(action = "本文が不正", branch = "422"): ProcedureStep {
  return makeStep({ caller: "", callee: "", call: "", data: "", result: "", db: "", action, branch, is_branch: true });
}

// makeFunctionList の F-01 の手順(手順1つと分岐1つ。段階5の検証を通る。テスト専用)。
export function makeProcedures(): ProcedureModel {
  return {
    procedures: [
      { function_id: "F-01", reason: "検証", note: "", steps: [makeStep(), makeBranch()] },
    ],
  };
}

// Phase-21-4:追記
// makeProcedures の手順 F-01#1 が呼ぶ関数1つの詳細(段階6の検証を通る。テスト専用)。
export function makeLogic(patch: Partial<LogicRow> = {}): LogicRow {
  return {
    module: "app/api/routes/reservations.py",
    function: "create_reservation",
    signature: "async def create_reservation(payload) -> Reservation",
    args: "payload: 予約リクエスト",
    returns: "保存済みの予約",
    raises: "ValidationError(422)",
    pre: "利用者は認証済み",
    post: "予約が1件増える",
    pseudo: [{ text: "本文を検証する", sub: ["不正なら 422"] }],
    ...patch,
  };
}

export function makeLogics(): LogicModel {
  return { logics: [makeLogic()] };
}

// ── ここから Phase-15-7 の作成分 ──
// 段階1〜7の一覧の雛形。overrides で段階ごとに上書きする(テスト専用)。
export function makeStages(
  overrides: Partial<Record<number, Partial<DesignStageRead>>> = {},
) {
  return [1, 2, 3, 4, 5, 6, 7].map((stage): DesignStageRead => ({
    stage,
    state: "not_started",
    is_open: stage === 1,
    missing_inputs: stage === 1 ? [] : [`stage:${stage - 1}`],
    version: null,
    approved_version: null,
    model: null,
    updated_at: null,
    // Phase-16-5:追記
    generation_status: null,
    generation_error: null,
    issues: [],
    // Phase-18-5:追記
    dfd_accesses: [],
    ...overrides[stage],
  }));
}
