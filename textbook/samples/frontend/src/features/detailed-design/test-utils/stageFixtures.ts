// 作成：Phase-15-7｜更新：Phase-16-5,16-6,17-5
// 写経レベル: 定型 ── テスト用の段階の雛形。
// Phase-16-6:追記 ── @/features/detailed-design/api/types.FunctionListModel
// Phase-17-5:追記 ── @/features/detailed-design/api/types.DataFlowModel
import type {
  DataFlowModel,
  DesignStageRead,
  FunctionListModel,
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
    ...overrides[stage],
  }));
}
