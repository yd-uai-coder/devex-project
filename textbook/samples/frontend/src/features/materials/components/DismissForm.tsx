// 作成：Phase-116-3
"use client";

import { useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import { INPUT } from "@/features/detailed-design/components/tableStyles";
import type { MaterialDifferenceRead } from "@/features/materials/api/types";

const REASON_MAX = 500;

// 違いを捨てる(確かめる点を閉じる)ときの理由の入力。理由は一覧に残り、捨てた違いは戻せる
export function DismissForm({
  difference,
  submitting,
  onSubmit,
  onCancel,
}: {
  difference: MaterialDifferenceRead;
  submitting: boolean;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const question = difference.kind === "question";

  return (
    <YStack gap="$2" padding="$3" borderWidth={1} borderColor="$borderColor" borderRadius="$4" aria-label="捨てる理由">
      <Text fontWeight="bold">{`「${difference.content}」を${question ? "閉じる" : "捨てる"}理由`}</Text>
      <textarea
        aria-label="理由"
        style={INPUT}
        rows={2}
        maxLength={REASON_MAX}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <XStack gap="$2">
        <Button size="$3" disabled={submitting || trimmed === ""} onPress={() => onSubmit(trimmed)}>
          {question ? "閉じる" : "捨てる"}
        </Button>
        <Button size="$3" chromeless onPress={onCancel}>
          やめる
        </Button>
      </XStack>
    </YStack>
  );
}
