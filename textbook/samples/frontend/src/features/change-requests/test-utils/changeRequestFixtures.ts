// 作成：Phase-87-1｜更新：Phase-88-2,98-2
import type {
  ChangeRequestComparisonRead,
  // Phase-88-2:追記
  ChangeRequestExplanationRead,
  ChangeRequestImpactRead,
  ChangeRequestRead,
  ChangeRequestTraceRead,
  ChangeRequestVerificationRead,
  // Phase-88-2:追記
  ExplanationSummaryRead,
} from "@/features/change-requests/api/types";

// 変更要求(CR)の画面のテストで使う応答(devex-api の形。必要な項目だけ上書きする)。

export function makeChangeRequest(overrides: Partial<ChangeRequestRead> = {}): ChangeRequestRead {
  return {
    number: 1,
    label: "CR-1",
    title: "参考資料を5件まで",
    status: "draft",
    status_label: "下書き",
    background_source: "meeting",
    background_source_label: "打ち合わせ",
    background_date: "2026-10-19",
    targets: [
      { requirement_id: "FR-005", kind: "content", kind_label: "内容の変更", proposed_text: "5件まで添付できる" },
    ],
    adds_requirement: false,
    // Phase-98-2:追記
    origins: [],
    baseline_number: 1,
    baseline_label: "B-1",
    created_by: "u1",
    created_at: "2026-10-19T01:00:00Z",
    updated_at: "2026-10-19T01:00:00Z",
    content: "参考資料の上限を3件から5件にする",
    background_memo: "定例で依頼",
    decision: null,
    reviews: [],
    included_baseline_number: null,
    overlapping: [],
    derived_from_number: null,
    derived_numbers: [],
    allowed_actions: ["edit", "explain", "withdraw"],
    ...overrides,
  };
}

export function makeImpact(overrides: Partial<ChangeRequestImpactRead> = {}): ChangeRequestImpactRead {
  return {
    number: 1,
    label: "CR-1",
    baseline_number: 1,
    baseline_label: "B-1",
    saved: false,
    targets: [{ requirement_id: "FR-005", kind: "content", kind_label: "内容の変更", text: "3件まで添付できる" }],
    items: [
      {
        key: "SCR-004",
        kind: "screen",
        stage: 0,
        label: "SCR-004 チャットヒアリング画面",
        path: ["FR-005", "SCR-004"],
        reason: "FR-005 を持つ画面",
        requirement_ids: ["FR-005"],
        // Phase-98-2:追記
        origin_keys: [],
      },
      {
        key: "F-02",
        kind: "function",
        stage: 1,
        label: "F-02 資料の添付",
        path: ["FR-005", "F-02"],
        reason: "FR-005 を実現する処理",
        requirement_ids: ["FR-005"],
        // Phase-98-2:追記
        origin_keys: [],
      },
    ],
    unpredicted_new_requirement: false,
    excluded: [],
    // Phase-98-2:追記
    origins: [],
    ...overrides,
  };
}

export function makeComparison(overrides: Partial<ChangeRequestComparisonRead> = {}): ChangeRequestComparisonRead {
  return {
    number: 1,
    label: "CR-1",
    status: "applied",
    saved: true,
    counts: { matched: 1, predicted_only: 1, actual_only: 1 },
    items: [
      {
        key: "F-02",
        label: "F-02 資料の添付",
        stage: 1,
        status: "matched",
        status_label: "一致",
        predicted_only_reason: null,
        predicted_only_reason_label: null,
        predicted_reason: "FR-005 を実現する処理",
        actual_reason: "要件定義書の差分",
        requirement_ids: ["FR-005"],
        reviewed: false,
      },
      {
        key: "SCR-004",
        label: "SCR-004 チャットヒアリング画面",
        stage: 0,
        status: "predicted_only",
        status_label: "予測だけ",
        predicted_only_reason: "document_side",
        predicted_only_reason_label: "文書の側(印が付かない)",
        predicted_reason: "FR-005 を持つ画面",
        actual_reason: "",
        requirement_ids: ["FR-005"],
        reviewed: null,
      },
      {
        key: "T-03",
        label: "T-03 uploads",
        stage: 3,
        status: "actual_only",
        status_label: "実際だけ(予測の外)",
        predicted_only_reason: null,
        predicted_only_reason_label: null,
        predicted_reason: "",
        actual_reason: "外部設計書の差分",
        requirement_ids: [],
        reviewed: false,
      },
    ],
    ...overrides,
  };
}

export function makeVerification(
  overrides: Partial<ChangeRequestVerificationRead> = {},
): ChangeRequestVerificationRead {
  return {
    number: 1,
    label: "CR-1",
    status: "applied",
    can_verify: false,
    open_marks: 1,
    open_documents: 1,
    marks: [
      {
        key: "F-02",
        label: "F-02 資料の添付",
        stage: 1,
        reason: "要件定義書の差分",
        confirmation: "open",
        confirmation_label: "未確認",
      },
      {
        key: "T-03",
        label: "T-03 uploads",
        stage: 3,
        reason: "外部設計書の差分",
        confirmation: "approved",
        confirmation_label: "承認で済んだ",
      },
    ],
    documents: [{ key: "SCR-004", label: "SCR-004 チャットヒアリング画面", reason: "FR-005 を持つ画面", reviewed: false }],
    // Phase-98-2:追記
    pending_stages: [],
    ...overrides,
  };
}

export function makeTrace(overrides: Partial<ChangeRequestTraceRead> = {}): ChangeRequestTraceRead {
  return {
    number: 1,
    label: "CR-1",
    status: "verified",
    baseline_number: 1,
    included_baseline_number: 2,
    entries: [
      {
        position: 1,
        action: "create",
        action_label: "作成",
        from_status: null,
        to_status: "draft",
        occurred_at: "2026-10-19T01:00:00Z",
        actor_id: "u1",
        note: "",
        model: null,
        documents: [],
        stage: null,
        reviews: [],
        baseline_number: null,
        // Phase-98-2:追記
        edited_fields: [],
        mark_count: null,
      },
      {
        position: 2,
        action: "apply",
        action_label: "反映",
        from_status: "agreed",
        to_status: "applied",
        occurred_at: "2026-10-19T02:00:00Z",
        actor_id: "u1",
        note: "",
        model: "gemini-2.5-flash",
        documents: [
          { doc_type: "requirements", label: "要件定義書", version: 3, available: true },
          { doc_type: "external_design", label: "外部設計書", version: 2, available: false },
        ],
        stage: null,
        reviews: [],
        baseline_number: null,
        // Phase-98-2:追記
        edited_fields: [],
        mark_count: null,
      },
      {
        position: 3,
        action: "verify",
        action_label: "検証",
        from_status: "applied",
        to_status: "verified",
        occurred_at: "2026-10-19T03:00:00Z",
        actor_id: "u1",
        note: "確かめた",
        model: null,
        documents: [],
        stage: null,
        reviews: [
          { review_run_id: "r1", gate: "stage6", model: "claude-sonnet", status: "succeeded", findings: 4, adopted: 2 },
        ],
        baseline_number: null,
        // Phase-98-2:追記
        edited_fields: [],
        mark_count: null,
      },
      {
        position: 4,
        action: "baseline",
        action_label: "合意済みの版に入れた",
        from_status: "verified",
        to_status: "verified",
        occurred_at: "2026-10-19T04:00:00Z",
        actor_id: "u1",
        note: "",
        model: null,
        documents: [],
        stage: null,
        reviews: [],
        baseline_number: 2,
        // Phase-98-2:追記
        edited_fields: [],
        mark_count: null,
      },
    ],
    ...overrides,
  };
}

// Phase-88-2:追記
export function makeSummary(overrides: Partial<ExplanationSummaryRead> = {}): ExplanationSummaryRead {
  return {
    text: "FR-005 の参考資料を3件から5件にします。影響は7件です。",
    generated_text: "FR-005 の参考資料を3件から5件にします。影響は7件です。",
    edited: false,
    state: "unconfirmed",
    state_label: "未確認",
    generated_model: "gemini-3.5-flash-lite",
    generated_by: "u1",
    generated_at: "2026-10-20T01:00:00Z",
    edited_at: null,
    confirmed_by: null,
    confirmed_at: null,
    unknown_requirement_ids: [],
    unknown_numbers: ["7"],
    ...overrides,
  };
}

export function makeExplanation(
  overrides: Partial<ChangeRequestExplanationRead> = {},
): ChangeRequestExplanationRead {
  const markdown = "# CR-1 変更の説明書\n\n## 1. CR の内容と背景\n\n参考資料の上限を3件から5件にする\n";
  return {
    number: 1,
    label: "CR-1",
    filename: "cr-1-explanation.md",
    markdown,
    fingerprint: "f1",
    output: markdown,
    units: ["M-01-T02"],
    integration_tests: ["IT-01"],
    system_tests: [],
    has_test_spec: true,
    summary: null,
    ...overrides,
  };
}
