// 作成：Phase-57-2
"use client";

import { Button, XStack } from "tamagui";
import { FINDING_LEVELS, type FindingLevel } from "@/features/detailed-design/api/types";
import { FINDING_LEVEL_LABELS } from "@/features/detailed-design/labels";

export type FindingFilter = FindingLevel | "all";

// 指摘の表の、重要度での絞り込み(「すべて(n)」「最重要(n)」…)。段階8の未定義・要決定と
// テスト仕様書の検証の結果で共有する。
export function FindingLevelFilter({
  filter,
  counts,
  onChange,
}: {
  filter: FindingFilter;
  counts: Record<FindingLevel, number>;
  onChange: (filter: FindingFilter) => void;
}) {
  const total = FINDING_LEVELS.reduce((sum, level) => sum + counts[level], 0);
  return (
    <XStack gap="$2" flexWrap="wrap">
      <Button
        size="$2"
        theme={filter === "all" ? "blue" : undefined}
        aria-pressed={filter === "all"}
        onPress={() => onChange("all")}
      >
        {`すべて(${total})`}
      </Button>
      {FINDING_LEVELS.map((level) => (
        <Button
          key={level}
          size="$2"
          theme={filter === level ? "blue" : undefined}
          aria-pressed={filter === level}
          onPress={() => onChange(level)}
        >
          {`${FINDING_LEVEL_LABELS[level]}(${counts[level]})`}
        </Button>
      ))}
    </XStack>
  );
}
