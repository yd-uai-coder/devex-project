// 作成：Phase-23-6
// 写経レベル: 定型 ── 段階4の StructurePanel と同じ形の配線。
"use client";

import { useEffect, useState } from "react";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import type { DesignStageRead, PlanModel } from "@/features/detailed-design/api/types";
import {
  CrossCuttingTable,
  MilestoneList,
  RiskTable,
} from "@/features/detailed-design/components/PlanTables";
import { StageIssueList } from "@/features/detailed-design/components/StageIssueList";
import { StageSaveBar } from "@/features/detailed-design/components/StageSaveBar";
import { INPUT } from "@/features/detailed-design/components/tableStyles";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { useStageGenerationPolling } from "@/features/detailed-design/hooks/useStageGenerationPolling";
import { hasPlanDraft, toPlan } from "@/features/detailed-design/planOps";

// 段階7(横断事項と実装計画)の作業領域の中身。AIの下書きの生成、07 横断事項・マイルストーンとタスク・
// 開発環境・リスクの編集、検証の結果、保存を持つ。編集中の内容はこのコンポーネントの中だけに持ち、
// 保存して初めてサーバーへ送る(段階4の StructurePanel と同じ形。Phase 23)。下書きは、要件定義・
// 外部設計と、段階1〜6から組み立てた詳細設計書を入力に作る(作り直しは全体の置き換え)。
export function PlanPanel({
  projectId,
  stage,
  onDirtyChange,
}: {
  projectId: string;
  stage: DesignStageRead;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const saving = useDetailedDesignStore((s) => s.saving);
  const requestingGeneration = useDetailedDesignStore((s) => s.requestingGeneration);
  const save = useDetailedDesignStore((s) => s.save);
  const generate = useDetailedDesignStore((s) => s.generate);

  const saved = toPlan(stage.model);
  const [draft, setDraft] = useState<PlanModel>(saved);
  const [confirming, setConfirming] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const generating = stage.generation_status === "generating";
  const { timedOut } = useStageGenerationPolling(projectId, generating);
  const regenerating = hasPlanDraft(saved);
  const disabled = !stage.is_open;

  const startGeneration = () => {
    setConfirming(false);
    void generate(projectId, stage.stage);
  };
  const saveBar = (
    <StageSaveBar
      dirty={dirty}
      saving={saving}
      disabled={generating || disabled}
      onSave={() => void save(projectId, stage.stage, draft)}
    />
  );

  return (
    <YStack gap="$4">
      {saveBar}

      <YStack gap="$2">
        <XStack gap="$3" alignItems="center" flexWrap="wrap">
          <StyledButton
            disabled={disabled || generating || requestingGeneration || dirty}
            onPress={() => (regenerating ? setConfirming(true) : startGeneration())}
          >
            {generating ? "生成中" : regenerating ? "下書きを作り直す" : "下書きを生成する"}
          </StyledButton>
          <Text color="$color11" fontSize="$2">
            {dirty
              ? "保存するか、編集を元に戻してから生成してください。"
              : "要件定義・外部設計と、段階1〜6から組み立てた詳細設計書をもとに、AI が横断事項と実装計画を下書きします。"}
          </Text>
        </XStack>
        {generating && timedOut ? (
          <Text role="status" color="$color11">
            生成に時間がかかっています。しばらくしてから画面を読み込み直してください。
          </Text>
        ) : null}
        {stage.generation_status === "failed" && stage.generation_error ? (
          <Text role="alert" color="$red10">
            {stage.generation_error}
          </Text>
        ) : null}
      </YStack>

      <ConfirmDialog
        open={confirming}
        title="下書きを作り直しますか?"
        description={
          <>
            AI が横断事項と実装計画を作り直します。手直しした内容は失われます。
            {stage.state === "approved" || stage.state === "outdated"
              ? "段階の承認もやり直しになります。"
              : ""}
          </>
        }
        confirmLabel="作り直す"
        onConfirm={startGeneration}
        onCancel={() => setConfirming(false)}
      />

      {generating ? (
        <Text role="status" color="$color11">
          横断事項と実装計画: 生成中
        </Text>
      ) : (
        <>
          <CrossCuttingTable model={draft} disabled={disabled} onChange={setDraft} />
          <MilestoneList model={draft} disabled={disabled} onChange={setDraft} />
          <YStack gap="$2">
            <Text fontWeight="700">開発環境・事前準備</Text>
            <Paragraph color="$color11" fontSize="$2">
              ツール・リポジトリ構成・自動テストと CI/CD の方針などを書きます。
            </Paragraph>
            <textarea
              style={INPUT}
              rows={4}
              aria-label="開発環境・事前準備"
              value={draft.environment}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, environment: e.target.value })}
            />
          </YStack>
          <RiskTable model={draft} disabled={disabled} onChange={setDraft} />
        </>
      )}

      {saveBar}

      <StageIssueList issues={stage.issues} />
    </YStack>
  );
}
