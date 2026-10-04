// 作成：Phase-18-9
// 写経レベル: コア ── CRUD 図だけを段階の model として保存し、ER の未保存の編集も段階の dirty に含めること。
"use client";

import { useEffect, useState } from "react";
import { Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import type { CrudModel, DesignStageRead } from "@/features/detailed-design/api/types";
import { CrudMatrix } from "@/features/detailed-design/components/CrudMatrix";
import { ErEditorSection } from "@/features/detailed-design/components/ErEditorSection";
import { StageIssueList } from "@/features/detailed-design/components/StageIssueList";
import { TableDefinitionTable } from "@/features/detailed-design/components/TableDefinitionTable";
import { crudTables, hasCrudDraft, toCrud } from "@/features/detailed-design/crudOps";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { toFunctionList } from "@/features/detailed-design/functionListOps";
import { useStageGenerationPolling } from "@/features/detailed-design/hooks/useStageGenerationPolling";
import type { ErSemanticModel } from "@/features/uml/api/types";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";

// 段階3(データモデル)の作業領域の中身。AIの下書きの生成、ER(SCR-007 のエディタ)、テーブル定義の表、
// CRUD 図の編集、検証の結果、保存を持つ。ER とテーブル定義は段階の model の外(uml_diagrams)に
// 正本があり、ER のエディタが自分で保存する。この部品の「保存する」は CRUD 図だけを保存する。
// 入力の段階1(承認済みの機能一覧)はストアの段階の一覧から読む。編集中の内容はこのコンポーネントの
// 中だけに持ち、保存して初めてサーバーへ送る(保存・生成のたびに呼び出し元が key を変えて作り直す。
// 段階1・2のパネルと同じ形。Phase 18)。
export function DataModelPanel({
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
  const stage1Model = useDetailedDesignStore(
    (s) => s.stages.find((item) => item.stage === 1)?.model ?? null,
  );
  const save = useDetailedDesignStore((s) => s.save);
  const generate = useDetailedDesignStore((s) => s.generate);
  // テーブル定義と CRUD 図の列は、ER のエディタで編集中の内容から作る(保存前の手直しもすぐ出す)
  const erModel = useUmlEditorStore((s) =>
    s.diagram?.notation === "er" && s.model?.notation === "er" ? (s.model as ErSemanticModel) : null,
  );

  const functionList = toFunctionList(stage1Model);
  const saved = toCrud(stage.model);
  const [draft, setDraft] = useState<CrudModel>(saved);
  const [confirming, setConfirming] = useState(false);
  // ER のエディタに保存していない編集があるか(段階の承認は、保存した ER を前提にするため)
  const [erDirty, setErDirty] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    onDirtyChange(dirty || erDirty);
  }, [dirty, erDirty, onDirtyChange]);

  const generating = stage.generation_status === "generating";
  const { timedOut } = useStageGenerationPolling(projectId, generating);
  const regenerating = hasCrudDraft(saved);
  const tables = crudTables(erModel?.elements.map((table) => table.name) ?? [], draft);

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
            {generating
              ? "生成中"
              : regenerating
                ? "下書きを作り直す"
                : "下書きを生成する"}
          </StyledButton>
          <Text color="$color11" fontSize="$2">
            {dirty
              ? "CRUD 図を保存するか、編集を元に戻してから生成してください。"
              : "DFD とデータ辞書から、AI が ER(テーブル定義を含む)と CRUD 図を下書きします。"}
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
            AI が ER と CRUD 図を作り直します。ER の手直しと CRUD 図で確定したセルは失われ、ER の承認も
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

      <ErEditorSection projectId={projectId} generating={generating} onDirtyChange={setErDirty} />

      {generating ? null : <TableDefinitionTable model={erModel} />}

      {generating ? (
        <Text color="$color11">CRUD 図: 生成中</Text>
      ) : (
        <CrudMatrix
          functions={functionList.functions}
          tables={tables}
          model={draft}
          accesses={stage.dfd_accesses}
          disabled={!stage.is_open}
          onChange={setDraft}
        />
      )}

      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <StyledButton
          disabled={!dirty || saving || generating || !stage.is_open}
          onPress={() => void save(projectId, stage.stage, draft)}
        >
          {saving ? "保存しています..." : "CRUD 図を保存する"}
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
