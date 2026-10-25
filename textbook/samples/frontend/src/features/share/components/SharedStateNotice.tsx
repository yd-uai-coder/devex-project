// 作成：Phase-108-1
"use client";

import { H2, Paragraph, Text, XStack, YStack } from "tamagui";
import type { SharedChangeRequestRead } from "@/features/share/api/types";
import { SHARE_STATE_TONE } from "@/features/change-requests/changeRequestOps";
import { formatDate, formatDateTime, stateNotice } from "@/features/share/shareOps";
import { BADGE } from "@/features/detailed-design/components/tableStyles";

// 共有リンクの画面の頭。CR の題・リンクの状態・期限と、状態ごとの知らせ。判断済みなら、判断の結果
// (合意 / 却下・日時・相手・選んだ案・出どころ)を出す
export function SharedStateNotice({ shared }: { shared: SharedChangeRequestRead }) {
  const tone = SHARE_STATE_TONE[shared.state];
  const decision = shared.decision;
  return (
    <YStack gap="$2">
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <H2>{`${shared.label} ${shared.title}`}</H2>
        <span
          style={{
            ...BADGE,
            whiteSpace: "nowrap",
            color: `var(--${tone}11)`,
            borderColor: `var(--${tone}8)`,
            background: `var(--${tone}2)`,
          }}
          aria-label={`状態: ${shared.state_label}`}
        >
          {shared.state_label}
        </span>
      </XStack>
      <Text fontSize="$2" color="$color11">{`このリンクの期限: ${formatDate(shared.expires_at)} まで`}</Text>
      <Paragraph>{stateNotice(shared.state)}</Paragraph>
      {decision ? (
        <YStack
          gap="$1"
          borderWidth={1}
          borderColor="$borderColor"
          borderRadius="$3"
          padding="$3"
          aria-label="判断の結果"
        >
          <Text fontWeight="700">{`${decision.decision_label}(${formatDateTime(decision.decided_at)})`}</Text>
          {decision.option ? <Text>{`選んだ案: ${decision.option}`}</Text> : null}
          {decision.counterpart ? <Text>{`判断した人: ${decision.counterpart}`}</Text> : null}
          {decision.source_label ? <Text color="$color11">{`記録: ${decision.source_label}`}</Text> : null}
        </YStack>
      ) : null}
    </YStack>
  );
}
