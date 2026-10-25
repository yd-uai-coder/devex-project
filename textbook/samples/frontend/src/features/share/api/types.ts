// 作成：Phase-108-1｜更新：Phase-108-2,108-3
import type { ShareState } from "@/features/change-requests/api/types";

// 共有リンクで見せる CR(GET /api/v1/share/{token}。devex-api app/schemas/share_link.py の
// SharedChangeRequestRead)。markdown・fingerprint・options・comments は開いている・判断済みのときだけ入り、
// 直している・閉じたときは状態と題だけ。changes は開いているときの前回説明した時点からの変わった節
export type SharedChangeRequestRead = {
  state: ShareState;
  state_label: string;
  label: string;
  title: string;
  expires_at: string;
  markdown: string | null;
  fingerprint: string | null;
  options: SharedOptionRead[];
  recommended_reason: string;
  changes: SectionChangeRead[];
  changed_since: string | null;
  decision: SharedDecisionRead | null;
  comments: SharedCommentRead[];
};

// 前回説明した時点から変わった節1つ(節の名前・消えた行・足した行)
export type SectionChangeRead = {
  name: string;
  removed: string[];
  added: string[];
};

// クライアントが選ぶ案1つ(変える要件と規模は説明書の md に書いてある)
export type SharedOptionRead = {
  number: number;
  label: string;
  name: string;
  outcome: string;
  recommended: boolean;
};

// 判断の結果。source は出どころ(developer / share_link。出どころを残す前の判断は null)
export type SharedDecisionRead = {
  decision: "agreed" | "rejected";
  decision_label: string;
  decided_at: string;
  counterpart: string | null;
  option: string | null;
  source: string | null;
  source_label: string | null;
};

// Phase-108-3:追記
// 共有リンクからの合意・却下(名前・見た説明書の版と、案のある CR の合意では選んだ案の番号)。
// 理由は却下では必須、合意では任意(空なら記録の理由は「共有リンクで合意」)
export type SharedDecisionCreate = {
  decision: "agreed" | "rejected";
  name: string;
  fingerprint: string;
  option: number | null;
  reason: string;
};

// Phase-108-2:追記
// 共有リンクからのコメント(名前・本文と、見た説明書の版)
export type SharedCommentCreate = {
  name: string;
  body: string;
  fingerprint: string;
};

// クライアントに見せるコメント1つ(開発者の返信の書き手は「開発者」。replies は古い順の返信)
export type SharedCommentRead = {
  author: string;
  from_developer: boolean;
  body: string;
  created_at: string;
  replies: SharedCommentRead[];
};
