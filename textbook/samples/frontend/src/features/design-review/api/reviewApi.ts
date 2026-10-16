// 作成：Phase-53-3｜更新：Phase-53(完了後の調整),54-1,54-4,54-5,68-4
import { apiFetch } from "@/lib/api/client";

// devex-api app/schemas/review.py・app/schemas/user.py に対応する(snake_case のまま)。
export type ReviewGate = "documents" | "stage6" | "stage7";
export type GateStatus = "not_ready" | "unreviewed" | "running" | "reviewed" | "failed";
export type ReviewLevel = "critical" | "major" | "minor";
export type ReviewCause = "hearing" | "design" | "inconsistency";
export type FindingDecision = "pending" | "adopted" | "rejected" | "held";
// Phase-54-1:追記
// 採用した指摘の追跡。unaddressed = 関連文書・段階の版が変わっていない / target_unchanged = 版は
// 変わったが対象の行が変わっていない / changed = 対象が変わった・比べられない
export type FollowupState = "unaddressed" | "target_unchanged" | "changed";
export type FixVerdict = "fixed" | "partial" | "not_fixed" | "unsure";

// 採用した指摘が直ったかの判定(Claude Haiku。シャドーモード)。今の版について判定したものだけ
export type FixCheckRead = {
  verdict: FixVerdict | null;
  reason: string;
  model: string;
  error_code: string | null;
  created_at: string;
};

export type ReviewFindingRead = {
  id: string;
  position: number;
  level: ReviewLevel;
  cause: ReviewCause;
  targets: string[];
  // Phase-53(完了後の調整):追記
  // 直すときに書き換える文書の種類(上流から)。列を足す前の指摘は null
  documents: string[] | null;
  // 原因がヒアリングのとき、聞き直す観点のキー
  point_key: string | null;
  problem: string;
  // 文書からの引用(指摘の根拠)
  evidence: string;
  reason: string;
  suggestion: string;
  decision: FindingDecision;
  // Phase-54-1:追記
  // 採用した指摘の追跡(採用していなければ null)
  followup: FollowupState | null;
  // 今の版についての「直ったか」の判定(判定していなければ null)
  fix_check: FixCheckRead | null;
};

export type ReviewRunRead = {
  id: string;
  gate: ReviewGate;
  // レビューした版({doc_type: 版, "stage:N": 承認した版})
  targets: Record<string, number>;
  trigger: "auto" | "manual";
  model: string;
  status: "running" | "succeeded" | "failed";
  error_code: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  started_at: string;
  finished_at: string | null;
  findings: ReviewFindingRead[];
  // レビューした版が今の版と同じか
  is_current: boolean;
};

export type ReviewGateSummaryRead = {
  gate: ReviewGate;
  ready: boolean;
  status: GateStatus;
  run: ReviewRunRead | null;
  // Phase-54-1:追記
  // 前の回で採用した指摘(新しい回から。作り直しの後の自動のレビューで最新の回が替わっても残す)
  adopted_before: ReviewFindingRead[];
};

// ログイン中のユーザー(GET /users/me)。レビューに要る項目だけを型にする
export type CurrentUserRead = {
  id: string;
  email: string;
  is_superuser: boolean;
  // Phase-68-4：更新
  // // 保存した設定。使うかどうかは review_effective(superuser かつ設定がオン。サーバーで判定)
  // ↓↓
  // 保存した設定。使うかどうかは review_effective(使えるアカウントで設定がオン。サーバーで判定)
  review_enabled: boolean;
  // Phase-68-4:追記
  // レビューを使えるアカウントか(superuser、またはレビューの用途の AI の自分のキーがある。サーバーで判定)
  review_allowed: boolean;
  review_effective: boolean;
};

export function getCurrentUser(): Promise<CurrentUserRead> {
  return apiFetch<CurrentUserRead>("/api/v1/users/me");
}

export function updateReviewSettings(reviewEnabled: boolean): Promise<CurrentUserRead> {
  return apiFetch<CurrentUserRead>("/api/v1/users/me/review-settings", {
    method: "PUT",
    body: JSON.stringify({ review_enabled: reviewEnabled }),
  });
}

export function listReviewGates(projectId: string): Promise<ReviewGateSummaryRead[]> {
  return apiFetch<ReviewGateSummaryRead[]>(`/api/v1/projects/${projectId}/reviews`);
}

// 区切りのレビューを流す(受け付けた実行中の回が返る。実行はバックグラウンド)
export function requestReview(projectId: string, gate: ReviewGate): Promise<ReviewRunRead> {
  return apiFetch<ReviewRunRead>(`/api/v1/projects/${projectId}/reviews/${gate}`, { method: "POST" });
}

export function decideFinding(
  projectId: string,
  findingId: string,
  decision: FindingDecision,
): Promise<ReviewFindingRead> {
  return apiFetch<ReviewFindingRead>(`/api/v1/projects/${projectId}/reviews/findings/${findingId}`, {
    method: "PUT",
    body: JSON.stringify({ decision }),
  });
}

// Phase-54-1:追記
// 採用したヒアリングの指摘の観点を未決に戻し、チャットで聞き直す(最初の問いかけはサーバーが作る)
export function requestRehearing(projectId: string, findingIds: string[]): Promise<unknown> {
  return apiFetch<unknown>(`/api/v1/projects/${projectId}/reviews/rehearing`, {
    method: "POST",
    body: JSON.stringify({ finding_ids: findingIds }),
  });
}
