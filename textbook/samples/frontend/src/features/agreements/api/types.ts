// 作成：Phase-97-2
// 行の合意の API の型。devex-api app/schemas/agreement.py の同名のクラスに対応する
// (画面で使う項目だけ)。

export type AgreementDocType = "requirements" | "external_design";
export type AgreedKind = "requirement" | "users" | "screen" | "api" | "integration";
// agreed: 合意と同じ / differs: 合意と違う / unagreed: 合意の記録が無い / missing: 合意済みだが表示中の版に無い
export type ElementState = "agreed" | "differs" | "unagreed" | "missing";
export type RestoreReason = "changed" | "dropped";

// 表示中の版の要素1つの合意の状態。出どころの欄は、合意の記録がある要素(unagreed 以外)だけ
export type ElementStatusRead = {
  key: string;
  kind: AgreedKind;
  label: string;
  state: ElementState;
  state_label: string;
  origin_label: string | null;
  baseline_number: number | null;
  change_request_number: number | null;
};

export type RestoredElementRead = {
  key: string;
  label: string;
  reason: RestoreReason;
  reason_label: string;
};

// 文書1つの表示中の版の合意の状態。version は文書が無ければ null、change_request_number は版が反映した CR
export type AgreementStatusRead = {
  doc_type: AgreementDocType;
  version: number | null;
  change_request_number: number | null;
  elements: ElementStatusRead[];
  restored: RestoredElementRead[];
};

// 要素の履歴の1行。合意の記録の行は origin_label〜content を、戻しの行(restored)は doc_label〜を持つ
export type HistoryEntryRead = {
  event: "agreed" | "changed" | "reaffirmed" | "removed" | "restored";
  event_label: string;
  occurred_at: string;
  origin_label: string | null;
  label: string | null;
  doc_type: string | null;
  doc_label: string | null;
  version: number | null;
  restore_reason_label: string | null;
  change_request_number: number | null;
};

// 要素に関わる CR 1つ(対象の要件として、または保存した予測に入って)
export type RelatedChangeRequestRead = {
  number: number;
  title: string;
  status: string;
  status_label: string;
  target_kind_label: string | null;
  predicted: boolean;
};

export type AgreementHistoryRead = {
  key: string;
  label: string;
  current: Record<string, unknown> | null;
  entries: HistoryEntryRead[];
  change_requests: RelatedChangeRequestRead[];
};
