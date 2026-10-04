// 作成：Phase-18-9
// 写経レベル: コア ── SCR-007 のエディタを埋め込み、図の状態の変化で段階を取り直す(段階2の DfdEditorTabs と同じ形)。
"use client";

import { useEffect, useState } from "react";
import { Text, YStack } from "tamagui";
import { ER_SUBJECT } from "@/features/detailed-design/api/types";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { listDiagrams } from "@/features/uml/api/umlApi";
import type { UmlDiagramRead } from "@/features/uml/api/types";
import { UmlDiagramEditor } from "@/features/uml/components/UmlDiagramEditor";
import { DIAGRAM_STATUS_LABELS } from "@/features/uml/labels";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";

// 段階3の ER(全体1枚)。ER は uml_diagrams の行(notation=er、subject='')で、SCR-007 のエディタ
// (UmlDiagramEditor)でそのまま編集・自動レイアウト・承認する。テーブル定義の制約・説明も、
// このエディタの属性パネルで直す(テーブル定義の正本は ER。Phase 18)。
// ER を保存・承認すると段階3の検証の結果(ER が未承認か)や段階3の状態(承認済みなら差し戻し)が
// 変わるので、図の状態・版が変わるたびに段階の一覧を取り直す(段階2の DfdEditorTabs と同じ)。
export function ErEditorSection({
  projectId,
  generating,
  onDirtyChange,
}: {
  projectId: string;
  generating: boolean; // 段階3の下書きを生成中(ER が上書きされるので編集させない)
  onDirtyChange: (dirty: boolean) => void;
}) {
  const fetchStages = useDetailedDesignStore((s) => s.fetchStages);
  const editing = useUmlEditorStore((s) => s.diagram);
  const editorDirty = useUmlEditorStore((s) => s.dirty);
  const [diagram, setDiagram] = useState<UmlDiagramRead | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (generating) return;
    let active = true;
    listDiagrams(projectId)
      .then((items) => {
        if (!active) return;
        setDiagram(items.find((d) => d.notation === "er" && d.subject === ER_SUBJECT) ?? null);
      })
      .catch(() => {
        if (active) setError("ER を読み込めませんでした。");
      });
    return () => {
      active = false;
    };
  }, [projectId, generating]);

  const editingThis = editing !== null && diagram != null && editing.id === diagram.id;
  const dirty = editingThis && editorDirty;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // 開いている ER の状態・版が変わったら(保存・自動レイアウト・承認)、段階の一覧を取り直す
  const editingStatus = editingThis ? editing.status : null;
  const editingVersion = editingThis ? editing.version : null;
  useEffect(() => {
    if (editingStatus !== null) void fetchStages(projectId);
  }, [editingStatus, editingVersion, fetchStages, projectId]);

  const status = editingThis ? editing.status : diagram?.status;

  return (
    <YStack gap="$2">
      <Text fontWeight="700">
        ER{status ? `(${DIAGRAM_STATUS_LABELS[status]})` : ""}
      </Text>
      {error ? (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      ) : null}
      {generating ? (
        <Text color="$color11">下書きを生成しています。終わるまで ER は編集できません。</Text>
      ) : diagram === undefined ? (
        error ? null : <Text color="$color11">読み込み中...</Text>
      ) : diagram ? (
        <UmlDiagramEditor key={diagram.id} projectId={projectId} diagramId={diagram.id} />
      ) : (
        <Text color="$color11">ER はまだありません。下書きを生成すると作られます。</Text>
      )}
    </YStack>
  );
}
