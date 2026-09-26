// 作成：Phase-3-5
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

export function getChatHistory(projectId: string): Promise<ChatHistoryEntry[]> {
  return apiFetch<ChatHistoryEntry[]>(`/api/v1/projects/${projectId}/chat`);
}

export function getHearingCompletion(projectId: string): Promise<HearingCompletionCheck> {
  return apiFetch<HearingCompletionCheck>(`/api/v1/projects/${projectId}/hearing-completion`);
}

// 202 Acceptedを返す(バックグラウンドタスクとして生成をトリガーするのみ)。
// 完了はGET /api/v1/projects/{id}のstatusをポーリングして検知する(ChatPageContent参照)。
export function triggerGeneration(projectId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/projects/${projectId}/generate`, { method: "POST" });
}

export function getProject(projectId: string): Promise<ProjectRead> {
  return apiFetch<ProjectRead>(`/api/v1/projects/${projectId}`);
}
