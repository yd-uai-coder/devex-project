// 作成：Phase-11-5｜更新：Phase-11-6,12-5,17-7
// 写経レベル: 定型 ── 見出しとリンクの下に図のエディタを置くだけ(エディタは UmlDiagramEditor)。
"use client";

// Phase-17-7：更新(ツールバー・キャンバス・パネルを、段階2の DFD のタブと共有するため
// // UmlDiagramEditor.tsx へそのまま移した。移した部分の旧コードは UmlDiagramEditor.tsx の本体と
// // 同じなので、ここには残さない。このファイルは見出しと一覧へ戻るリンクだけを持つ)
// ↓↓
import Link from "next/link";
import { H2, Text, XStack, YStack } from "tamagui";
import { UmlDiagramEditor } from "@/features/uml/components/UmlDiagramEditor";
import { diagramTitle } from "@/features/uml/labels";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";

// レビュー画面(SCR-007 の後半)。見出しと一覧へ戻るリンクの下に、図のエディタを置く。
export function UmlDiagramPageContent({
  projectId,
  diagramId,
}: {
  projectId: string;
  diagramId: string;
}) {
  const diagram = useUmlEditorStore((s) => s.diagram);

  return (
    <YStack paddingVertical="$4" gap="$3">
      <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
        <H2>{diagram ? diagramTitle(diagram) : "設計図"}</H2>
        <Link href={`/projects/${projectId}/uml`}>
          <Text color="$blue10">設計図の一覧に戻る</Text>
        </Link>
      </XStack>
      <UmlDiagramEditor projectId={projectId} diagramId={diagramId} />
    </YStack>
  );
}
