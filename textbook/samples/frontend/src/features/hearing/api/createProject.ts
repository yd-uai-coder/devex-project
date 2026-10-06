// 作成：Phase-3-4｜更新：Phase-6-4,15-6,24(ゴール3後の調整)
// Phase-15-6:追記 ── ProjectMode(@/features/dashboard/api/projects)
import { apiFetch } from "@/lib/api/client";
import type { ProjectMode, ProjectRead } from "@/features/dashboard/api/projects";
import type { EnvironmentValues } from "@/features/hearing/schemas";

export type CreateProjectInput = {
  // Phase-24:追記
  projectName: string;
  systemOverview: string;
  goalsRaw: string;
  notesRaw: string;
  // Phase-6-4:追記
  templateId: string | null;
  // Phase-15-6:追記
  // 省略時はバックエンドの既定(simple)になる
  mode?: ProjectMode;
  environment: EnvironmentValues;
  files: File[];
};

// POST /api/v1/projects はmultipart/form-data。初期ヒアリング入力の各項目はフォーム
// フィールドとして、environmentは1つのJSON文字列フィールドとして、ファイルはfilesフィールドとして
// 送信する(devex-api app/api/routes/projects.py の_parse_environment参照)。
export function createProject(input: CreateProjectInput): Promise<ProjectRead> {
  const formData = new FormData();
  // Phase-24:追記
  formData.set("name", input.projectName);
  formData.set("system_overview", input.systemOverview);
  formData.set("goals_raw", input.goalsRaw);
  if (input.notesRaw) {
    formData.set("notes_raw", input.notesRaw);
  }
  // Phase-6-4:追記
  if (input.templateId) {
    formData.set("template_id", input.templateId);
  }
  // Phase-15-6:追記
  if (input.mode) {
    formData.set("mode", input.mode);
  }

  const { languages, frameworks, databases, deployTargets } = input.environment;
  const hasEnvironment =
    languages.length > 0 || frameworks.length > 0 || databases.length > 0 || deployTargets.length > 0;
  if (hasEnvironment) {
    formData.set(
      "environment",
      JSON.stringify({
        languages,
        frameworks,
        databases,
        deploy_targets: deployTargets,
      }),
    );
  }

  for (const file of input.files) {
    formData.append("files", file);
  }

  return apiFetch<ProjectRead>("/api/v1/projects", { method: "POST", body: formData });
}
