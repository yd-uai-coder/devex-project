// 作成：Phase-87-1｜更新：Phase-88-2,98-2
// Phase-88-2：更新
// // 変更要求(CR)と合意済みの版(束)の API の型。devex-api app/schemas/change_request.py・
// // app/schemas/baseline.py の同名のクラスに対応する(画面で使う項目だけ)。
// ↓↓
// 変更要求(CR)の API の型。devex-api app/schemas/change_request.py の同名のクラスに対応する
// (画面で使う項目だけ)。合意済みの版(束)の型は features/baselines/api/types.ts。

export type ChangeRequestStatus =
  | "draft"
  | "explained"
  | "agreed"
  | "rejected"
  | "applied"
  | "verified"
  | "withdrawn";

// 時系列の操作(app/change_requests/states.py の ChangeRequestAction)。allowed_actions に出るのは
// Phase-98-2：更新
// // edit・explain・agree・reject・withdraw・apply・verify・copy
// ↓↓
// edit・explain・agree・reject・withdraw・apply・verify・copy。approve_stage は状態を変えない記録だけの行
// (CR で作り直した段階を承認して印を結んだ)
export type ChangeRequestAction =
  | "create"
  | "copy"
  | "copied"
  | "edit"
  | "explain"
  | "agree"
  | "reject"
  | "withdraw"
  | "apply"
  | "verify"
  | "link_review"
  // Phase-98-2：更新
  // | "baseline";
  // ↓↓
  | "baseline"
  | "approve_stage";

export type BackgroundSource = "meeting" | "email" | "document" | "other";
export type TargetKind = "content" | "delete";

// 作成・編集で送る対象1つ(案は削除のとき空)
export type ChangeRequestTargetIn = {
  requirement_id: string;
  kind: TargetKind;
  proposed_text: string;
};

export type ChangeRequestCreate = {
  title: string;
  content: string;
  background_source: BackgroundSource;
  background_date: string | null;
  background_memo: string;
  targets: ChangeRequestTargetIn[];
  adds_requirement: boolean;
  // Phase-98-2:追記
  // 新しい要件の予測の起点(基準の束の要件・画面・API の要素のキー)。新しい要件を足す CR だけが持てる
  origins: string[];
  baseline_number?: number;
};

// 編集(下書き・説明済みの間だけ。基準の束は変えない)
export type ChangeRequestUpdate = Omit<ChangeRequestCreate, "baseline_number">;

export type ChangeRequestTargetRead = {
  requirement_id: string;
  kind: TargetKind;
  kind_label: string;
  proposed_text: string;
};

// Phase-98-2:追記
// 新しい要件の予測の起点1つ(要素のキーと表示名)
export type ChangeRequestOriginRead = {
  key: string;
  label: string;
};

export type ChangeRequestSummaryRead = {
  number: number;
  label: string;
  title: string;
  status: ChangeRequestStatus;
  status_label: string;
  background_source: BackgroundSource;
  background_source_label: string;
  background_date: string | null;
  targets: ChangeRequestTargetRead[];
  adds_requirement: boolean;
  // Phase-98-2:追記
  origins: ChangeRequestOriginRead[];
  baseline_number: number;
  baseline_label: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Phase-88-2:追記
  // 合意・却下の記録と、入れた束(検証済みの後)。束の作成で、入れる CR と合意の記録の初期値に使う
  decision: ChangeRequestDecisionRead | null;
  included_baseline_number: number | null;
};

export type ChangeRequestDecisionRead = {
  counterpart: string | null;
  decided_at: string;
  memo: string;
  reason: string;
  recorded_by: string | null;
};

export type ReviewRunBriefRead = {
  review_run_id: string;
  gate: string;
  model: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  findings: number;
  adopted: number;
};

export type LinkedReviewRead = ReviewRunBriefRead & {
  linked_at: string;
  linked_by: string | null;
};

export type ChangeRequestOverlapRead = {
  number: number;
  label: string;
  requirement_ids: string[];
};

export type ChangeRequestRead = ChangeRequestSummaryRead & {
  content: string;
  background_memo: string;
  // Phase-88-2：削除
  // decision: ChangeRequestDecisionRead | null;
  reviews: LinkedReviewRead[];
  // Phase-88-2：削除
  // included_baseline_number: number | null;
  overlapping: ChangeRequestOverlapRead[];
  derived_from_number: number | null;
  derived_numbers: number[];
  allowed_actions: ChangeRequestAction[];
};

// 合意・却下の記録(相手は空でもよい。日時はタイムゾーン付き)
export type ChangeRequestDecision = {
  decision: "agreed" | "rejected";
  decided_at: string;
  counterpart: string | null;
  memo: string;
  reason: string;
};

// 予測(GET .../impact)
export type PredictedTargetRead = {
  requirement_id: string;
  kind: TargetKind;
  kind_label: string;
  text: string;
};

export type PredictedItemRead = {
  key: string;
  kind: string;
  stage: number;
  label: string;
  path: string[];
  reason: string;
  requirement_ids: string[];
  // Phase-98-2:追記
  // 届いた新しい要件の起点のキー
  origin_keys: string[];
};

export type ChangeRequestImpactRead = {
  number: number;
  label: string;
  baseline_number: number;
  baseline_label: string;
  saved: boolean;
  targets: PredictedTargetRead[];
  items: PredictedItemRead[];
  unpredicted_new_requirement: boolean;
  excluded: { key: string; state: string }[];
  // Phase-98-2:追記
  // 予測に使った新しい要件の起点
  origins: ChangeRequestOriginRead[];
};

// 比較(GET .../comparison。反映の後だけ)
export type ComparisonStatus = "matched" | "predicted_only" | "actual_only";

export type ComparedItemRead = {
  key: string;
  label: string;
  stage: number;
  status: ComparisonStatus;
  status_label: string;
  predicted_only_reason: string | null;
  predicted_only_reason_label: string | null;
  predicted_reason: string;
  actual_reason: string;
  requirement_ids: string[];
  reviewed: boolean | null;
};

export type ChangeRequestComparisonRead = {
  number: number;
  label: string;
  status: ChangeRequestStatus;
  saved: boolean;
  counts: Record<ComparisonStatus, number>;
  items: ComparedItemRead[];
};

// 検証(GET .../verification)
export type MarkConfirmation = "open" | "reviewed" | "approved";

export type MarkStateRead = {
  key: string;
  label: string;
  stage: number;
  reason: string;
  confirmation: MarkConfirmation;
  confirmation_label: string;
};

export type DocumentItemRead = {
  key: string;
  label: string;
  reason: string;
  reviewed: boolean;
};

export type ChangeRequestVerificationRead = {
  number: number;
  label: string;
  status: ChangeRequestStatus;
  can_verify: boolean;
  open_marks: number;
  open_documents: number;
  marks: MarkStateRead[];
  documents: DocumentItemRead[];
  // Phase-98-2:追記
  // CR で作り直した後に、まだ承認していない段階(すべて承認するまで検証済みにできない)
  pending_stages: number[];
};

// たどる記録(GET .../trace)
export type TraceDocumentRead = {
  doc_type: string;
  label: string;
  version: number;
  available: boolean;
};

export type TraceReviewRead = {
  review_run_id: string;
  gate: string;
  model: string;
  status: string;
  findings: number;
  adopted: number;
};

export type TraceEntryRead = {
  position: number;
  action: ChangeRequestAction;
  action_label: string;
  from_status: string | null;
  to_status: string;
  occurred_at: string;
  actor_id: string | null;
  note: string;
  model: string | null;
  documents: TraceDocumentRead[];
  stage: { stage: number; version: number } | null;
  reviews: TraceReviewRead[];
  baseline_number: number | null;
  // Phase-98-2:追記
  // 直した(edit)の行の、直した項目の名前。ほかの行は空
  edited_fields: string[];
  // 段階の承認で印を結んだ(approve_stage)の行の、結んだ印の数。ほかの行は null
  mark_count: number | null;
};

export type ChangeRequestTraceRead = {
  number: number;
  label: string;
  status: ChangeRequestStatus;
  baseline_number: number;
  included_baseline_number: number | null;
  entries: TraceEntryRead[];
};

// Phase-88-2：更新
// // 合意済みの版(束)の一覧の1件(写しは要約だけ)
// export type BaselineSummaryRead = {
// ↓↓
// 説明書の要約(GET .../explanation の summary)。state は今の5節と比べた状態(stale = 作った・確かめた
// 後に CR の内容か影響が変わった)。generated_text は LLM の元の文、text は今の文。
// unknown_* は text に出る要件 ID・数字のうち、5節に無いもの(照合で合わない所)
export type SummaryState = "unconfirmed" | "confirmed" | "stale";

export type ExplanationSummaryRead = {
  text: string;
  generated_text: string;
  edited: boolean;
  state: SummaryState;
  state_label: string;
  generated_model: string | null;
  generated_by: string | null;
  generated_at: string;
  edited_at: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  unknown_requirement_ids: string[];
  unknown_numbers: string[];
};

// 説明書(プレビュー)。markdown は5節、output は出力する md(確認済みで古くない要約だけを載せる)
export type ChangeRequestExplanationRead = {
  number: number;
  label: string;
  // Phase-88-2：更新
  // counterpart: string | null;
  // agreed_at: string;
  // memo: string;
  // reason: string;
  // created_at: string;
  // ↓↓
  filename: string;
  markdown: string;
  fingerprint: string;
  output: string;
  units: string[];
  integration_tests: string[];
  system_tests: string[];
  has_test_spec: boolean;
  summary: ExplanationSummaryRead | null;
};
// Phase-88-2：削除
//
// // 束の要件定義書の写しにある要件1行(CR の対象を選ぶ)
// export type BaselineRequirementRead = {
//   id: string;
//   kind: string;
//   priority: string | null;
//   category: string;
//   text: string;
// };
