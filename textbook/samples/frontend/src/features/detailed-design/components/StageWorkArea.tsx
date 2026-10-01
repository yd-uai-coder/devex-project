// 作成：Phase-15-7
// 写経レベル: コア ── 足りない入力・古い表示・承認を、全段階に共通の部分として持つ。
"use client";

import { H3, Paragraph, Text, XStack, YStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import type { DesignStageRead } from "@/features/detailed-design/api/types";
import {
  canApprove,
  describeMissingInput,
  STAGE_TITLES,
  STATE_LABELS,
} from "@/features/detailed-design/labels";

// 選んだ段階の作業領域。段階ごとの中身(下書きの生成・表や図の編集)は段階の実装で足す。
// ここでは全段階に共通の部分(状態・足りない入力・古い表示・承認)だけを持つ。
export function StageWorkArea({
  stage,
  approving,
  actionError,
  onApprove,
}: {
  stage: DesignStageRead;
  approving: boolean;
  actionError: string | null;
  onApprove: () => void;
}) {
  return (
    <YStack flex={1} gap="$3">
      <H3>
        段階{stage.stage} {STAGE_TITLES[stage.stage]}
      </H3>
      <Text color="$color11">状態: {STATE_LABELS[stage.state]}</Text>

      {!stage.is_open ? (
        <Paragraph color="$color11">
          この段階はまだ始められません。先に次のものが必要です:{" "}
          {stage.missing_inputs.map(describeMissingInput).join("、")}
        </Paragraph>
      ) : null}

      {stage.state === "outdated" ? (
        <Paragraph role="status" color="$red10">
          承認した後に、この段階の入力(前の段階または文書)が変わりました。作り直すか、内容を確かめて
          このまま承認し直してください。
        </Paragraph>
      ) : null}

      <YStack
        padding="$4"
        borderWidth={1}
        borderStyle="dashed"
        borderColor="$borderColor"
        borderRadius="$4"
      >
        <Text color="$color11">
          {stage.is_open
            ? "この段階の下書きの生成と編集の画面は、準備中です。"
            : "前の段階を承認すると、この段階を始められます。"}
        </Text>
      </YStack>

      {actionError ? (
        <Text role="alert" color="$red10">
          {actionError}
        </Text>
      ) : null}

      <XStack justifyContent="flex-end">
        <StyledButton
          disabled={!canApprove(stage) || approving}
          onPress={onApprove}
        >
          {approving
            ? "承認しています..."
            : stage.state === "outdated"
              ? "このまま承認し直す"
              : "承認する"}
        </StyledButton>
      </XStack>
    </YStack>
  );
}
