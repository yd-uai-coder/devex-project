// 作成：Phase-15-6
// 写経レベル: 定型 ── API クライアント・型・そのテスト。
import { apiFetch } from "@/lib/api/client";
import type { DesignStageRead } from "./types";

const base = (projectId: string) =>
  `/api/v1/projects/${projectId}/design-stages`;

// 段階1〜7の状態(未着手の段階も含む)。詳細設計モードでないプロジェクトは409
// (DESIGN_STAGES_NOT_AVAILABLE)。
export function listDesignStages(
  projectId: string,
): Promise<DesignStageRead[]> {
  return apiFetch<DesignStageRead[]>(base(projectId));
}

// 段階の内容を保存する(楽観ロック)。未着手の段階を初めて保存するときは version に null を渡す。
export function saveDesignStage(
  projectId: string,
  stage: number,
  payload: { version: number | null; model: Record<string, unknown> },
): Promise<DesignStageRead> {
  return apiFetch<DesignStageRead>(`${base(projectId)}/${stage}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// 段階を承認する。「古い」段階は、内容を変えずに承認し直せる。
export function approveDesignStage(
  projectId: string,
  stage: number,
  version: number,
): Promise<DesignStageRead> {
  return apiFetch<DesignStageRead>(`${base(projectId)}/${stage}/approve`, {
    method: "POST",
    body: JSON.stringify({ version }),
  });
}
