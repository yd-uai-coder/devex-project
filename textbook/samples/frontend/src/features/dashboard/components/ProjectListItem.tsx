// 作成：Phase-3-3｜更新：24(完了後の調整),64-4
import Link from "next/link";
import { Text, XStack } from "tamagui";
import { StyledCard } from "@/components/ui/primitives/StyledCard";
// Phase-24：更新
// import type { ProjectRead } from "@/features/dashboard/api/projects";
// ↓↓
import type { ProjectMode, ProjectRead } from "@/features/dashboard/api/projects";
// Phase-64-4:追記
import { DeleteProjectButton } from "@/features/dashboard/components/DeleteProjectButton";

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

// Phase-64-4:追記
// カードの中で、遷移のリンク(モードと題名)と削除ボタンを兄弟に置く(リンクの <a> の中に <button> は置けないため)。
// リンクは残りの幅を占め、カードの大部分を押すと開く。
export function ProjectListItem({ project }: { project: ProjectRead }) {
  return (
    // Phase-64-4：更新
    // <Link href={projectHref(project)} aria-label={`${project.title}(${STATUS_LABEL[project.status]})`}>
    //   <StyledCard hoverStyle={{ borderColor: "$color8" }}>
    //     <XStack justifyContent="space-between" alignItems="center" gap="$3">
    // ↓↓
    <StyledCard hoverStyle={{ borderColor: "$color8" }}>
      <XStack justifyContent="space-between" alignItems="center" gap="$3">
        <Link
          href={projectHref(project)}
          aria-label={`${project.title}(${STATUS_LABEL[project.status]})`}
          style={{ flex: 1, minWidth: 0 }}
        >
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
        // Phase-64-4:追記
        </Link>
        <XStack alignItems="center" gap="$2" flexShrink={0}>
          <Text fontSize="$2" color="$color11">
            {STATUS_LABEL[project.status]}
          </Text>
          // Phase-64-4:追記
          <DeleteProjectButton projectId={project.id} title={project.title} variant="icon" />
        </XStack>
      // Phase-64-4：更新
      // </StyledCard>
      // </Link>
      // ↓↓
      </XStack>
    </StyledCard>
  );
}
