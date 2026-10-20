// 作成：Phase-88-2
// 合意済みの版(束)の API の型。devex-api app/schemas/baseline.py の同名のクラスに対応する
// (画面で使う項目だけ)。

// 写し1件の要約。key は "requirements" / "external_design" / "test_spec" / "stage:<n>"。
// state は文書なら "present" / "absent"、段階なら作った時点の段階の状態(未承認なら included が偽)
export type BaselineItemSummaryRead = {
  key: string;
  included: boolean;
  state: string;
  source_version: number | null;
  generated_model: string | null;
};

// 写し1件(中身つき)。文書は content(md)、段階は model(承認の写し)
export type BaselineItemRead = BaselineItemSummaryRead & {
  content: string | null;
  model: Record<string, unknown> | null;
};

type BaselineRecordRead = {
  number: number;
  label: string;
  counterpart: string | null;
  agreed_at: string;
  memo: string;
  reason: string;
  recorded_by: string | null;
  created_at: string;
};

// 一覧の1件(写しは要約だけ)
export type BaselineSummaryRead = BaselineRecordRead & { items: BaselineItemSummaryRead[] };

// 束の中身(写しの中身つき)
export type BaselineRead = BaselineRecordRead & { items: BaselineItemRead[] };

// 束の要件定義書の写しにある要件1行(CR の対象を選ぶ)
export type BaselineRequirementRead = {
  id: string;
  kind: string;
  priority: string | null;
  category: string;
  text: string;
};

// 束の作成(合意の記録と、入れる検証済みの CR の番号。相手は空でもよい。日時はタイムゾーン付き)
export type BaselineCreate = {
  agreed_at: string;
  counterpart: string | null;
  memo: string;
  reason: string;
  change_request_numbers: number[];
};
