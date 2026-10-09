// 作成：Phase-3-5｜更新：Phase-34-3
import { apiFetch } from "@/lib/api/client";
import type { ProjectRead } from "@/features/dashboard/api/projects";

export type ChatSender = "user" | "ai" | "intake" | "others" | "attachment";

// devex-api app/schemas/hearing.py の ChatHistoryRead に対応する。
export type ChatHistoryEntry = {
  id: string;
  sender: ChatSender;
  message: string;
  created_at: string;
};

// devex-api app/schemas/generation.py の HearingCompletionCheck に対応する。
export type HearingCompletionCheck = {
  is_sufficient: boolean;
  summary: string;
  missing_points: string[];
};

// Phase-34-3:追記
export type HearingScale = "personal" | "internal" | "public";
export type HearingPointStatus = "decided" | "adopted" | "open" | "not_applicable";

// devex-api app/schemas/hearing.py の HearingPointRead / HearingPointsRead に対応する。
// 観点の名前・問いの例・必須はバックエンドの定義(app/hearing/points.py)から届く。
export type HearingPoint = {
  key: string;
  kind: "function" | "nonfunctional";
  label: string;
  question: string;
  required: boolean;
  status: HearingPointStatus;
  summary: string;
  evidence: { message_id: string; label: string }[];
};

export type HearingPointsView = {
  scale: HearingScale | null;
  // 観点の表を持たず、以前の5条件の判定だけがあるプロジェクト
  legacy: boolean;
  // 直近の発言の判定に失敗し、表がその発言を反映していない
  stale: boolean;
  is_sufficient: boolean;
  points: HearingPoint[];
};

export function getChatHistory(projectId: string): Promise<ChatHistoryEntry[]> {
  return apiFetch<ChatHistoryEntry[]>(`/api/v1/projects/${projectId}/chat`);
}

export function getHearingCompletion(projectId: string): Promise<HearingCompletionCheck> {
  return apiFetch<HearingCompletionCheck>(`/api/v1/projects/${projectId}/hearing-completion`);
}

// Phase-34-3:追記
export function getHearingPoints(projectId: string): Promise<HearingPointsView> {
  return apiFetch<HearingPointsView>(`/api/v1/projects/${projectId}/hearing-points`);
}

// 202 Acceptedを返す(バックグラウンドタスクとして生成をトリガーするのみ)。
// 完了はGET /api/v1/projects/{id}のstatusをポーリングして検知する(ChatPageContent参照)。
export function triggerGeneration(projectId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/projects/${projectId}/generate`, { method: "POST" });
}

export function getProject(projectId: string): Promise<ProjectRead> {
  return apiFetch<ProjectRead>(`/api/v1/projects/${projectId}`);
}
