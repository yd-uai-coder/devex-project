// 作成：Phase-15-7
// 写経レベル: 定型 ── テスト用の段階の雛形。
import type { DesignStageRead } from "@/features/detailed-design/api/types";

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
    ...overrides[stage],
  }));
}
