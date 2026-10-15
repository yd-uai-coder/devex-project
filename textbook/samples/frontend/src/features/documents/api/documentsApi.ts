// 作成：Phase-3-6｜更新：Phase-6-2,6-6,12-5,36-3,37-3,45-5,53(完了後の調整),56-2,57-2
// Phase-12-5:追記 ── @/lib/api/download.parseFilename(UML 図の出力と共有するため移した)
// Phase-57-2:追記 ── @/lib/api/client.ApiError
import { ApiError, apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/components/auth/auth-store";
import { API_BASE_URL } from "@/lib/api/base-url";
import { parseFilename } from "@/lib/api/download";

// Phase-56-2：更新
// export type DocType = "requirements" | "external_design" | "internal_design" | "implementation_plan";
// ↓↓
// test_spec(テスト仕様書)は生成の進み具合の対象に出る。文書の一覧(GET /documents)には出ない
export type DocType =
  | "requirements"
  | "external_design"
  | "internal_design"
  | "implementation_plan"
  | "test_spec";

// Phase-36-3:追記
export type RequirementSource = "user" | "adopted" | "assumed";

// Phase-37-3：更新
// // devex-api app/schemas/document.py の RequirementIssueRead・AssumedRequirementRead・
// // RequirementsSummaryRead に対応する。
// export type RequirementIssueRead = {
// ↓↓
// devex-api app/schemas/document.py の DocumentIssueRead・AssumedRequirementRead・
// Phase-45-5：更新
// // RequirementsSummaryRead・ExternalDesignSummaryRead に対応する。
// // 検証の指摘(要件定義書・外部設計書で共通)
// ↓↓
// RequirementsSummaryRead・ExternalDesignSummaryRead・DocumentSummaryRead に対応する。
// 検証の指摘(4文書で共通)
export type DocumentIssueRead = {
  level: "critical" | "major" | "minor";
  code: string;
  message: string;
  targets: string[];
};

export type AssumedRequirementRead = {
  id: string;
  kind: "FR" | "NFR" | "CON";
  text: string;
};

export type RequirementsSummaryRead = {
  counts: Record<RequirementSource, number>;
  assumed: AssumedRequirementRead[];
  // Phase-37-3：更新
  // issues: RequirementIssueRead[];
  // ↓↓
  issues: DocumentIssueRead[];
};

export type ExternalDesignSummaryRead = {
  counts: { screens: number; apis: number; integrations: number };
  issues: DocumentIssueRead[];
};

// Phase-45-5:追記
// 内部設計書(tables / apis / modules / dataflows)・実装計画書(milestones / tasks / risks)の
// 行数と検証の指摘
export type InternalDesignSummaryRead = {
  counts: { tables: number; apis: number; modules: number; dataflows: number };
  issues: DocumentIssueRead[];
};

export type ImplementationPlanSummaryRead = {
  counts: { milestones: number; tasks: number; risks: number };
  issues: DocumentIssueRead[];
};

// devex-api app/schemas/document.py の GeneratedDocumentRead に対応する。
export type GeneratedDocumentRead = {
  id: string;
  doc_type: DocType;
  content: string;
  version: number;
  created_at: string;
  // Phase-6-6:追記 ── 現在表示中のバージョンかどうか(バージョン履歴の「表示中」バッジ用)
  is_current: boolean;
  // Phase-36-3:追記
  // 要件定義書で model を持つ版だけ(ほかの文書・以前の版は null)
  requirements?: RequirementsSummaryRead | null;
  // Phase-37-3:追記
  // 外部設計書で model を持つ版だけ(ほかの文書・以前の版は null)
  external_design?: ExternalDesignSummaryRead | null;
  // Phase-45-5:追記
  // 内部設計書・実装計画書で model を持つ版だけ(ほかの文書・以前の版は null)
  internal_design?: InternalDesignSummaryRead | null;
  implementation_plan?: ImplementationPlanSummaryRead | null;
};

// Phase-53(完了後の調整):追記
// devex-api app/schemas/document.py の GenerationProgressRead に対応する(生成していなければ null)。
// targets は作り直す文書(上流から)、done はできた文書、current は今作っている文書。
export type GenerationProgressRead = {
  targets: DocType[];
  done: DocType[];
  current: DocType | null;
};

// Phase-57-2:追記
// devex-api app/schemas/document.py の TestSpecRead に対応する。counts はテストの件数、issues は
// 決定的な検証の指摘、outdated は生成した時点の入力(文書の版・段階の承認した版)が今と違うか、
// design_gaps は「設計に無い」と印を付けたテストの件数。
export type TestSpecRead = {
  document: GeneratedDocumentRead;
  counts: { integration: number; system: number };
  issues: DocumentIssueRead[];
  outdated: boolean;
  design_gaps: number;
};

// テスト仕様書の今の版。まだ無ければ(404)null。
export async function getTestSpec(projectId: string): Promise<TestSpecRead | null> {
  try {
    return await apiFetch<TestSpecRead>(`/api/v1/projects/${projectId}/test-spec`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function getGenerationProgress(projectId: string): Promise<GenerationProgressRead | null> {
  return apiFetch<GenerationProgressRead | null>(`/api/v1/projects/${projectId}/generation-progress`);
}

export function listDocuments(projectId: string): Promise<GeneratedDocumentRead[]> {
  return apiFetch<GeneratedDocumentRead[]>(`/api/v1/projects/${projectId}/documents`);
}

// Phase-6-2:追記 ── SCR-006(バージョン履歴管理画面)向け
export function listDocumentVersions(
  projectId: string,
  docType: DocType,
): Promise<GeneratedDocumentRead[]> {
  return apiFetch<GeneratedDocumentRead[]>(
    `/api/v1/projects/${projectId}/documents/${docType}/versions`,
  );
}

export function restoreDocumentVersion(
  projectId: string,
  docType: DocType,
  version: number,
): Promise<GeneratedDocumentRead> {
  return apiFetch<GeneratedDocumentRead>(
    `/api/v1/projects/${projectId}/documents/${docType}/versions/${version}/restore`,
    // Phase-36-3:追記
    { method: "POST" },
  );
}

// 推測の要件を、利用者が確かめた「採用」にする(同じ版の md が書き換わる。版は増えない)。
export function adoptRequirement(projectId: string, reqId: string): Promise<GeneratedDocumentRead> {
  return apiFetch<GeneratedDocumentRead>(
    `/api/v1/projects/${projectId}/documents/requirements/rows/${reqId}/adopt`,
    { method: "POST" },
  );
}

// Phase-6-6：更新(NEXT_PUBLIC_API_URLの末尾スラッシュで`//api/...`となりCookieのpathに一致せず、
// F5でログインが切れる不具合があったため、末尾スラッシュを除去する共通定数base-url.tsへ集約した。
// 定数の定義自体は冒頭のimportへ移動)
// const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class DownloadError extends Error {}

// ダウンロードAPIはJSONではなくMarkdown本文をそのまま返す(ファイル名はContent-Disposition
// ヘッダに含まれる)ため、JSON専用のapiFetchは使わずここだけ生のfetchで処理する。
export async function downloadDocument(
  projectId: string,
  docId: string,
): Promise<{ filename: string; content: string }> {
  const accessToken = useAuthStore.getState().accessToken;
  const res = await fetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/documents/${docId}/download`,
    {
      credentials: "include",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  );

  if (!res.ok) {
    throw new DownloadError(`ダウンロードに失敗しました(status: ${res.status})`);
  }

  const content = await res.text();
  const filename = parseFilename(res.headers.get("Content-Disposition")) ?? `${docId}.md`;
  return { filename, content };
}

// Phase-12-5：削除(@/lib/api/download.ts の parseFilename へ移した)
// // Content-Disposition: attachment; filename="..."; filename*=UTF-8''...
// // のfilename*(RFC 5987、UTF-8パーセントエンコード)を優先して取り出す
// // (devex-api app/api/routes/projects.py _content_dispositionが両方を含めて返す)。
// function parseFilename(header: string | null): string | null {
//   if (!header) return null;
//   const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
//   if (utf8Match) return decodeURIComponent(utf8Match[1]);
//   const asciiMatch = header.match(/filename="([^"]+)"/i);
//   return asciiMatch ? asciiMatch[1] : null;
// }
