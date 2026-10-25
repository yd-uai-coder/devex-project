// 作成：Phase-23-6｜更新：Phase-109-1
// 写経レベル: 定型 ── 段階4の StructurePanel と同じ形の配線。
"use client";

// Phase-109-1:追記 ── @/features/detailed-design/components/StrayFunctionTable.StrayFunctionTable, @/features/detailed-design/functionListOps.toFunctionList, @/features/detailed-design/planOps.reassignTaskFunction, @/features/detailed-design/planOps.removeStrayTaskFunctions, @/features/detailed-design/planOps.removeTaskFunction, @/features/detailed-design/planOps.strayTaskFunctions, @/features/detailed-design/planOps.taskFunctionTargets
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
import { StrayFunctionTable } from "@/features/detailed-design/components/StrayFunctionTable";
import { INPUT } from "@/features/detailed-design/components/tableStyles";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { toFunctionList } from "@/features/detailed-design/functionListOps";
import { useStageGenerationPolling } from "@/features/detailed-design/hooks/useStageGenerationPolling";
import {
  hasPlanDraft,
  reassignTaskFunction,
  removeStrayTaskFunctions,
  removeTaskFunction,
  strayTaskFunctions,
  taskFunctionTargets,
  toPlan,
} from "@/features/detailed-design/planOps";

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
  // Phase-109-1:追記
  const stage1Model = useDetailedDesignStore(
    (s) => s.stages.find((item) => item.stage === 1)?.model ?? null,
  );

  // Phase-109-1:追記
  const functionList = toFunctionList(stage1Model);
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
  // Phase-109-1:追記
  const strays = strayTaskFunctions(draft, functionList);
  // 一覧の行の key(タスクの位置と処理 ID)から、行を引き直す
  const strayOf = (key: string) => strays.find((s) => `${s.milestone}:${s.task}:${s.functionId}` === key);

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
          {/* Phase-109-1:追記 */}
          {/* 段階1 の作り直しで処理 ID が変わって残ったタスクの処理(付け替えるか、処理 ID だけ外す) */}
          <StrayFunctionTable
            title="機能一覧に無い処理を持つタスク"
            description="段階1 の処理 ID が変わったため、どの処理とも合わない処理 ID を持つタスクです。このままでは承認できません。今の処理へ付け替えるか、処理 ID を外してください(タスクは残ります)。変更は保存して反映されます。"
            detailHead="タスク"
            rows={strays.map((stray) => ({
              key: `${stray.milestone}:${stray.task}:${stray.functionId}`,
              functionId: stray.functionId,
              detail: stray.taskLabel,
              targets: taskFunctionTargets(draft, functionList, stray.milestone, stray.task),
            }))}
            removeLabel="外す"
            removeAllLabel="機能一覧に無い処理 ID をすべて外す"
            disabled={disabled}
            onReassign={(key, functionId) => {
              const stray = strayOf(key);
              if (stray) setDraft(reassignTaskFunction(draft, stray.milestone, stray.task, stray.functionId, functionId));
            }}
            onRemove={(key) => {
              const stray = strayOf(key);
              if (stray) setDraft(removeTaskFunction(draft, stray.milestone, stray.task, stray.functionId));
            }}
            onRemoveAll={() => setDraft(removeStrayTaskFunctions(draft, functionList))}
          />
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
