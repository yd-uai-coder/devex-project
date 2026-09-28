// 作成：Phase-6-4
// 写経レベル: 定型 ── documentsApi.tsのlistDocumentVersions等と同型の薄いGETラッパー。
import { apiFetch } from "@/lib/api/client";

// devex-api app/schemas/prompt_template.py の PromptTemplateRead に対応する。
export type PromptTemplateRead = {
  id: string;
  name: string;
  target_type: string;
  system_prompt: string;
  default_environment: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    deploy_targets: string[];
  } | null;
  created_at: string;
};

export function listPromptTemplates(): Promise<PromptTemplateRead[]> {
  return apiFetch<PromptTemplateRead[]>("/api/v1/prompt-templates");
}
