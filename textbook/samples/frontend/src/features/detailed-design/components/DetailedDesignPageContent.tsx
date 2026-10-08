// 作成：Phase-15-7｜更新：Phase-16-6,18-9,22-6,27-3,28-3,31-5
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
// Phase-28-3:追記
import { criticalCount } from "@/features/detailed-design/procedureDocOps";

// Phase-27-3：更新(段階1〜7 → 段階1〜8)
// 詳細設計画面(SCR-008)。左に段階1〜8のステッパー、右に選んだ段階の作業領域を置く
// Phase-31-5：更新
// // (docs/external_design.md 2.7節「段階の進め方」)。
// ↓↓
// (docs/external_design.md 2.7節「段階の進め方」)。簡易ドキュメントモードのプロジェクトは段階8
// (実装手順書)だけを持ち、同じ画面を段階8だけのステッパーで開く(見出しは「実装手順書」)。
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
  // Phase-28-3:追記
  // 最重要の指摘が残ったまま承認しようとしている段階8の、最重要の数(確認を出している間だけ値を持つ)
  const [criticalLeft, setCriticalLeft] = useState<number | null>(null);

  useEffect(() => {
    void fetchStages(projectId);
  }, [projectId, fetchStages]);

  const current = stages.find((s) => s.stage === selectedStage);
  // Phase-18-9:追記
  // Phase-31-5:追記
  const simple = stages[0]?.mode === "simple";
  const nextStage =
    approvedStage !== null && stages.some((s) => s.stage === approvedStage + 1)
      ? approvedStage + 1
      : null;

  // Phase-28-3：更新
  // const startApproval = async (stage: number) => {
  //   if (await approve(projectId, stage)) setApprovedStage(stage);
  // };
  // ↓↓
  const approveStage = async (stage: number) => {
    if (await approve(projectId, stage)) setApprovedStage(stage);
  };
  // 段階8は、最重要の指摘(未定義・要決定)が残っていれば確かめてから承認する(承認は止めない)
  const startApproval = (stage: number) => {
    const critical = current && stage === 8 ? criticalCount(current) : 0;
    if (critical > 0) setCriticalLeft(critical);
    else void approveStage(stage);
  };

  return (
    <YStack paddingVertical="$4" gap="$4">
      <XStack justifyContent="space-between" alignItems="center">
        {/* Phase-31-5：更新
           <H2>詳細設計</H2>
           ↓↓ */}
        <H2>{simple ? "実装手順書" : "詳細設計"}</H2>
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
              // Phase-28-3：更新
              // onApprove={() => void startApproval(current.stage)}
              // ↓↓
              onApprove={() => startApproval(current.stage)}
            />
          ) : null}
        </XStack>
      ) : null}

      {/* Phase-28-3:追記 */}
      <ConfirmDialog
        open={criticalLeft !== null}
        title="最重要の指摘が残っています"
        description={`最重要の未定義・要決定が ${criticalLeft ?? 0} 件残っています。このまま承認しますか?(手順書で決めず、対象の段階で直すのが原則です)`}
        confirmLabel="このまま承認する"
        onConfirm={() => {
          setCriticalLeft(null);
          void approveStage(8);
        }}
        onCancel={() => setCriticalLeft(null)}
      />

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
