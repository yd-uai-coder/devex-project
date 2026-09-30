// 作成：Phase-11-2｜更新：Phase-12-5
// 写経レベル: 定型 ── apiFetch の薄いラッパー(既存 documentsApi.ts と同じ形)。
// Phase-12-5:追記 ── auth-store.useAuthStore, base-url.API_BASE_URL, client.toApiError,
//   download.parseFilename, types(ExportFormat, UmlDiagramApprove)
import { useAuthStore } from "@/components/auth/auth-store";
import { API_BASE_URL } from "@/lib/api/base-url";
import { apiFetch, toApiError } from "@/lib/api/client";
import { parseFilename } from "@/lib/api/download";
import type {
  DataItemRead,
  ExportFormat,
  UmlCandidatesRead,
  UmlDiagramApprove,
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

// Phase-12-5:追記
// 承認(M7)。version は画面で見ていた版。409: VERSION_CONFLICT / UML_DIAGRAM_NOT_APPROVABLE、
// 400: UML_LAYOUT_REQUIRED / UML_APPROVAL_VALIDATION_FAILED(一覧は validateDiagram で取り直す)
export function approveDiagram(
  projectId: string,
  diagramId: string,
  version: number,
): Promise<UmlDiagramRead> {
  const payload: UmlDiagramApprove = { version };
  return apiFetch<UmlDiagramRead>(umlPath(projectId, `/diagrams/${diagramId}/approve`), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type ExportedFile = { filename: string; content: string; mimeType: string };

const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  drawio: "application/xml",
  svg: "image/svg+xml",
};

// 承認済みの図を出力する(M8)。出力に成功すると図の状態は exported になる。
// 本文は JSON ではなくファイルそのもの(ファイル名は Content-Disposition)なので、
// JSON 専用の apiFetch は使わず生の fetch で受け取る(文書のダウンロードと同じ)。
// 失敗は apiFetch と同じ ApiError(code 付き)にする。409 UML_DIAGRAM_NOT_APPROVED など。
export async function exportDiagram(
  projectId: string,
  diagramId: string,
  format: ExportFormat,
): Promise<ExportedFile> {
  const accessToken = useAuthStore.getState().accessToken;
  const res = await fetch(
    `${API_BASE_URL}${umlPath(projectId, `/diagrams/${diagramId}/export/${format}`)}`,
    {
      credentials: "include",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  );
  if (!res.ok) throw await toApiError(res);

  const content = await res.text();
  const filename =
    parseFilename(res.headers.get("Content-Disposition")) ?? `${diagramId}.${format}`;
  return { filename, content, mimeType: EXPORT_MIME_TYPES[format] };
}
