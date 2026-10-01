// 作成：Phase-15-7
// 写経レベル: 定型 ── 7段階の並びと状態の色。
"use client";

import { Text, XStack, YStack } from "tamagui";
import type {
  DesignStageRead,
  StageState,
} from "@/features/detailed-design/api/types";
import { STAGE_TITLES, STATE_LABELS } from "@/features/detailed-design/labels";

const STATE_COLORS: Record<StageState, string> = {
  not_started: "$color10",
  draft: "$blue10",
  reviewing: "$orange10",
  approved: "$green10",
  outdated: "$red10",
};

// 段階1〜7の縦のステッパー。各段階の状態を色とラベルで示し、押すとその段階を選ぶ。
export function StageStepper({
  stages,
  selectedStage,
  onSelect,
}: {
  stages: DesignStageRead[];
  selectedStage: number;
  onSelect: (stage: number) => void;
}) {
  return (
    <YStack role="navigation" aria-label="段階" gap="$2" minWidth={220}>
      {stages.map((s) => {
        const selected = s.stage === selectedStage;
        return (
          <XStack
            key={s.stage}
            role="button"
            aria-current={selected ? "step" : undefined}
            aria-label={`段階${s.stage} ${STAGE_TITLES[s.stage]}(${STATE_LABELS[s.state]})`}
            onPress={() => onSelect(s.stage)}
            cursor="pointer"
            padding="$2"
            borderRadius="$3"
            borderWidth={1}
            borderColor={selected ? "$color9" : "$borderColor"}
            backgroundColor={selected ? "$color3" : "transparent"}
            justifyContent="space-between"
            alignItems="center"
            gap="$2"
            opacity={s.is_open || s.state !== "not_started" ? 1 : 0.6}
          >
            <Text>
              {s.stage}. {STAGE_TITLES[s.stage]}
            </Text>
            <Text fontSize="$2" color={STATE_COLORS[s.state]}>
              {STATE_LABELS[s.state]}
            </Text>
          </XStack>
        );
      })}
    </YStack>
  );
}
