// 作成：Phase-3-3
import Link from "next/link";
import { Text, XStack } from "tamagui";
import { StyledCard } from "@/components/ui/primitives/StyledCard";
import type { ProjectRead } from "@/features/dashboard/api/projects";

const STATUS_LABEL: Record<ProjectRead["status"], string> = {
  interviewing: "ヒアリング中",
  generating: "生成中",
  completed: "完了",
  revising: "修正中",
};

// プロジェクトの状態に応じた遷移先。ヒアリング中/生成中/修正中はチャット画面(生成中は
// そこでポーリングして完了を検知する、Phase-3-5参照。修正中はcompletedから新規メッセージを
// 送った状態で、チャット画面には生成済みドキュメントへの常設リンクも表示される)、
// 完了済みはドキュメントプレビューへ。
export function projectHref(project: Pick<ProjectRead, "id" | "status">): string {
  return project.status === "completed"
    ? `/projects/${project.id}/documents`
    : `/projects/${project.id}/chat`;
}

export function ProjectListItem({ project }: { project: ProjectRead }) {
  return (
    <Link href={projectHref(project)} aria-label={`${project.title}(${STATUS_LABEL[project.status]})`}>
      <StyledCard hoverStyle={{ borderColor: "$color8" }}>
        <XStack justifyContent="space-between" alignItems="center" gap="$3">
          <Text fontSize="$5" fontWeight="600">
            {project.title}
          </Text>
          <Text fontSize="$2" color="$color11">
            {STATUS_LABEL[project.status]}
          </Text>
        </XStack>
      </StyledCard>
    </Link>
  );
}
