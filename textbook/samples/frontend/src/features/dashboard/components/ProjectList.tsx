// 作成：Phase-3-3
"use client";

import { useEffect } from "react";
import { Text, YStack } from "tamagui";
import { useDashboardStore } from "@/features/dashboard/dashboard-store";
import { ProjectListItem } from "@/features/dashboard/components/ProjectListItem";

export function ProjectList() {
  const projects = useDashboardStore((s) => s.projects);
  const status = useDashboardStore((s) => s.status);
  const error = useDashboardStore((s) => s.error);
  const fetchProjects = useDashboardStore((s) => s.fetchProjects);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  if (status === "loading" && projects.length === 0) {
    return <Text color="$color11">読み込み中...</Text>;
  }

  if (status === "error") {
    return (
      <Text role="alert" color="$color9">
        {error}
      </Text>
    );
  }

  if (projects.length === 0) {
    return (
      <Text color="$color11">まだプロジェクトがありません。「新規プロジェクトを作成」から始めましょう。</Text>
    );
  }

  return (
    <YStack gap="$3">
      {projects.map((project) => (
        <ProjectListItem key={project.id} project={project} />
      ))}
    </YStack>
  );
}
