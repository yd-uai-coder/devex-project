// 作成：Phase-69-4
"use client";

import { Text, YStack } from "tamagui";
import type { GenerationFinding } from "@/features/detailed-design/api/types";
import { LEVEL_LABEL } from "@/features/design-review/model";
import type { ReviewLevel } from "@/features/design-review/api/reviewApi";

// 差し戻しで作り直した段階に、その作り直しの修正指示に入れた指摘を並べる(検証のエラーと並べて、
// どの指摘を受けて作り直した内容かを見せる。エラーと指摘の対応は付けない)。
export function StageGenerationFindings({ findings }: { findings: GenerationFinding[] }) {
  if (findings.length === 0) return null;
  return (
    <YStack gap="$1" aria-label="この作り直しで渡した指摘">
      <Text fontWeight="700">この作り直しで渡した指摘</Text>
      {findings.map((finding) => (
        <Text key={finding.id} fontSize="$2" color="$color11">
          {`[${LEVEL_LABEL[finding.level as ReviewLevel] ?? finding.level}] `}
          {finding.targets.length > 0 ? `対象: ${finding.targets.join("、")} ── ` : ""}
          {finding.problem}
        </Text>
      ))}
    </YStack>
  );
}
