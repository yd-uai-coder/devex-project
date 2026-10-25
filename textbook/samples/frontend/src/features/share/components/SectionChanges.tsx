// 作成：Phase-108-1
"use client";

import { H3, Text, YStack } from "tamagui";
import type { SectionChangeRead } from "@/features/share/api/types";
import { formatDateTime } from "@/features/share/shareOps";

// 前回説明した時点から変わった点(開発者が直して説明し直したとき)。節ごとに、消えた行と足した行を出す。
// 変わった点が無ければ何も描かない
export function SectionChanges({
  changes,
  changedSince,
}: {
  changes: SectionChangeRead[];
  changedSince: string | null;
}) {
  if (changes.length === 0) return null;
  return (
    <YStack
      gap="$2"
      borderWidth={1}
      borderColor="$yellow8"
      backgroundColor="$yellow2"
      borderRadius="$3"
      padding="$3"
      aria-label="前回から変わった点"
    >
      <H3 fontSize="$5">
        {changedSince ? `前回(${formatDateTime(changedSince)})から変わった点` : "前回から変わった点"}
      </H3>
      {changes.map((change) => (
        <YStack key={change.name} gap="$1" aria-label={`変わった節: ${change.name}`}>
          <Text fontWeight="700">{change.name}</Text>
          {change.removed.map((line, i) => (
            <Text key={`r${i}`} color="$red10" textDecorationLine="line-through">
              {`− ${line}`}
            </Text>
          ))}
          {change.added.map((line, i) => (
            <Text key={`a${i}`} color="$green10">
              {`+ ${line}`}
            </Text>
          ))}
        </YStack>
      ))}
    </YStack>
  );
}
