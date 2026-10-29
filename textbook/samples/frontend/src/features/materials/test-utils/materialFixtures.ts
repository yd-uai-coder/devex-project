// 作成：Phase-116-1
import type { BaselineFreshnessRead } from "@/features/baselines/api/types";
import type {
  MaterialDifferenceRead,
  MaterialDifferencesRead,
  MaterialRead,
  MaterialSummaryRead,
} from "@/features/materials/api/types";

// 資料の画面のテストで使う応答(devex-api の形。必要な項目だけ上書きする)。

export function makeFreshness(overrides: Partial<BaselineFreshnessRead> = {}): BaselineFreshnessRead {
  const number = overrides.baseline_number ?? 2;
  return {
    baseline_number: number,
    label: `B-${number}`,
    fresh: true,
    is_latest: true,
    tracked: true,
    newer_numbers: [],
    applied_after: [],
    outdated_stages: [],
    ...overrides,
  };
}

export function makeMaterialSummary(overrides: Partial<MaterialSummaryRead> = {}): MaterialSummaryRead {
  return {
    id: "m1",
    kind: "minutes",
    title: "定例打ち合わせ 議事録",
    material_date: "2026-11-16",
    source: "paste",
    filename: null,
    created_by: "u1",
    created_at: "2026-11-17T01:00:00Z",
    length: 120,
    ...overrides,
  };
}

export function makeMaterial(overrides: Partial<MaterialRead> = {}): MaterialRead {
  return { ...makeMaterialSummary(), body: "# 議事録\n\n- 取得の間隔は12時間ごとのまま", ...overrides };
}

export function makeDifference(overrides: Partial<MaterialDifferenceRead> = {}): MaterialDifferenceRead {
  return {
    id: "d1",
    kind: "change",
    target_key: "req:FR-001",
    origin_key: "",
    content: "取得の間隔を6時間ごとにする",
    quote: "取得の間隔を6時間ごとにしたい",
    status: "unconfirmed",
    reasons: [],
    dismiss_reason: null,
    baseline_number: 2,
    decided_by: null,
    decided_at: null,
    created_at: "2026-11-17T01:10:00Z",
    requirement_candidates: [],
    change_request_number: null,
    ...overrides,
  };
}

export function makeDifferences(overrides: Partial<MaterialDifferencesRead> = {}): MaterialDifferencesRead {
  return {
    material_id: "m1",
    extraction: {
      baseline_number: 2,
      baseline_label: "B-2",
      freshness: makeFreshness(),
      generated_model: "gemini-3.5-flash-lite",
      generated_by: "u1",
      generated_at: "2026-11-17T01:10:00Z",
    },
    latest_baseline_number: 2,
    differences: [makeDifference()],
    ...overrides,
  };
}
