// 作成：Phase-53-3｜更新：Phase-53(完了後の調整)
import { apiFetch } from "@/lib/api/client";

// devex-api app/schemas/review.py・app/schemas/user.py に対応する(snake_case のまま)。
export type ReviewGate = "documents" | "stage6" | "stage7";
export type GateStatus = "not_ready" | "unreviewed" | "running" | "reviewed" | "failed";
export type ReviewLevel = "critical" | "major" | "minor";
export type ReviewCause = "hearing" | "design" | "inconsistency";
export type FindingDecision = "pending" | "adopted" | "rejected" | "held";

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
};

// ログイン中のユーザー(GET /users/me)。レビューに要る項目だけを型にする
export type CurrentUserRead = {
  id: string;
  email: string;
  is_superuser: boolean;
  // 保存した設定。使うかどうかは review_effective(superuser かつ設定がオン。サーバーで判定)
  review_enabled: boolean;
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
