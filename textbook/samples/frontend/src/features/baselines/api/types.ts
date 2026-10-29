// 作成：Phase-88-2｜更新：Phase-98-2,109-2,116-1,116-4
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

// Phase-109-2:追記
// 束に入れた CR 1つ(番号と題)
export type BaselineChangeRequestRead = { number: number; title: string };

type BaselineRecordRead = {
  number: number;
  label: string;
  counterpart: string | null;
  agreed_at: string;
  memo: string;
  reason: string;
  recorded_by: string | null;
  created_at: string;
  // Phase-109-2:追記
  included_change_requests: BaselineChangeRequestRead[];
  // Phase-116-4:追記
  // 新しいか(最新の束で、束の後に反映した CR も古かった段階も無い)。古い応答では無い
  fresh?: boolean | null;
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

// Phase-98-2:追記
// 束で、新しい要件の予測の起点に選べる要素1つ(CR の起点を選ぶ)
// Phase-109-2：更新
// export type OriginKind = "requirement" | "screen" | "api";
// ↓↓
export type OriginKind = "requirement" | "screen" | "api" | "function";

export type BaselineOriginRead = {
  key: string;
  kind: OriginKind;
  label: string;
};

// Phase-116-1:追記
// 束の後に反映した CR 1つと、それが書き換えた要素のキー("req:FR-001" など)
export type BaselineAppliedAfterRead = { number: number; keys: string[] };

// 束1つの鮮度(GET .../baselines/{n}/freshness。CR の詳細・説明書・共有リンクの作成・違いの取り出しの回にも付く)。
// fresh は最新の束で、束の後に反映した CR も古かった段階も無いこと。tracked が偽なら束の後の CR を判定できない
// (合意の記録を始める前の束)
export type BaselineFreshnessRead = {
  baseline_number: number;
  label: string;
  fresh: boolean;
  is_latest: boolean;
  tracked: boolean;
  newer_numbers: number[];
  applied_after: BaselineAppliedAfterRead[];
  outdated_stages: number[];
};

// 束の作成(合意の記録と、入れる検証済みの CR の番号。相手は空でもよい。日時はタイムゾーン付き)
export type BaselineCreate = {
  agreed_at: string;
  counterpart: string | null;
  memo: string;
  reason: string;
  change_request_numbers: number[];
};
