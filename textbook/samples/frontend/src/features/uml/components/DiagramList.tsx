// 作成：Phase-11-4
// 写経レベル: 定型 ── 一覧表示とリンク。
"use client";

import Link from "next/link";
import { H3, Text, XStack, YStack } from "tamagui";
import { DIAGRAM_STATUS_LABELS, diagramTitle } from "@/features/uml/labels";
import { useUmlStore } from "@/features/uml/uml-store";

export function DiagramList({ projectId }: { projectId: string }) {
  const diagrams = useUmlStore((s) => s.diagrams);

  return (
    <YStack gap="$2">
      <H3>設計図</H3>
      {diagrams.length === 0 ? <Text color="$color11">まだ設計図がありません。</Text> : null}
      {diagrams.map((diagram) => (
        <XStack key={diagram.id} gap="$3" alignItems="center" flexWrap="wrap">
          {diagram.generation_status === "generating" ? (
            // 生成中は結果で上書きされるため、開いても編集できない
            <Text>{diagramTitle(diagram)}</Text>
          ) : (
            <Link href={`/projects/${projectId}/uml/${diagram.id}`}>
              <Text color="$blue10">{diagramTitle(diagram)}</Text>
            </Link>
          )}
          <Text color="$color11" fontSize="$2">
            {DIAGRAM_STATUS_LABELS[diagram.status]}
          </Text>
          {diagram.generation_status === "generating" ? (
            <Text color="$color11" fontSize="$2">
              生成中...
            </Text>
          ) : null}
          {diagram.generation_status === "failed" ? (
            <Text color="$color9" fontSize="$2">
              {`生成に失敗しました: ${diagram.generation_error ?? "理由不明"}`}
            </Text>
          ) : null}
        </XStack>
      ))}
    </YStack>
  );
}
