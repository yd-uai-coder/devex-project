// 作成：Phase-87-1｜更新：Phase-88-2,98-2,107-1,107-2,107-3,107-4,107-5,112-2,112-4,116-4
  // Phase-88-2:追記
  // Phase-88-2:追記
// Phase-107-1:追記 ── @/features/change-requests/api/types.ScaleCountRead
// Phase-107-2:追記 ── @/features/change-requests/api/types.ChangeRequestOptionsRead
// Phase-107-3:追記 ── @/features/change-requests/api/types.OptionDraftRead
// Phase-107-4:追記 ── @/features/change-requests/api/types.ShareLinkCreatedRead, @/features/change-requests/api/types.ShareLinkRead
// Phase-107-5:追記 ── @/features/change-requests/api/types.ChangeRequestCommentRead
// Phase-112-2:追記 ── @/features/change-requests/api/types.AppliedReflectionRead
// Phase-112-4:追記 ── @/features/change-requests/api/types.ChangeRequestConflictRead
import type {
  AppliedReflectionRead,
  ChangeRequestCommentRead,
  ChangeRequestComparisonRead,
  ChangeRequestConflictRead,
  ChangeRequestExplanationRead,
  ChangeRequestImpactRead,
  ChangeRequestOptionsRead,
  ChangeRequestRead,
  ChangeRequestTraceRead,
  ChangeRequestVerificationRead,
  ExplanationSummaryRead,
  OptionDraftRead,
  ScaleCountRead,
  ShareLinkCreatedRead,
  ShareLinkRead,
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
    // Phase-107-2:追記
    options: null,
    decision: null,
    reviews: [],
    included_baseline_number: null,
    overlapping: [],
    derived_from_number: null,
    derived_numbers: [],
    allowed_actions: ["edit", "explain", "withdraw"],
    // Phase-112-4:追記
    conflicts: [],
    // Phase-116-4:追記
    baseline_freshness: null,
    ...overrides,
  };
}

// 重なる CR の競合1つ(FR-005 を CR-2 が先に変えた。未確認)
export function makeConflict(overrides: Partial<ChangeRequestConflictRead> = {}): ChangeRequestConflictRead {
  return {
    requirement_id: "FR-005",
    by_numbers: [2],
    by: ["CR-2"],
    base_text: "3件まで添付できる",
    current_text: "4件まで添付できる",
    checked: false,
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
    // Phase-107-1:追記
    scale: [],
    // Phase-112-2:追記
    reflections: [],
    ...overrides,
  };
}

// 文書への反映1回の前 → 後(CR の対象の要件の文の変更・範囲の外の画面・合意の形に戻した要件)
export function makeReflection(overrides: Partial<AppliedReflectionRead> = {}): AppliedReflectionRead {
  return {
    occurred_at: "2026-10-26T10:00:00+09:00",
    documents: ["要件定義書 v3", "外部設計書 v3"],
    recorded: true,
    changes: [
      {
        key: "req:FR-005",
        kind: "requirement",
        label: "FR-005 資料を添付できる",
        change: "changed",
        change_label: "変更",
        scope: "target",
        scope_label: "CR の対象",
        fields: [{ name: "text", label: "内容", before: "3件まで添付できる", after: "5件まで添付できる" }],
        restore_reason: null,
      },
      {
        key: "screen:SCR-004",
        kind: "screen",
        label: "SCR-004 チャットヒアリング画面",
        change: "changed",
        change_label: "変更",
        scope: "outside",
        scope_label: "範囲の外",
        fields: [{ name: "ui_spec", label: "画面の仕様", before: "添付は3件", after: "添付は5件" }],
        restore_reason: null,
      },
      {
        key: "req:FR-002",
        kind: "requirement",
        label: "FR-002 チャットで聞く",
        change: "restored",
        change_label: "合意の形に戻した",
        scope: "outside",
        scope_label: "範囲の外",
        fields: [],
        restore_reason: "changed",
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
    // Phase-107-4:追記
    needs_reconfirm: false,
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
    // Phase-107-1:追記
    scale: makeScale(),
    option_scales: [],
    has_test_spec: true,
    summary: null,
    // Phase-116-4:追記
    baseline_freshness: null,
    ...overrides,
  };
}

// Phase-107-1:追記
// 説明書の規模(作業単位1件・ファイル2件・テスト1件・画面1件、API は数えられない)
export function makeScale(overrides: Partial<Record<ScaleCountRead["kind"], Partial<ScaleCountRead>>> = {}): ScaleCountRead[] {
  const base: ScaleCountRead[] = [
    // Phase-116-4：更新
    // { kind: "unit", label: "作業単位", count: 1, names: ["M-01-T02"], uncountable: [], notes: [] },
    // { kind: "file", label: "ファイル", count: 2, names: ["app/a.py", "app/b.py"], uncountable: [], notes: [] },
    // { kind: "test", label: "テスト", count: 1, names: ["IT-01"], uncountable: [], notes: [] },
    // { kind: "screen", label: "画面", count: 1, names: ["チャットヒアリング画面(SCR-004)"], uncountable: [], notes: [] },
    // ↓↓
    { kind: "unit", state: "counted", label: "作業単位", count: 1, names: ["M-01-T02"], uncountable: [], notes: [] },
    { kind: "file", state: "counted", label: "ファイル", count: 2, names: ["app/a.py", "app/b.py"], uncountable: [], notes: [] },
    { kind: "test", state: "counted", label: "テスト", count: 1, names: ["IT-01"], uncountable: [], notes: [] },
    { kind: "screen", state: "counted", label: "画面", count: 1, names: ["チャットヒアリング画面(SCR-004)"], uncountable: [], notes: [] },
    {
      kind: "api",
      label: "API",
      count: null,
      // Phase-116-4:追記
      state: "uncountable",
      names: [],
      uncountable: [{ code: "no_document", label: "要る文書が束に無い", detail: "外部設計書" }],
      notes: [],
    },
  ];
  return base.map((count) => ({ ...count, ...overrides[count.kind] }));
}

// Phase-107-2:追記
// 案2つの選択肢(案1 がおすすめ。どちらも FR-005 を変える)
export function makeOptions(overrides: Partial<ChangeRequestOptionsRead> = {}): ChangeRequestOptionsRead {
  return {
    items: [
      {
        number: 1,
        label: "案1",
        name: "5件まで",
        targets: [{ requirement_id: "FR-005", kind: "content", kind_label: "内容の変更", proposed_text: "5件まで添付できる" }],
        outcome: "上限の値だけを変える",
        recommended: true,
      },
      {
        number: 2,
        label: "案2",
        name: "上限なし",
        targets: [{ requirement_id: "FR-005", kind: "content", kind_label: "内容の変更", proposed_text: "何件でも添付できる" }],
        outcome: "保存の容量の見直しが要る",
        recommended: false,
      },
    ],
    recommended: 1,
    reason: "手間が小さい",
    ...overrides,
  };
}

// Phase-107-3:追記
// 取り込める未確認の下書き(案は makeOptions と同じ)
export function makeOptionDraft(overrides: Partial<OptionDraftRead> = {}): OptionDraftRead {
  return {
    options: makeOptions(),
    status: "unconfirmed",
    status_label: "未確認",
    stale: false,
    generated_model: "gemini-3.5-flash-lite",
    generated_by: "u1",
    generated_at: "2026-10-22T01:00:00Z",
    adopted_by: null,
    adopted_at: null,
    problems: [],
    unknown_requirement_ids: [],
    unknown_numbers: [],
    adoptable: true,
    ...overrides,
  };
}

// Phase-107-4:追記
export function makeShareLink(overrides: Partial<ShareLinkRead> = {}): ShareLinkRead {
  return {
    id: "l1",
    state: "open",
    state_label: "開いている",
    created_at: "2026-10-24T01:00:00Z",
    expires_at: "2026-11-07T01:00:00Z",
    revoked_at: null,
    last_viewed_at: null,
    ...overrides,
  };
}

export function makeCreatedShareLink(overrides: Partial<ShareLinkCreatedRead> = {}): ShareLinkCreatedRead {
  return {
    ...makeShareLink(),
    token: "tok123",
    path: "/share/tok123",
    summary_needs_reconfirm: false,
    // Phase-116-4:追記
    baseline_freshness: null,
    ...overrides,
  };
}

// Phase-107-5:追記
// クライアントのコメント1つ(返信なし・返信できる)
export function makeComment(overrides: Partial<ChangeRequestCommentRead> = {}): ChangeRequestCommentRead {
  return {
    id: "c1",
    from_developer: false,
    author_name: "佐藤",
    author_id: null,
    body: "矢印は3種類で足りますか",
    fingerprint: "f1",
    created_at: "2026-10-24T06:02:00Z",
    can_reply: true,
    replies: [],
    ...overrides,
  };
}
