// 作成：Phase-88-2
import type {
  BaselineItemRead,
  BaselineRead,
  BaselineSummaryRead,
} from "@/features/baselines/api/types";

// 合意済みの版(束)の画面のテストで使う応答(devex-api の形。必要な項目だけ上書きする)。

const STAGE_ITEMS: BaselineItemRead[] = Array.from({ length: 8 }, (_, i) => ({
  key: `stage:${i + 1}`,
  included: i < 6,
  state: i < 5 ? "approved" : i === 5 ? "outdated" : "not_started",
  source_version: i < 6 ? 2 : null,
  generated_model: null,
  content: null,
  model: i < 6 ? { stage: i + 1 } : null,
}));

export function makeBaseline(overrides: Partial<BaselineRead> = {}): BaselineRead {
  return {
    number: 1,
    label: "B-1",
    counterpart: "山田(発注者)",
    agreed_at: "2026-10-19T01:00:00Z",
    memo: "定例で確認",
    reason: "初版の合意",
    recorded_by: "u1",
    created_at: "2026-10-19T01:05:00Z",
    items: [
      {
        key: "requirements",
        included: true,
        state: "present",
        source_version: 3,
        generated_model: "gemini-3.5-flash-lite",
        content: "# 要件定義書\n\n- FR-001 ログイン",
        model: null,
      },
      {
        key: "external_design",
        included: true,
        state: "present",
        source_version: 2,
        generated_model: null,
        content: "# 外部設計書",
        model: null,
      },
      { key: "test_spec", included: false, state: "absent", source_version: null, generated_model: null, content: null, model: null },
      ...STAGE_ITEMS,
    ],
    ...overrides,
  };
}

// 一覧の1件(写しの中身を落とす)
export function makeBaselineSummary(overrides: Partial<BaselineSummaryRead> = {}): BaselineSummaryRead {
  const { items, ...record } = makeBaseline();
  return {
    ...record,
    items: items.map((item) => ({
      key: item.key,
      included: item.included,
      state: item.state,
      source_version: item.source_version,
      generated_model: item.generated_model,
    })),
    ...overrides,
  };
}
