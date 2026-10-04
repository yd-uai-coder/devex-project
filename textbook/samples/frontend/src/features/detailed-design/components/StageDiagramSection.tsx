// 作成：Phase-19-7
// 写経レベル: コア ── 段階3の ER の埋め込みを、記法と対象を引数にして段階4の構成図と共有する(#17)。
"use client";

import { useEffect, useState } from "react";
import { Text, YStack } from "tamagui";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { listDiagrams } from "@/features/uml/api/umlApi";
import type { NotationType, UmlDiagramRead } from "@/features/uml/api/types";
import { UmlDiagramEditor } from "@/features/uml/components/UmlDiagramEditor";
import { DIAGRAM_STATUS_LABELS } from "@/features/uml/labels";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";

// 段階の図(全体1枚)の埋め込み。段階3の ER と段階4の構成図が使う(Phase 19 で ErEditorSection から
// 共通化した。#17: 消費者は段階4の構成図)。図は uml_diagrams の行(notation と subject で選ぶ)で、
// SCR-007 のエディタ(UmlDiagramEditor)でそのまま編集・自動レイアウト・承認する。
// 図を保存・承認すると段階の検証の結果(図が未承認か)や段階の状態(承認済みなら差し戻し)が変わるので、
// 図の状態・版が変わるたびに段階の一覧を取り直す(段階2の DfdEditorTabs と同じ)。
export function StageDiagramSection({
  projectId,
  notation,
  subject,
  title,
  generating,
  onDirtyChange,
}: {
  projectId: string;
  notation: NotationType;
  subject: string;
  title: string; // 図の名前(「ER」「構成図」)
  generating: boolean; // 段階の下書きを生成中(図が上書きされるので編集させない)
  onDirtyChange: (dirty: boolean) => void;
}) {
  const fetchStages = useDetailedDesignStore((s) => s.fetchStages);
  const editing = useUmlEditorStore((s) => s.diagram);
  const editorDirty = useUmlEditorStore((s) => s.dirty);
  const [diagram, setDiagram] = useState<UmlDiagramRead | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // 英字で終わる名前(ER)は、後ろの文と半角の空白で区切る
  const name = /[A-Za-z0-9]$/.test(title) ? `${title} ` : title;

  useEffect(() => {
    if (generating) return;
    let active = true;
    listDiagrams(projectId)
      .then((items) => {
        if (!active) return;
        setDiagram(items.find((d) => d.notation === notation && d.subject === subject) ?? null);
      })
      .catch(() => {
        if (active) setError(`${name}を読み込めませんでした。`);
      });
    return () => {
      active = false;
    };
  }, [projectId, generating, notation, subject, name]);

  const editingThis = editing !== null && diagram != null && editing.id === diagram.id;
  const dirty = editingThis && editorDirty;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // 開いている図の状態・版が変わったら(保存・自動レイアウト・承認)、段階の一覧を取り直す
  const editingStatus = editingThis ? editing.status : null;
  const editingVersion = editingThis ? editing.version : null;
  useEffect(() => {
    if (editingStatus !== null) void fetchStages(projectId);
  }, [editingStatus, editingVersion, fetchStages, projectId]);

  const status = editingThis ? editing.status : diagram?.status;

  return (
    <YStack gap="$2">
      <Text fontWeight="700">
        {title}
        {status ? `(${DIAGRAM_STATUS_LABELS[status]})` : ""}
      </Text>
      {error ? (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      ) : null}
      {generating ? (
        <Text color="$color11">下書きを生成しています。終わるまで {name}は編集できません。</Text>
      ) : diagram === undefined ? (
        error ? null : <Text color="$color11">読み込み中...</Text>
      ) : diagram ? (
        <UmlDiagramEditor key={diagram.id} projectId={projectId} diagramId={diagram.id} />
      ) : (
        <Text color="$color11">{name}はまだありません。下書きを生成すると作られます。</Text>
      )}
    </YStack>
  );
}
