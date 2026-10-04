// 作成：Phase-15-7｜更新：Phase-16-6,18-9,22-6
// 写経レベル: 定型 ── ストアと部品の配線。
"use client";

// Phase-18-9:追記 ── react.useState, @/components/ui/layout-blocks/ConfirmDialog.ConfirmDialog, @/features/detailed-design/labels.STAGE_TITLES
// Phase-22-6:追記 ── @/features/detailed-design/components/DesignDocumentBar.DesignDocumentBar
import { useEffect, useState } from "react";
import Link from "next/link";
import { H2, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { DesignDocumentBar } from "@/features/detailed-design/components/DesignDocumentBar";
import { StageStepper } from "@/features/detailed-design/components/StageStepper";
import { StageWorkArea } from "@/features/detailed-design/components/StageWorkArea";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { STAGE_TITLES } from "@/features/detailed-design/labels";

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
  // Phase-18-9:追記
  // 承認を終えた段階(完了のダイアログを出している間だけ値を持つ。Phase 18)
  const [approvedStage, setApprovedStage] = useState<number | null>(null);

  useEffect(() => {
    void fetchStages(projectId);
  }, [projectId, fetchStages]);

  const current = stages.find((s) => s.stage === selectedStage);
  // Phase-18-9:追記
  const nextStage =
    approvedStage !== null && stages.some((s) => s.stage === approvedStage + 1)
      ? approvedStage + 1
      : null;

  const startApproval = async (stage: number) => {
    if (await approve(projectId, stage)) setApprovedStage(stage);
  };

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

      {/* Phase-22-6:追記 */}
      {/* 詳細設計書のダウンロード(いつでもできる。Phase 22) */}
      {stages.length > 0 ? <DesignDocumentBar projectId={projectId} stages={stages} /> : null}

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
              // Phase-18-9：更新
              // onApprove={() => void approve(projectId, current.stage)}
              // ↓↓
              onApprove={() => void startApproval(current.stage)}
            />
          ) : null}
        </XStack>
      ) : null}

      {/* Phase-18-9:追記 */}
      {/* 段階を承認したら知らせ、次の段階へ進めるようにする(最後の段階は閉じるだけ。Phase 18) */}
      <ConfirmDialog
        open={approvedStage !== null}
        title="承認しました"
        description={
          approvedStage !== null
            ? `段階${approvedStage}-${STAGE_TITLES[approvedStage] ?? ""}を承認しました。`
            : ""
        }
        confirmLabel={nextStage !== null ? "次の段階へ進む" : "閉じる"}
        cancelLabel={nextStage !== null ? "閉じる" : null}
        onConfirm={() => {
          if (nextStage !== null) selectStage(nextStage);
          setApprovedStage(null);
        }}
        onCancel={() => setApprovedStage(null)}
      />
    </YStack>
  );
}
