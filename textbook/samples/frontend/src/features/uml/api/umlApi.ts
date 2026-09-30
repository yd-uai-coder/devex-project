// 作成：Phase-11-2
// 写経レベル: 定型 ── apiFetch の薄いラッパー(既存 documentsApi.ts と同じ形)。
import { apiFetch } from "@/lib/api/client";
import type {
  DataItemRead,
  UmlCandidatesRead,
  UmlDiagramRead,
  UmlDiagramUpdate,
  UmlGenerateRequest,
  UmlGenerationRunRead,
  ValidationResult,
} from "@/features/uml/api/types";

// devex-api app/api/routes/uml.py(prefix: /api/v1/projects/{project_id}/uml)への薄いラッパー。
function umlPath(projectId: string, path: string): string {
  return `/api/v1/projects/${projectId}/uml${path}`;
}

export function listDiagrams(projectId: string): Promise<UmlDiagramRead[]> {
  return apiFetch<UmlDiagramRead[]>(umlPath(projectId, "/diagrams"));
}

export function getDiagram(projectId: string, diagramId: string): Promise<UmlDiagramRead> {
  return apiFetch<UmlDiagramRead>(umlPath(projectId, `/diagrams/${diagramId}`));
}

export function updateDiagram(
  projectId: string,
  diagramId: string,
  payload: UmlDiagramUpdate,
): Promise<UmlDiagramRead> {
  return apiFetch<UmlDiagramRead>(umlPath(projectId, `/diagrams/${diagramId}`), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// 202 で受け付けるだけ。完了は listDiagrams の generation_status をポーリングして判定する。
export function generateDiagrams(
  projectId: string,
  payload: UmlGenerateRequest,
): Promise<UmlGenerationRunRead> {
  return apiFetch<UmlGenerationRunRead>(umlPath(projectId, "/diagrams"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCandidates(projectId: string): Promise<UmlCandidatesRead> {
  return apiFetch<UmlCandidatesRead>(umlPath(projectId, "/candidates"));
}

export function listGenerationRuns(projectId: string): Promise<UmlGenerationRunRead[]> {
  return apiFetch<UmlGenerationRunRead[]>(umlPath(projectId, "/generation-runs"));
}

export function validateDiagram(projectId: string, diagramId: string): Promise<ValidationResult> {
  return apiFetch<ValidationResult>(umlPath(projectId, `/diagrams/${diagramId}/validate`), {
    method: "POST",
  });
}

// DB に保存済みの意味モデルを配置する(未保存の編集は含まれない。先に updateDiagram を呼ぶ)。
export function computeLayout(projectId: string, diagramId: string): Promise<UmlDiagramRead> {
  return apiFetch<UmlDiagramRead>(umlPath(projectId, `/diagrams/${diagramId}/layout`), {
    method: "POST",
  });
}

export function listDataItems(projectId: string): Promise<DataItemRead[]> {
  return apiFetch<DataItemRead[]>(umlPath(projectId, "/data-items"));
}
