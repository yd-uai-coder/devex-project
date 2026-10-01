// 作成：Phase-15-7｜更新：Phase-16-6
// 写経レベル: 定型 ── ストアと部品の配線。
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { H2, Text, XStack, YStack } from "tamagui";
import { StageStepper } from "@/features/detailed-design/components/StageStepper";
import { StageWorkArea } from "@/features/detailed-design/components/StageWorkArea";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";

// 詳細設計画面(SCR-008)。左に段階1〜7のステッパー、右に選んだ段階の作業領域を置く
// (docs/external_design.md 2.7節「段階の進め方」)。
export function DetailedDesignPageContent({
  projectId,
}: {
  projectId: string;
}) {
  const stages = useDetailedDesignStore((s) => s.stages);
  const selectedStage = useDetailedDesignStore((s) => s.selectedStage);
  const status = useDetailedDesignStore((s) => s.status);
  const error = useDetailedDesignStore((s) => s.error);
  const actionError = useDetailedDesignStore((s) => s.actionError);
  const approving = useDetailedDesignStore((s) => s.approving);
  const fetchStages = useDetailedDesignStore((s) => s.fetchStages);
  const selectStage = useDetailedDesignStore((s) => s.selectStage);
  const approve = useDetailedDesignStore((s) => s.approve);

  useEffect(() => {
    void fetchStages(projectId);
  }, [projectId, fetchStages]);

  const current = stages.find((s) => s.stage === selectedStage);

  return (
    <YStack paddingVertical="$4" gap="$4">
      <XStack justifyContent="space-between" alignItems="center">
        <H2>詳細設計</H2>
        <Link href={`/projects/${projectId}/documents`}>
          <Text color="$blue10">← ドキュメントに戻る</Text>
        </Link>
      </XStack>

      {status === "loading" && stages.length === 0 ? (
        <Text color="$color11">読み込み中...</Text>
      ) : null}
      {status === "error" ? (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      ) : null}

      {stages.length > 0 ? (
        <XStack gap="$5" alignItems="flex-start" flexWrap="wrap">
          <StageStepper
            stages={stages}
            selectedStage={selectedStage}
            onSelect={selectStage}
          />
          {current ? (
            <StageWorkArea
              // Phase-16-6:追記
              projectId={projectId}
              stage={current}
              approving={approving}
              actionError={actionError}
              onApprove={() => void approve(projectId, current.stage)}
            />
          ) : null}
        </XStack>
      ) : null}
    </YStack>
  );
}
