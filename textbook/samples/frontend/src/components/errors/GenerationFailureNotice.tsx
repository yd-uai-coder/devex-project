// 作成：Phase-69-3
"use client";

import { Text, YStack } from "tamagui";
import { failureHeading } from "@/lib/generation-failure";
import type { GenerationFailure } from "@/lib/generation-failure";

// 生成の失敗の知らせ(画面の上に置き、次の生成を始めるまで出す)。`note` は画面ごとの添え書き
// (プレビューの「前の版を表示しています」など)。
export function GenerationFailureNotice({
  failure,
  note,
}: {
  failure: GenerationFailure | null;
  note?: string;
}) {
  if (!failure) return null;
  return (
    <YStack
      role="alert"
      aria-label="生成の失敗"
      gap="$1"
      padding="$3"
      borderWidth={1}
      borderColor="$red8"
      borderRadius="$3"
      backgroundColor="$red2"
    >
      <Text fontWeight="700" color="$red11">
        {failureHeading(failure)}
      </Text>
      <Text color="$red11">{failure.message}</Text>
      {note ? <Text color="$color11">{note}</Text> : null}
    </YStack>
  );
}
