// 作成：Phase-15-6｜更新：Phase-16-5,18-5,20-4
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

// Phase-16-5:追記
// 段階のAIの下書きの生成を受け付ける(202)。生成はバックグラウンドで進むので、完了は
// listDesignStages のポーリング(generation_status)で待つ。Phase 20 の時点で段階1〜5。
// 段階2は、保存した DFD を描くグループの数が上限を超えていると 409 DESIGN_STAGE_INVALID。
// 段階5は functionIds で下書きを作る処理を選べる(省略すると、選んだ処理のうち手順の無いもの)。
// Phase-20-4：更新
// export function generateDesignStage(
//   projectId: string,
//   stage: number,
// ): Promise<DesignStageRead> {
//   return apiFetch<DesignStageRead>(`${base(projectId)}/${stage}/generate`, {
//     method: "POST",
//   });
// }
// ↓↓
export function generateDesignStage(
  projectId: string,
  stage: number,
  functionIds?: string[],
): Promise<DesignStageRead> {
  return apiFetch<DesignStageRead>(`${base(projectId)}/${stage}/generate`, {
    method: "POST",
    ...(functionIds ? { body: JSON.stringify({ function_ids: functionIds }) } : {}),
  });
}
