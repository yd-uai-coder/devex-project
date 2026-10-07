// 作成：Phase-15-6｜更新：Phase-16-5,18-5,20-4,21-4,22-6,27-3,28-3,28-4,29-4
// 写経レベル: 定型 ── API クライアント・型・そのテスト。
// Phase-21-4:追記 ── ./types.LogicTarget
// Phase-22-6:追記 ── @/lib/api/download(fetchAttachment, parseFilename)
// Phase-29-4:追記 ── ./types.SequenceRead
import { apiFetch } from "@/lib/api/client";
import { fetchAttachment, parseFilename } from "@/lib/api/download";
// Phase-28-4：更新
// import type { DesignStageRead, LogicTarget } from "./types";
// ↓↓
import type { DesignStageRead, LogicTarget, SequenceRead, UnitContextRead } from "./types";

const base = (projectId: string) =>
  `/api/v1/projects/${projectId}/design-stages`;

// Phase-27-3：更新(段階1〜7 → 段階1〜8)
// 段階1〜8の状態(未着手の段階も含む)。詳細設計モードでないプロジェクトは409
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
// listDesignStages のポーリング(generation_status)で待つ。Phase 21 の時点で段階1〜6。
// 段階2は、保存した DFD を描くグループの数が上限を超えていると 409 DESIGN_STAGE_INVALID。
// 段階5は functionIds で下書きを作る処理を選べる(省略すると、選んだ処理のうち手順の無いもの)。
// 段階6は logics で下書きを作る関数を選べる(省略すると、選んだ関数のうち詳細の無いもの。Phase 21)。
// Phase-21-4：更新(段階6の対象の関数 logics を本文に足す)
// export function generateDesignStage(
//   projectId: string,
//   stage: number,
//   functionIds?: string[],
// ): Promise<DesignStageRead> {
//   return apiFetch<DesignStageRead>(`${base(projectId)}/${stage}/generate`, {
//     method: "POST",
//     ...(functionIds ? { body: JSON.stringify({ function_ids: functionIds }) } : {}),
//   });
// }
// ↓↓
// 段階8は unitIds で手順書を作る単位を選べる(省略すると、段階7の単位のうち手順書の無いもの。Phase 28)。
export function generateDesignStage(
  projectId: string,
  stage: number,
  functionIds?: string[],
  logics?: LogicTarget[],
  // Phase-28-3:追記
  unitIds?: string[],
): Promise<DesignStageRead> {
  const body = {
    ...(functionIds ? { function_ids: functionIds } : {}),
    ...(logics ? { logics } : {}),
    // Phase-28-3:追記
    ...(unitIds ? { unit_ids: unitIds } : {}),
  };
  return apiFetch<DesignStageRead>(`${base(projectId)}/${stage}/generate`, {
    method: "POST",
    // Phase-28-3：更新
    // ...(functionIds || logics ? { body: JSON.stringify(body) } : {}),
    // ↓↓
    ...(functionIds || logics || unitIds ? { body: JSON.stringify(body) } : {}),
  });
}

// Phase-28-4:追記
// Phase-29-4:追記
// 段階5の処理1つのシーケンス図(保存した手順から導く。図は保存しない)。段階5が開いていなければ409、
// 段階5で選んでいない処理は404。
export function getProcedureSequence(projectId: string, functionId: string): Promise<SequenceRead> {
  return apiFetch<SequenceRead>(
    `${base(projectId)}/procedures/${encodeURIComponent(functionId)}/sequence`,
  );
}

// 段階8の単位1つが参照する設計の展開(承認済みの段階1〜7から毎回導く)。段階8が開いていなければ409。
export function getUnitContext(projectId: string, unitId: string): Promise<UnitContextRead> {
  return apiFetch<UnitContextRead>(
    `${base(projectId)}/units/${encodeURIComponent(unitId)}/context`,
  );
}

// Phase-22-6:追記
export type DownloadedDocument = { filename: string; content: Blob };

// 詳細設計書(HTML・md)と載せた図(SVG・draw.io)の zip(Phase 22)。いつでもダウンロードでき、
// 承認していない段階の章は「未承認」になる。zip に入れた図は exported になる。
// zip はバイナリなので text() ではなく blob() で受け取る。
export async function downloadDetailedDesign(projectId: string): Promise<DownloadedDocument> {
  const res = await fetchAttachment(`${base(projectId)}/document`);
  const content = await res.blob();
  const filename = parseFilename(res.headers.get("Content-Disposition")) ?? "detailed_design.zip";
  return { filename, content };
}
