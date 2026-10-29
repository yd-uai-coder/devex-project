// 作成：Phase-116-1
import { apiFetch } from "@/lib/api/client";
import type { ChangeRequestRead } from "@/features/change-requests/api/types";
import type {
  MaterialChangeRequestCreate,
  MaterialCreate,
  MaterialDifferenceRead,
  MaterialDifferencesRead,
  MaterialDifferenceUpdate,
  MaterialMeta,
  MaterialRead,
  MaterialSummaryRead,
} from "@/features/materials/api/types";

// 資料の API(devex-api app/api/routes/materials.py)。詳細設計モードのプロジェクトだけ。
const base = (projectId: string) => `/api/v1/projects/${projectId}/materials`;

// 足した順の新しい方から(本文なし)
export function listMaterials(projectId: string): Promise<MaterialSummaryRead[]> {
  return apiFetch<MaterialSummaryRead[]>(base(projectId));
}

export function getMaterial(projectId: string, materialId: string): Promise<MaterialRead> {
  return apiFetch<MaterialRead>(`${base(projectId)}/${materialId}`);
}

// 本文の貼り付け。上限の数は409(TOO_MANY_MATERIALS)、本文が長すぎれば422(MATERIAL_TOO_LONG)
export function createMaterial(projectId: string, body: MaterialCreate): Promise<MaterialRead> {
  return apiFetch<MaterialRead>(base(projectId), { method: "POST", body: JSON.stringify(body) });
}

// ファイル(txt / md / pdf)は multipart。形式・大きさは400、本文を取り出せない・長すぎれば422
export function uploadMaterial(projectId: string, meta: MaterialMeta, file: File): Promise<MaterialRead> {
  const formData = new FormData();
  formData.set("kind", meta.kind);
  formData.set("title", meta.title);
  formData.set("material_date", meta.material_date);
  formData.set("file", file);
  return apiFetch<MaterialRead>(`${base(projectId)}/upload`, { method: "POST", body: formData });
}

// 資料を消すと、その資料の違いも消える(CR は残る)
export function deleteMaterial(projectId: string, materialId: string): Promise<void> {
  return apiFetch<void>(`${base(projectId)}/${materialId}`, { method: "DELETE" });
}

// 最新の束と比べて違いを LLM で取り出す(同期で1回)。束が無ければ409(MATERIAL_BASELINE_MISSING)
export function extractDifferences(projectId: string, materialId: string): Promise<MaterialDifferencesRead> {
  return apiFetch<MaterialDifferencesRead>(`${base(projectId)}/${materialId}/differences`, { method: "POST" });
}

export function listDifferences(projectId: string, materialId: string): Promise<MaterialDifferencesRead> {
  return apiFetch<MaterialDifferencesRead>(`${base(projectId)}/${materialId}/differences`);
}

// 捨てる・戻す。今の状態でできなければ409(MATERIAL_DIFFERENCE_STATE)
export function updateDifference(
  projectId: string,
  materialId: string,
  differenceId: string,
  body: MaterialDifferenceUpdate,
): Promise<MaterialDifferenceRead> {
  return apiFetch<MaterialDifferenceRead>(`${base(projectId)}/${materialId}/differences/${differenceId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// 選んだ違いから CR の下書きを作る。取り出した後に束を作り直していれば409(MATERIAL_DIFFERENCE_OUTDATED)、
// 組み立てられなければ422(MATERIAL_DRAFT_INVALID)
export function createChangeRequestFromDifferences(
  projectId: string,
  materialId: string,
  body: MaterialChangeRequestCreate,
): Promise<ChangeRequestRead> {
  return apiFetch<ChangeRequestRead>(`${base(projectId)}/${materialId}/change-requests`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
