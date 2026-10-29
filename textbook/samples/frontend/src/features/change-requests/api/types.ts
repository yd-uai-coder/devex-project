// 作成：Phase-87-1｜更新：Phase-88-2,98-2,107-1,107-2,107-3,107-4,107-5,112-2,112-4,116-4
// Phase-116-4:追記 ── @/features/baselines/api/types.BaselineFreshnessRead
import type { BaselineFreshnessRead } from "@/features/baselines/api/types";

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
// Phase-107-5：更新
// // (CR で作り直した段階を承認して印を結んだ)
// ↓↓
// (CR で作り直した段階を承認して印を結んだ)。share・unshare・extend_share・comment・reply_comment も
// 記録だけの行(共有リンクの作成・取り消し・期限の延長、クライアントのコメントと開発者の返信)
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
  // Phase-107-5：更新
  // | "approve_stage";
  // ↓↓
  | "approve_stage"
  | "share"
  | "unshare"
  | "extend_share"
  | "comment"
  | "reply_comment";

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

// Phase-107-2:追記
// 選択肢(案)。案は0件か2〜3件で、案ごとに名前・この案で変える対象(CR の対象のうち。対象ごとに種類と
// 変更後の案)・結果。おすすめは案の番号(1始まり)と理由。案を消すときは items を空で送る
export type ChangeRequestOptionIn = {
  name: string;
  targets: ChangeRequestTargetIn[];
  outcome: string;
};

export type ChangeRequestOptionsIn = {
  items: ChangeRequestOptionIn[];
  recommended: number | null;
  reason: string;
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

// Phase-107-2:追記
// option は合意で選んだ案の番号、source は出どころ(developer = 開発者が記録 / share_link = 共有リンク。
// 記録を足す前の判断は null)、fingerprint は判断したときの説明書の版
export type ChangeRequestDecisionRead = {
  counterpart: string | null;
  decided_at: string;
  memo: string;
  reason: string;
  recorded_by: string | null;
  // Phase-107-2:追記
  option: number | null;
  source: string | null;
  source_label: string | null;
  fingerprint: string | null;
};

export type ChangeRequestOptionRead = {
  number: number;
  label: string;
  name: string;
  targets: ChangeRequestTargetRead[];
  outcome: string;
  recommended: boolean;
};

export type ChangeRequestOptionsRead = {
  items: ChangeRequestOptionRead[];
  recommended: number | null;
  reason: string;
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

// Phase-112-4:追記
// 重なる CR の競合: 対象の要件が、基準の束の後にほかの CR の反映で変わった(by は変えた CR。変えた順)。
// current_text は今の合意の文(消えていれば null)、checked は今の文と見比べて確かめたか
export type ChangeRequestConflictRead = {
  requirement_id: string;
  by_numbers: number[];
  by: string[];
  base_text: string;
  current_text: string | null;
  checked: boolean;
};

export type ChangeRequestRead = ChangeRequestSummaryRead & {
  content: string;
  background_memo: string;
  // Phase-107-2:追記
  // 選択肢(案の無い CR は null)
  options: ChangeRequestOptionsRead | null;
  // Phase-88-2：削除
  // decision: ChangeRequestDecisionRead | null;
  reviews: LinkedReviewRead[];
  // Phase-88-2：削除
  // included_baseline_number: number | null;
  overlapping: ChangeRequestOverlapRead[];
  derived_from_number: number | null;
  derived_numbers: number[];
  allowed_actions: ChangeRequestAction[];
  // Phase-112-4:追記
  // 基準の束の後に、ほかの CR の反映で変わった対象の要件(未確認があると文書へ反映できない)
  conflicts: ChangeRequestConflictRead[];
  // Phase-116-4:追記
  // 基準の束の鮮度(束の後にほかの CR を反映した・古い段階から数えた、なら古い。この CR 自身の反映は除く)
  baseline_freshness: BaselineFreshnessRead | null;
};

// Phase-107-2：更新
// // 合意・却下の記録(相手は空でもよい。日時はタイムゾーン付き)
// ↓↓
// 合意・却下の記録(相手は空でもよい。日時はタイムゾーン付き)。案のある CR の合意では、選んだ案の番号が要る
export type ChangeRequestDecision = {
  decision: "agreed" | "rejected";
  decided_at: string;
  counterpart: string | null;
  memo: string;
  reason: string;
  // Phase-107-2:追記
  option?: number | null;
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

// Phase-107-1:追記
// 規模の予測と実際(basis = marks は反映で付いた印から数えた、document_checks は文書の側の確認の一覧で
// 確かめた数)。数えられなければ null
export type ScaleComparisonRead = {
  kind: ScaleKind;
  label: string;
  predicted: number | null;
  actual: number | null;
  basis: "marks" | "document_checks";
};

// Phase-112-2:追記
// 反映の前 → 後(文書の要素ごと。システムが要素のキーで比べたもの)。change は変更 / 追加 / 削除 /
// 合意の形に戻した(範囲の外で LLM が書き換えたのを戻した)、scope は CR の対象 / 予測した要素 / 範囲の外
export type ReflectionChangeKind = "changed" | "added" | "removed" | "restored";
export type ReflectionScope = "target" | "predicted" | "outside";

export type FieldChangeRead = {
  name: string;
  label: string;
  before: string;
  after: string;
};

export type ReflectionChangeRead = {
  key: string;
  kind: string;
  label: string;
  change: ReflectionChangeKind;
  change_label: string;
  scope: ReflectionScope;
  scope_label: string;
  fields: FieldChangeRead[];
  restore_reason: string | null;
};

// 文書への反映1回。recorded = false は前 → 後を残す前の反映(changes は空)
export type AppliedReflectionRead = {
  occurred_at: string;
  documents: string[];
  recorded: boolean;
  changes: ReflectionChangeRead[];
};

export type ChangeRequestComparisonRead = {
  number: number;
  label: string;
  status: ChangeRequestStatus;
  saved: boolean;
  counts: Record<ComparisonStatus, number>;
  items: ComparedItemRead[];
  // Phase-107-1:追記
  scale: ScaleComparisonRead[];
  // Phase-112-2:追記
  // 文書への反映ごとの前 → 後(新しい順)
  reflections: AppliedReflectionRead[];
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
  // Phase-107-4:追記
  // 確認済みのまま、その後の説明書の変化で古くなった(共有の前に確かめ直す)
  needs_reconfirm: boolean;
};

// Phase-107-1:追記
// 変更の規模(説明書の規模の節)。種類ごとの数(数えられなければ null で、uncountable に理由)・
// 数えたものの表示名・数えたうえでの注記。detail は対象の段階・文書・要件 ID・単位
export type ScaleKind = "unit" | "file" | "test" | "screen" | "api";
// Phase-116-4:追記
// counted(数えた) / stale(古い段階・束の後の CR の注記つきで数えた。少ない・違うことがある) / uncountable(数えられない)
export type ScaleState = "counted" | "stale" | "uncountable";

export type ScaleRemarkRead = {
  code: string;
  label: string;
  detail: string;
};

export type ScaleCountRead = {
  kind: ScaleKind;
  label: string;
  count: number | null;
  // Phase-116-4:追記
  state: ScaleState;
  names: string[];
  uncountable: ScaleRemarkRead[];
  notes: ScaleRemarkRead[];
};

// 合意の前の案1つの規模(案のある CR の規模の表の1列)
export type OptionScaleRead = {
  number: number;
  label: string;
  name: string;
  recommended: boolean;
  scale: ScaleCountRead[];
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
  // Phase-107-1:追記
  // 規模(案のある CR では案を合わせた範囲)と、合意の前の案ごとの規模(案の無い CR・案を選んだ後は空)
  scale: ScaleCountRead[];
  option_scales: OptionScaleRead[];
  units: string[];
  integration_tests: string[];
  system_tests: string[];
  has_test_spec: boolean;
  summary: ExplanationSummaryRead | null;
  // Phase-116-4:追記
  // 規模を数えた基準の束の鮮度
  baseline_freshness: BaselineFreshnessRead | null;
};

// Phase-107-3:追記
// 選択肢の LLM の下書き(GET .../options/draft)。options は LLM が作った案(規則に合わないこともある)、
// stale は作った後に説明書が変わったか。problems は取り込めない問題、unknown_* は文に出る要件 ID・数字のうち
// 説明書に無いもの(取り込みは止めない)。adoptable が真なら取り込める
export type OptionDraftStatus = "unconfirmed" | "adopted";

export type OptionDraftRead = {
  options: ChangeRequestOptionsRead;
  status: OptionDraftStatus;
  status_label: string;
  stale: boolean;
  generated_model: string | null;
  generated_by: string | null;
  generated_at: string;
  adopted_by: string | null;
  adopted_at: string | null;
  problems: string[];
  unknown_requirement_ids: string[];
  unknown_numbers: string[];
  adoptable: boolean;
};

// Phase-107-4:追記
// 共有リンク(GET .../share-links。トークンは含めない)。state は今の状態(取り消し > 期限切れ > CR の状態)
export type ShareState = "open" | "paused" | "decided" | "closed" | "expired" | "revoked";

export type ShareLinkRead = {
  id: string;
  state: ShareState;
  state_label: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_viewed_at: string | null;
};

// 作った共有リンク。token と path(クライアントの画面のパス)はこの応答でだけ返る
export type ShareLinkCreatedRead = ShareLinkRead & {
  token: string;
  path: string;
  summary_needs_reconfirm: boolean;
  // Phase-116-4:追記
  // 説明書の規模を数えた基準の束の鮮度(古ければ知らせる)
  baseline_freshness: BaselineFreshnessRead | null;
};

// Phase-107-5:追記
// CR のコメント欄(GET .../comments)。クライアントのコメントごとに開発者の返信をまとめる(1段)。
// author_name はクライアントが書いた名前(返信は空)、fingerprint は書いたときに見ていた説明書の版
export type ChangeRequestCommentRead = {
  id: string;
  from_developer: boolean;
  author_name: string;
  author_id: string | null;
  body: string;
  fingerprint: string;
  created_at: string;
  can_reply: boolean;
  replies: ChangeRequestCommentRead[];
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
