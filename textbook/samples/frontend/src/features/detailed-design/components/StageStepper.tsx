// 作成：Phase-15-7｜更新：Phase-16-6,24(完了後の UI 調整),27-3,31-7
// 写経レベル: 定型 ── 7段階の並びと状態の色。
"use client";

// Phase-24:追記(完了後の UI 調整) ── @/components/layout/layout-constants.HEADER_HEIGHT
import { Text, XStack, YStack } from "tamagui";
import { HEADER_HEIGHT } from "@/components/layout/layout-constants";
import type {
  DesignStageRead,
  StageState,
} from "@/features/detailed-design/api/types";
import { STAGE_TITLES, STATE_LABELS } from "@/features/detailed-design/labels";

const STATE_COLORS: Record<StageState, string> = {
  not_started: "$color10",
  draft: "$blue10",
  // Phase-16-6:追記
  regenerated: "$purple10",
  reviewing: "$orange10",
  approved: "$green10",
  outdated: "$red10",
};

// Phase-27-3：更新(段階1〜7 → 段階1〜8)
// Phase-31-7:追記
// 簡易ドキュメントモードのプロジェクトが持たない段階(段階8だけを持つ)
const DETAILED_ONLY_STAGES = [1, 2, 3, 4, 5, 6, 7];
export const DETAILED_ONLY_NOTICE =
  "段階1〜7は詳細設計モード用です。簡易ドキュメントモードは4文書から段階8(実装手順書)を作ります。";

// 簡易モードの、使えない段階の行(番号が8から始まらないように並べる。押せない)。
function DisabledStage({ stage }: { stage: number }) {
  return (
    <XStack
      aria-disabled
      aria-label={`段階${stage} ${STAGE_TITLES[stage]}(詳細設計モードのみ・使用不可)`}
      padding="$2"
      borderRadius="$3"
      borderWidth={1}
      borderStyle="dashed"
      borderColor="$borderColor"
      justifyContent="space-between"
      alignItems="center"
      gap="$2"
      opacity={0.45}
    >
      <Text>
        {stage}. {STAGE_TITLES[stage]}
      </Text>
      <Text fontSize="$2" color="$color10">
        詳細設計モードのみ
      </Text>
    </XStack>
  );
}

// 段階1〜8の縦のステッパー。各段階の状態を色とラベルで示し、押すとその段階を選ぶ。
// Phase-31-7:追記
// 簡易ドキュメントモード(段階8だけ)は、段階1〜7を使えない行として前に並べ、その旨を添える。
export function StageStepper({
  stages,
  selectedStage,
  onSelect,
}: {
  stages: DesignStageRead[];
  selectedStage: number;
  onSelect: (stage: number) => void;
}) {
  // Phase-31-7:追記
  const simple = stages[0]?.mode === "simple";
  return (
    // Phase-24：更新(完了後の UI 調整)
    // <YStack role="navigation" aria-label="段階" gap="$2" minWidth={220}>
    // ↓↓
    // 広い画面では作業領域の横に並ぶので、スクロールしても見えるように固定のヘッダーの下に
    // 貼り付ける(top は AppShell の本文の上余白と同じ)。狭い画面では作業領域の上の段に回るため、
    // 貼り付けると作業領域に重なる。そこで $md 以上の幅でだけ貼り付ける。
    <YStack
      role="navigation"
      aria-label="段階"
      gap="$2"
      minWidth={220}
      alignSelf="flex-start"
      $md={{ position: "sticky", top: HEADER_HEIGHT + 16, zIndex: 10 }}
    >
      {/* Phase-31-7:追記 */}
      {simple ? (
        <>
          <Text fontSize="$2" color="$color11" maxWidth={220}>
            {DETAILED_ONLY_NOTICE}
          </Text>
          {DETAILED_ONLY_STAGES.map((stage) => (
            <DisabledStage key={stage} stage={stage} />
          ))}
        </>
      ) : null}
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
