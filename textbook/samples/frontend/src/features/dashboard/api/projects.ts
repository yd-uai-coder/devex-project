// 作成：Phase-3-3｜更新：Phase-15-6,15-7,62-3,64-3
import { apiFetch } from "@/lib/api/client";

export type ProjectStatus = "interviewing" | "generating" | "completed" | "revising";
// Phase-15-6:追記

// simple: 簡易ドキュメントモード(4文書の一括生成) / detailed: 詳細設計モード。作成時に選び、後から変えない。
export type ProjectMode = "simple" | "detailed";
// Phase-15-7:追記

// Phase-62-3：更新
// // クエリ(?mode=)などの文字列をモードにする。無い・不正な値のときは簡易ドキュメントモード
// // (バックエンドの既定)にする。
// export function toProjectMode(raw: string | string[] | undefined): ProjectMode {
//   return raw === "detailed" ? "detailed" : "simple";
// ↓↓
// クエリ(?mode=)などの文字列をモードにする。無い・不正な値のときは null を返す
// (作成画面はモード選択ダイアログを出して選ばせる)。
export function toProjectMode(raw: string | string[] | undefined): ProjectMode | null {
  return raw === "simple" || raw === "detailed" ? raw : null;
}

// devex-api app/schemas/project.py の ProjectRead に対応する。
export type ProjectRead = {
  id: string;
  title: string;
  status: ProjectStatus;
  // Phase-15-6:追記
  mode: ProjectMode;
  created_at: string;
  updated_at: string;
};

export function listProjects(): Promise<ProjectRead[]> {
  return apiFetch<ProjectRead[]>("/api/v1/projects");
}

// Phase-64-3:追記
// プロジェクトを削除する(204)。生成中でも削除できる。
export function deleteProject(projectId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/projects/${projectId}`, { method: "DELETE" });
}
