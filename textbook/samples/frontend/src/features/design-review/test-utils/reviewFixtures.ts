// 作成：Phase-53-3｜更新：Phase-53(完了後の調整)
import type {
  CurrentUserRead,
  ReviewFindingRead,
  ReviewGateSummaryRead,
  ReviewRunRead,
} from "@/features/design-review/api/reviewApi";

// レビューのパネル・ストアのテストで使う、API の応答の形の仮データ

export function finding(overrides: Partial<ReviewFindingRead> = {}): ReviewFindingRead {
  return {
    id: "f1",
    position: 0,
    level: "major",
    cause: "design",
    targets: ["SCR-004"],
    // Phase-53(完了後の調整):追記
    documents: ["external_design"],
    point_key: null,
    problem: "問題",
    evidence: "引用",
    reason: "理由",
    suggestion: "改善案",
    decision: "pending",
    ...overrides,
  };
}

export function run(overrides: Partial<ReviewRunRead> = {}): ReviewRunRead {
  return {
    id: "r1",
    gate: "documents",
    targets: { requirements: 1, external_design: 1 },
    trigger: "auto",
    model: "claude-sonnet-5-5",
    status: "succeeded",
    error_code: null,
    input_tokens: 10000,
    output_tokens: 4000,
    started_at: "2026-10-14T00:00:00Z",
    finished_at: "2026-10-14T00:00:40Z",
    findings: [],
    is_current: true,
    ...overrides,
  };
}

export function gate(overrides: Partial<ReviewGateSummaryRead> = {}): ReviewGateSummaryRead {
  return { gate: "documents", ready: true, status: "unreviewed", run: null, ...overrides };
}

export function user(overrides: Partial<CurrentUserRead> = {}): CurrentUserRead {
  return {
    id: "u1",
    email: "example-super-user@example.com",
    is_superuser: true,
    review_enabled: true,
    review_effective: true,
    ...overrides,
  };
}
