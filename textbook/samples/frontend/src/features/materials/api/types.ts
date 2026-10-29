// 作成：Phase-116-1
import type { BaselineFreshnessRead } from "@/features/baselines/api/types";

// 資料(ステージ14 の取り込み)の API の型。devex-api app/schemas/material.py・material_difference.py の
// 同名のクラスに対応する(画面で使う項目だけ)。

// 資料の種類(議事録・メール・資料)と、本文の出どころ(貼り付け・ファイルの形式)
export type MaterialKind = "minutes" | "email" | "document";
export type MaterialSource = "paste" | "txt" | "md" | "pdf";

// 資料の種類・題・日付(日付は YYYY-MM-DD)
export type MaterialMeta = {
  kind: MaterialKind;
  title: string;
  material_date: string;
};

// 本文を貼り付けて足すとき
export type MaterialCreate = MaterialMeta & { body: string };

// 資料を足す画面の入力(本文の貼り付けか、ファイル。ファイルは multipart で送る)
export type MaterialInput = { meta: MaterialMeta; body: string; file?: undefined } | { meta: MaterialMeta; file: File };

// 一覧の1件(本文なし。length は本文の文字数)
export type MaterialSummaryRead = MaterialMeta & {
  id: string;
  source: MaterialSource;
  filename: string | null;
  created_by: string | null;
  created_at: string;
  length: number;
};

// 資料1件(本文つき)
export type MaterialRead = MaterialSummaryRead & { body: string };

// 違いの種類(確かめる点は CR にせず、理由をつけて閉じる)と状態(弾いた = 検査で落ちた)
export type DifferenceKind = "add" | "change" | "delete" | "question";
export type DifferenceStatus = "unconfirmed" | "rejected" | "converted" | "dismissed";

// 違い1件。target_key は変更・削除の対象("req:FR-001" など。追加は空)、origin_key は追加の起点(任意)。
// requirement_candidates は CR の対象の候補の要件 ID(画面・API・外部連携の変更・削除のとき)、
// change_request_number は CR にしたときの CR の番号
export type MaterialDifferenceRead = {
  id: string;
  kind: DifferenceKind;
  target_key: string;
  origin_key: string;
  content: string;
  quote: string;
  status: DifferenceStatus;
  reasons: string[];
  dismiss_reason: string | null;
  baseline_number: number;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  requirement_candidates: string[];
  change_request_number: number | null;
};

// 取り出しの直近の回(比べた束と、その時点の束の鮮度・モデル・日時)
export type MaterialExtractionRead = {
  baseline_number: number;
  baseline_label: string;
  freshness: BaselineFreshnessRead;
  generated_model: string | null;
  generated_by: string | null;
  generated_at: string;
};

// 資料1件の違いの一覧。extraction はまだ取り出していなければ null、latest_baseline_number は今の最新の束
// (束が無ければ null)
export type MaterialDifferencesRead = {
  material_id: string;
  extraction: MaterialExtractionRead | null;
  latest_baseline_number: number | null;
  differences: MaterialDifferenceRead[];
};

// 違いを捨てる(理由が要る)・捨てたものを未確認に戻す
export type MaterialDifferenceUpdate = { action: "dismiss"; reason: string } | { action: "restore" };

// 違いから CR の下書きを作る。requirement_ids は画面・API・外部連携の違いの対象に選んだ要件(省けば候補すべて)
export type MaterialChangeRequestCreate = {
  difference_ids: string[];
  requirement_ids?: string[];
};
