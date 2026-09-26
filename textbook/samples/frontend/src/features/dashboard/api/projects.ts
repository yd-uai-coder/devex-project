// 作成：Phase-3-3
import { apiFetch } from "@/lib/api/client";

export type ProjectStatus = "interviewing" | "generating" | "completed" | "revising";

// devex-api app/schemas/project.py の ProjectRead に対応する。
export type ProjectRead = {
  id: string;
  title: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

export function listProjects(): Promise<ProjectRead[]> {
  return apiFetch<ProjectRead[]>("/api/v1/projects");
}
