// 作成：Phase-17-7
// 写経レベル: コア ── 単一のエディタのストアで1枚ずつ開くこと、図の状態の変化で段階を取り直すこと。
"use client";

import { useEffect, useState } from "react";
import { Text, XStack, YStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { listDiagrams } from "@/features/uml/api/umlApi";
import type { UmlDiagramRead } from "@/features/uml/api/types";
import { UmlDiagramEditor } from "@/features/uml/components/UmlDiagramEditor";
import { DIAGRAM_STATUS_LABELS } from "@/features/uml/labels";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";

// タブを切り替えると、保存していない DFD の編集は失われる(エディタのストアは1つだけのため)
const SWITCH_CONFIRM = "保存していない DFD の編集は失われます。切り替えますか?";

// 段階2の、機能グループごとの DFD のタブ。DFD は uml_diagrams の行(notation=dfd、subject=機能グループ名)
// で、SCR-007 のエディタ(UmlDiagramEditor)でそのまま編集・自動レイアウト・承認する。
// エディタのストアは1つだけなので、開くのは選んだタブの1枚だけにする。
// DFD を保存・承認すると段階2の検証の結果(DFD が未承認か)や段階2の状態(承認済みなら差し戻し)が
// 変わるので、図の状態・版が変わるたびに段階の一覧を取り直す。
export function DfdEditorTabs({
  projectId,
  groups,
  generating,
  onDirtyChange,
}: {
  projectId: string;
  groups: string[]; // 保存済みの DFD を描くグループ(未保存の選択は含めない)
  generating: boolean; // 段階2の下書きを生成中(DFD が上書きされるので編集させない)
  onDirtyChange: (dirty: boolean) => void;
}) {
  const fetchStages = useDetailedDesignStore((s) => s.fetchStages);
  const editing = useUmlEditorStore((s) => s.diagram);
  const editorDirty = useUmlEditorStore((s) => s.dirty);
  const [diagrams, setDiagrams] = useState<UmlDiagramRead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(groups[0] ?? null);

  useEffect(() => {
    if (generating) return;
    let active = true;
    listDiagrams(projectId)
      .then((items) => {
        if (active) setDiagrams(items.filter((d) => d.notation === "dfd"));
      })
      .catch(() => {
        if (active) setError("DFD の一覧を読み込めませんでした。");
      });
    return () => {
      active = false;
    };
  }, [projectId, generating]);

  const current = selected !== null && groups.includes(selected) ? selected : (groups[0] ?? null);
  const diagram = diagrams?.find((d) => d.subject === current) ?? null;
  const editingThis = editing !== null && editing.id === diagram?.id;
  const dirty = editingThis && editorDirty;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // 開いている DFD の状態・版が変わったら(保存・自動レイアウト・承認)、段階の一覧を取り直す
  const editingStatus = editingThis ? editing.status : null;
  const editingVersion = editingThis ? editing.version : null;
  useEffect(() => {
    if (editingStatus !== null) void fetchStages(projectId);
  }, [editingStatus, editingVersion, fetchStages, projectId]);

  if (groups.length === 0) return null;

  const statusOf = (group: string) => {
    const found = diagrams?.find((d) => d.subject === group);
    if (!found) return "未生成";
    if (editing !== null && editing.id === found.id) return DIAGRAM_STATUS_LABELS[editing.status];
    return DIAGRAM_STATUS_LABELS[found.status];
  };

  return (
    <YStack gap="$2">
      <Text fontWeight="700">機能グループの DFD</Text>
      <XStack gap="$2" flexWrap="wrap" role="tablist" aria-label="機能グループの DFD">
        {groups.map((group) => (
          <StyledButton
            key={group}
            size="$3"
            role="tab"
            aria-selected={group === current}
            theme={group === current ? undefined : "gray"}
            onPress={() => {
              if (group === current) return;
              if (dirty && !window.confirm(SWITCH_CONFIRM)) return;
              setSelected(group);
            }}
          >
            {`${group}(${statusOf(group)})`}
          </StyledButton>
        ))}
      </XStack>
      {error ? (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      ) : null}
      {generating ? (
        <Text color="$color11">下書きを生成しています。終わるまで DFD は編集できません。</Text>
      ) : diagrams === null ? (
        <Text color="$color11">読み込み中...</Text>
      ) : diagram ? (
        <UmlDiagramEditor key={diagram.id} projectId={projectId} diagramId={diagram.id} />
      ) : (
        <Text color="$color11">
          「{current}」の DFD はまだありません。下書きを生成すると作られます。
        </Text>
      )}
    </YStack>
  );
}
