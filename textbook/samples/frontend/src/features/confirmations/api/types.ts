// 作成：Phase-98-1
// 確認事項の一覧の API の型。devex-api app/schemas/confirmation.py の同名のクラスに対応する。

export type ConfirmationKind = "requirement" | "user" | "point";
export type ConfirmationStatus = "unconfirmed" | "confirmed" | "rejected";
export type Opportunity = "next_meeting" | "email" | "implementation" | "none";

// 確認事項1件。present は今の一覧にあるか(false は、状態を決めた後に一覧から消えた項目。採用にして
// 推測でなくなった行など)。refs は観点に頼っている要件の ID(1.2 は "1.2")
export type ConfirmationItemRead = {
  key: string;
  kind: ConfirmationKind;
  label: string;
  refs: string[];
  present: boolean;
  status: ConfirmationStatus;
  status_label: string;
  opportunity: Opportunity | null;
  opportunity_label: string | null;
  memo: string;
  updated_at: string | null;
};

// 推測の採用率。rate は 確認済み ÷(確認済み + 却下)で、分母が0なら null
export type AdoptionRead = {
  confirmed: number;
  rejected: number;
  unconfirmed: number;
  rate: number | null;
};

export type ConfirmationListRead = {
  items: ConfirmationItemRead[];
  adoption: AdoptionRead;
};

// 1件の部分更新(送った欄だけ変える)。決める機会は null で未設定に戻せる
export type ConfirmationUpdate = {
  opportunity?: Opportunity | null;
  status?: ConfirmationStatus;
  memo?: string;
};
