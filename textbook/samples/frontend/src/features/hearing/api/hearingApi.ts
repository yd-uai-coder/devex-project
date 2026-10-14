// 作成：Phase-3-5｜更新：Phase-34-3,35-3,35(完了後の調整),53(完了後の調整)
import { apiFetch } from "@/lib/api/client";
import type { ProjectRead } from "@/features/dashboard/api/projects";

export type ChatSender = "user" | "ai" | "intake" | "others" | "attachment";

// Phase-35-3：更新
// // devex-api app/schemas/hearing.py の ChatHistoryRead に対応する。
// ↓↓
// devex-api app/schemas/hearing.py の CardRead に対応する(選択肢カード1枚)。
// selected は選ばれた選択肢の番号(0始まり。未回答なら null)。
export type HearingCard = {
  id: string;
  point_key: string;
  label: string;
  question: string;
  options: { label: string; result: string }[];
  recommended: number;
  reason: string;
  selected: number | null;
};

// devex-api app/schemas/hearing.py の CardAnswer に対応する。
export type CardAnswer = { card_id: string; option: number };

// devex-api app/schemas/hearing.py の ChatHistoryRead に対応する。cards は AI の発言だけが持つ。
export type ChatHistoryEntry = {
  id: string;
  sender: ChatSender;
  message: string;
  // Phase-35-3:追記
  cards?: HearingCard[] | null;
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

// Phase-35(完了後の調整):追記
// 観点の表の画面から、未決の観点を「対象外(後で決める)」にする。作り直した観点の表が返る。
// サーバーは完了判定もその場で作り直す(LLM は呼ばない)。
export function markPointNotApplicable(projectId: string, pointKey: string): Promise<HearingPointsView> {
  return apiFetch<HearingPointsView>(`/api/v1/projects/${projectId}/hearing-points/${pointKey}`, {
    method: "PUT",
    body: JSON.stringify({ status: "not_applicable" }),
  });
}

// 202 Acceptedを返す(バックグラウンドタスクとして生成をトリガーするのみ)。
// 完了はGET /api/v1/projects/{id}のstatusをポーリングして検知する(ChatPageContent参照)。
// Phase-53(完了後の調整)：更新
// export function triggerGeneration(projectId: string): Promise<void> {
//   return apiFetch<void>(`/api/v1/projects/${projectId}/generate`, { method: "POST" });
// }
// ↓↓
// startFrom は再生成の起点(その文書から下流を作り直す)。省略で全部(チャットからの生成)。
export function triggerGeneration(projectId: string, startFrom?: string): Promise<void> {
  return apiFetch<void>(`/api/v1/projects/${projectId}/generate`, {
    method: "POST",
    ...(startFrom ? { body: JSON.stringify({ start_from: startFrom }) } : {}),
  });
}

export function getProject(projectId: string): Promise<ProjectRead> {
  return apiFetch<ProjectRead>(`/api/v1/projects/${projectId}`);
}
