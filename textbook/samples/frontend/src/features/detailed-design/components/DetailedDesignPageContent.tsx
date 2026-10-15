// 作成：Phase-15-7｜更新：Phase-16-6,18-9,22-6,27-3,28-3,31-5,44-2,46-3,53-4,53-5,54-1,54-3,57-3,57(完了後の調整)
// 写経レベル: 定型 ── ストアと部品の配線。
"use client";

// Phase-18-9:追記 ── react.useState, @/components/ui/layout-blocks/ConfirmDialog.ConfirmDialog, @/features/detailed-design/labels.STAGE_TITLES
// Phase-22-6:追記 ── @/features/detailed-design/components/DesignDocumentBar.DesignDocumentBar
// Phase-44-2:追記 ── @/features/detailed-design/components/ChangeImpactPanel.ChangeImpactPanel
// Phase-53-4:追記 ── @/features/design-review/components/ReviewPanel.ReviewPanel, @/features/design-review/model.TargetActionOf, @/features/detailed-design/impactOps.locateTargetStage
// Phase-53-5:追記 ── tamagui.Button, @/features/design-review/api/reviewApi.ReviewGate, @/features/design-review/model.GATE_LABEL, @/features/design-review/review-store.useReviewStore
// Phase-54-1:追記 ── @/features/design-review/model.unaddressedNotice, @/features/detailed-design/components/StageSendbackPanel.StageSendbackPanel
// Phase-57-3:追記 ── tamagui.H3, @/features/documents/components/TestSpecPanel.TestSpecPanel, @/features/documents/test-spec-store.useTestSpecStore, @/features/documents/testSpecOps(testSpecReadiness, testSpecStatus, zipTestSpecNote), @/hooks/useGenerationPolling.useGenerationPolling
// Phase-57(完了後の調整):追記 ── @/features/documents/testSpecOps.TEST_SPEC_TITLE
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, H2, H3, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { ReviewPanel } from "@/features/design-review/components/ReviewPanel";
import type { ReviewGate } from "@/features/design-review/api/reviewApi";
// Phase-54-1：更新
// import { GATE_LABEL } from "@/features/design-review/model";
// ↓↓
import { GATE_LABEL, unaddressedNotice } from "@/features/design-review/model";
import type { TargetActionOf } from "@/features/design-review/model";
import { useReviewStore } from "@/features/design-review/review-store";
import { ChangeImpactPanel } from "@/features/detailed-design/components/ChangeImpactPanel";
import { DesignDocumentBar } from "@/features/detailed-design/components/DesignDocumentBar";
// Phase-54-1:追記
import { StageSendbackPanel } from "@/features/detailed-design/components/StageSendbackPanel";
import { StageStepper } from "@/features/detailed-design/components/StageStepper";
import { StageWorkArea } from "@/features/detailed-design/components/StageWorkArea";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { locateTargetStage } from "@/features/detailed-design/impactOps";
import { STAGE_TITLES } from "@/features/detailed-design/labels";
// Phase-28-3:追記
import { criticalCount } from "@/features/detailed-design/procedureDocOps";
import { TestSpecPanel } from "@/features/documents/components/TestSpecPanel";
import { useTestSpecStore } from "@/features/documents/test-spec-store";
import {
  TEST_SPEC_TITLE,
  testSpecReadiness,
  testSpecStatus,
  zipTestSpecNote,
} from "@/features/documents/testSpecOps";
import { useGenerationPolling } from "@/hooks/useGenerationPolling";

// Phase-27-3：更新(段階1〜7 → 段階1〜8)
// 詳細設計画面(SCR-008)。左に段階1〜8のステッパー、右に選んだ段階の作業領域を置く
// Phase-31-5：更新
// // (docs/external_design.md 2.7節「段階の進め方」)。
// ↓↓
// (docs/external_design.md 2.7節「段階の進め方」)。簡易ドキュメントモードのプロジェクトは段階8
// (実装手順書)だけを持ち、同じ画面を段階8だけのステッパーで開く(見出しは「実装手順書」)。
// Phase-57-3:追記
// 詳細設計モードは、ステッパーの段階8の下の「テスト仕様書」を選ぶと、作業領域にテスト仕様書を出す
// (段階1・段階7 の承認の後に作る。簡易モードのテスト仕様書はプレビューのタブに出す)。
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
  // Phase-53-4:追記
  const jumpTo = useDetailedDesignStore((s) => s.jumpTo);
  // Phase-53-5:追記
  const reviewEffective = useReviewStore((s) => s.me?.review_effective ?? false);
  const runReview = useReviewStore((s) => s.runReview);
  // Phase-54-1:追記
  const reviewGates = useReviewStore((s) => s.gates);
  // Phase-18-9:追記
  // 承認を終えた段階(完了のダイアログを出している間だけ値を持つ。Phase 18)
  const [approvedStage, setApprovedStage] = useState<number | null>(null);
  // Phase-28-3:追記
  // 最重要の指摘が残ったまま承認しようとしている段階8の、最重要の数(確認を出している間だけ値を持つ)
  const [criticalLeft, setCriticalLeft] = useState<number | null>(null);
  // Phase-57-3:追記
  // 作業領域にテスト仕様書を出しているか(段階を選ぶと段階に戻る)
  const [showTestSpec, setShowTestSpec] = useState(false);
  const testSpec = useTestSpecStore((s) => s.testSpec);
  const testSpecLoading = useTestSpecStore((s) => s.status === "loading");
  const generatingTestSpec = useTestSpecStore((s) => s.generating);
  const testSpecError = useTestSpecStore((s) => s.generateError);
  const fetchTestSpec = useTestSpecStore((s) => s.fetchTestSpec);
  const generateTestSpec = useTestSpecStore((s) => s.generate);
  const onTestSpecGenerated = useTestSpecStore((s) => s.onGenerated);

  useEffect(() => {
    void fetchStages(projectId);
  }, [projectId, fetchStages]);

  const current = stages.find((s) => s.stage === selectedStage);
  // Phase-18-9:追記
  // Phase-31-5:追記
  const simple = stages[0]?.mode === "simple";
  // Phase-57-3:追記
  const detailed = stages[0]?.mode === "detailed";
  const choose = (stage: number) => {
    setShowTestSpec(false);
    selectStage(stage);
  };
  const nextStage =
    approvedStage !== null && stages.some((s) => s.stage === approvedStage + 1)
      ? approvedStage + 1
      : null;

  // Phase-53-4:追記
  // レビューの指摘の対象から、それを載せている段階の表へ移る(要件 ID・画面など、段階に無い対象は押せない)
  const targetAction: TargetActionOf = (target) => {
    const stage = locateTargetStage(target, stages);
    // Phase-57-3：更新
    // return stage === null ? null : { label: `段階${stage}で見る`, onPress: () => jumpTo(stage, target) };
    // ↓↓
    return stage === null
      ? null
      : {
          label: `段階${stage}で見る`,
          onPress: () => {
            setShowTestSpec(false);
            jumpTo(stage, target);
          },
        };
  };
  // 段階の承認・文書の版が変わったら、レビューの区切りを取り直す
  const stagesKey = stages.map((s) => `${s.stage}:${s.state}:${s.approved_version ?? ""}`).join(",");
  // Phase-57-3:追記
  // テスト仕様書(詳細設計モードだけ)。段階の承認が変わると「古い」も変わりうるので取り直す
  useEffect(() => {
    if (detailed) void fetchTestSpec(projectId);
  }, [detailed, stagesKey, projectId, fetchTestSpec]);
  useGenerationPolling(projectId, generatingTestSpec, () => onTestSpecGenerated(projectId));

  // Phase-53-5:追記
  // 段階6・7を承認したら、承認のダイアログから区切りのレビューを流せる(レビューがオンのときだけ)
  const reviewGate: ReviewGate | null =
    reviewEffective && !simple ? (approvedStage === 6 ? "stage6" : approvedStage === 7 ? "stage7" : null) : null;

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
      {/* Phase-57-3：更新
      {stages.length > 0 ? <DesignDocumentBar projectId={projectId} stages={stages} /> : null}
      ↓↓ */}
      {stages.length > 0 ? (
        <DesignDocumentBar
          projectId={projectId}
          stages={stages}
          testSpecNote={detailed ? zipTestSpecNote(testSpec) : null}
        />
      ) : null}

      {/* Phase-44-2:追記 */}
      {/* Phase-46-3：更新
      変更の影響(印も変わったものも無ければ出さない。簡易モードは印が無い)
      {stages.length > 0 && !simple ? <ChangeImpactPanel projectId={projectId} /> : null}
      ↓↓ */}
      {/* 変更の影響(印も変わったものも無ければ出さない。簡易モードは文書の変更から段階8の単位に印) */}
      {stages.length > 0 ? <ChangeImpactPanel projectId={projectId} /> : null}

      {/* Phase-53-4:追記 */}
      {/* AI 設計レビュー(superuser だけ。詳細は文書・段階6・段階7、簡易は文書の区切り) */}
      {stages.length > 0 ? (
        <ReviewPanel projectId={projectId} targetAction={targetAction} refreshKey={stagesKey} />
      ) : null}
      // Phase-54-1:追記
      {/* 差し戻し: 段階6・7 の採用した指摘で段階を作り直す(レビューがオンで、採用した指摘があるときだけ) */}
      {stages.length > 0 && !simple ? <StageSendbackPanel projectId={projectId} /> : null}

      {stages.length > 0 ? (
        <XStack gap="$5" alignItems="flex-start" flexWrap="wrap">
          <StageStepper
            stages={stages}
            selectedStage={selectedStage}
            // Phase-57-3：更新
            // onSelect={selectStage}
            // ↓↓
            onSelect={choose}
            testSpec={
              detailed
                ? {
                    status: testSpecStatus(testSpec),
                    selected: showTestSpec,
                    onSelect: () => setShowTestSpec(true),
                  }
                : undefined
            }
          />
          {/* Phase-57-3：更新
          {current ? (
          ↓↓ */}
          {detailed && showTestSpec ? (
            <YStack flex={1} gap="$3">
              {/* Phase-57(完了後の調整)：更新
              <H3>テスト仕様書</H3>
              ↓↓ */}
              <H3>{TEST_SPEC_TITLE}</H3>
              <TestSpecPanel
                projectId={projectId}
                testSpec={testSpec}
                loading={testSpecLoading}
                generating={generatingTestSpec}
                generateError={testSpecError}
                readiness={testSpecReadiness(stages)}
                emptyNotice="段階1(機能一覧)と段階7(横断事項と実装計画)を承認した後に、要件定義書・外部設計書と段階の処理・単位から、結合テスト(API)と総合テスト(画面の流れ・非機能)の仕様書を作ります。"
                onGenerate={() => void generateTestSpec(projectId)}
              />
            </YStack>
          ) : current ? (
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
          // Phase-53-5：更新
          // approvedStage !== null
          //   ? `段階${approvedStage}-${STAGE_TITLES[approvedStage] ?? ""}を承認しました。`
          //   : ""
          // ↓↓
          approvedStage !== null ? (
            // 説明は段落の中に出るので、ブロック要素(XStack など)を入れない
            <>
              {`段階${approvedStage}-${STAGE_TITLES[approvedStage] ?? ""}を承認しました。`}
              // Phase-54-1:追記
              {/* 段階6・7 の承認では、採用したまま直していない指摘を知らせる(止めはしない) */}
              {reviewEffective && (approvedStage === 6 || approvedStage === 7) && unaddressedNotice(reviewGates)
                ? ` ${unaddressedNotice(reviewGates)}`
                : null}
              {/* Phase-57-3:追記 */}
              {/* 段階7 の承認の後は、テスト仕様書を作れる(段階1も承認済みのとき) */}
              {approvedStage === 7 && detailed ? (
                <>
                  {" テスト仕様書を作れます。 "}
                  <Button
                    size="$2"
                    aria-label="テスト仕様書を開く"
                    onPress={() => {
                      setShowTestSpec(true);
                      setApprovedStage(null);
                    }}
                  >
                    テスト仕様書へ
                  </Button>
                </>
              ) : null}
              {reviewGate !== null ? (
                <>
                  {reviewGate === "stage6"
                    ? " 要件・外部と詳細設計書を AI 設計レビューにかけられます。 "
                    : " 要件・外部・詳細設計書と実装計画書を AI 設計レビューにかけられます。 "}
                  <Button
                    size="$2"
                    aria-label={`${GATE_LABEL[reviewGate]}のレビューをする`}
                    onPress={() => {
                      void runReview(projectId, reviewGate);
                      setApprovedStage(null);
                    }}
                  >
                    AI 設計レビューをする
                  </Button>
                </>
              ) : null}
            </>
          ) : (
            ""
          )
        }
        confirmLabel={nextStage !== null ? "次の段階へ進む" : "閉じる"}
        cancelLabel={nextStage !== null ? "閉じる" : null}
        onConfirm={() => {
          // Phase-57-3：更新
          // if (nextStage !== null) selectStage(nextStage);
          // ↓↓
          if (nextStage !== null) choose(nextStage);
          setApprovedStage(null);
        }}
        onCancel={() => setApprovedStage(null)}
      />
    </YStack>
  );
}
