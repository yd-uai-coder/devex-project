// 作成：Phase-3-3｜更新：24(完了後の調整)
import Link from "next/link";
import { Text, XStack } from "tamagui";
import { StyledCard } from "@/components/ui/primitives/StyledCard";
// Phase-24：更新
// import type { ProjectRead } from "@/features/dashboard/api/projects";
// ↓↓
import type { ProjectMode, ProjectRead } from "@/features/dashboard/api/projects";

const STATUS_LABEL: Record<ProjectRead["status"], string> = {
  interviewing: "ヒアリング中",
  generating: "生成中",
  completed: "完了",
  revising: "修正中",
// Phase-24:追記
};

// 作成時に選んだモード(変更不可)。一覧で見分けられるよう、題名の前に短く出す
const MODE_BADGE: Record<ProjectMode, string> = {
  simple: "簡易",
  detailed: "詳細",
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
          // Phase-24：更新
          // <Text fontSize="$5" fontWeight="600">
          //   {project.title}
          // </Text>
          // ↓↓
          <XStack alignItems="center" gap="$2" flexShrink={1}>
            <Text
              fontSize="$1"
              paddingHorizontal="$2"
              paddingVertical={2}
              borderRadius="$2"
              borderWidth={1}
              borderColor={project.mode === "detailed" ? "$blue8" : "$color8"}
              color={project.mode === "detailed" ? "$blue11" : "$color11"}
              flexShrink={0}
            >
              {MODE_BADGE[project.mode]}
            </Text>
            <Text fontSize="$5" fontWeight="600">
              {project.title}
            </Text>
          </XStack>
          <Text fontSize="$2" color="$color11">
            {STATUS_LABEL[project.status]}
          </Text>
        </XStack>
      </StyledCard>
    </Link>
  );
}
