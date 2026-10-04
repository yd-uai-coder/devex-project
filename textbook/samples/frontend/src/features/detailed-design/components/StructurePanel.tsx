// 作成：Phase-19-7
// 写経レベル: コア ── モジュール一覧だけを段階の model として保存し、構成図の未保存の編集も段階の dirty に含めること。
"use client";

import { useEffect, useState } from "react";
import { Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import {
  STRUCTURE_SUBJECT,
  type DesignStageRead,
  type ModuleListModel,
} from "@/features/detailed-design/api/types";
import { ModuleListTable } from "@/features/detailed-design/components/ModuleListTable";
import { StageDiagramSection } from "@/features/detailed-design/components/StageDiagramSection";
import { StageIssueList } from "@/features/detailed-design/components/StageIssueList";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { useStageGenerationPolling } from "@/features/detailed-design/hooks/useStageGenerationPolling";
import {
  componentLayers,
  hasModuleDraft,
  toModuleList,
} from "@/features/detailed-design/moduleListOps";
import type { ComponentSemanticModel } from "@/features/uml/api/types";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";

// 段階4(ソフトウェア構造)の作業領域の中身。AIの下書きの生成、構成図(SCR-007 のエディタ)、モジュール
// 一覧の編集、検証の結果、保存を持つ。構成図は段階の model の外(uml_diagrams)に正本があり、図の
// エディタが自分で保存する。この部品の「保存する」はモジュール一覧だけを保存する。編集中の内容は
// このコンポーネントの中だけに持ち、保存して初めてサーバーへ送る(段階3の DataModelPanel と同じ形。
// Phase 19)。
export function StructurePanel({
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
  // モジュール一覧の層の選択肢は、構成図のエディタで編集中の内容から作る(保存前の手直しもすぐ出す)
  const componentModel = useUmlEditorStore((s) =>
    s.diagram?.notation === "component" && s.model?.notation === "component"
      ? (s.model as ComponentSemanticModel)
      : null,
  );

  const saved = toModuleList(stage.model);
  const [draft, setDraft] = useState<ModuleListModel>(saved);
  const [confirming, setConfirming] = useState(false);
  // 構成図のエディタに保存していない編集があるか(段階の承認は、保存した構成図を前提にするため)
  const [diagramDirty, setDiagramDirty] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    onDirtyChange(dirty || diagramDirty);
  }, [dirty, diagramDirty, onDirtyChange]);

  const generating = stage.generation_status === "generating";
  const { timedOut } = useStageGenerationPolling(projectId, generating);
  const regenerating = hasModuleDraft(saved);

  const startGeneration = () => {
    setConfirming(false);
    void generate(projectId, stage.stage);
  };

  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <XStack gap="$3" alignItems="center" flexWrap="wrap">
          <StyledButton
            disabled={!stage.is_open || generating || requestingGeneration || dirty}
            onPress={() => (regenerating ? setConfirming(true) : startGeneration())}
          >
            {generating ? "生成中" : regenerating ? "下書きを作り直す" : "下書きを生成する"}
          </StyledButton>
          <Text color="$color11" fontSize="$2">
            {dirty
              ? "モジュール一覧を保存するか、編集を元に戻してから生成してください。"
              : "技術スタック・機能一覧・データモデルから、AI が構成図とモジュール一覧を下書きします。"}
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
            AI が構成図とモジュール一覧を作り直します。構成図とモジュール一覧の手直しは失われ、構成図の承認も
            やり直しになります。
            {stage.state === "approved" || stage.state === "outdated"
              ? "段階の承認もやり直しになります。"
              : ""}
          </>
        }
        confirmLabel="作り直す"
        onConfirm={startGeneration}
        onCancel={() => setConfirming(false)}
      />

      <StageDiagramSection
        projectId={projectId}
        notation="component"
        subject={STRUCTURE_SUBJECT}
        title="構成図"
        generating={generating}
        onDirtyChange={setDiagramDirty}
      />

      {generating ? (
        <Text role="status" color="$color11">
          モジュール一覧: 生成中
        </Text>
      ) : (
        <ModuleListTable
          layers={componentLayers(componentModel)}
          model={draft}
          disabled={!stage.is_open}
          onChange={setDraft}
        />
      )}

      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <StyledButton
          disabled={!dirty || saving || generating || !stage.is_open}
          onPress={() => void save(projectId, stage.stage, draft)}
        >
          {saving ? "保存しています..." : "モジュール一覧を保存する"}
        </StyledButton>
        {dirty ? (
          <Text color="$color11" fontSize="$2">
            保存していない編集があります。
          </Text>
        ) : null}
      </XStack>

      <StageIssueList issues={stage.issues} />
    </YStack>
  );
}
