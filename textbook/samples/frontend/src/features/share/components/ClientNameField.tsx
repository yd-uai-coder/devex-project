// 作成：Phase-108-2
"use client";

import { Text, YStack } from "tamagui";
import { useShareStore } from "@/features/share/share-store";
import { CLIENT_NAME_MAX } from "@/features/share/shareOps";
import { INPUT } from "@/features/detailed-design/components/tableStyles";

// クライアントの名前の欄(ページに1つ。コメントと合意 / 却下の両方で使い、このブラウザに覚える)
export function ClientNameField() {
  const name = useShareStore((s) => s.name);
  const setName = useShareStore((s) => s.setName);
  return (
    <YStack gap="$1">
      <label style={{ display: "block", fontSize: 13 }}>
        お名前(コメントとご判断に記録されます)
        <input
          style={{ ...INPUT, display: "block", marginTop: 4, maxWidth: 320 }}
          maxLength={CLIENT_NAME_MAX}
          aria-label="お名前"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <Text fontSize="$1" color="$color11">
        このブラウザに覚えておきます。
      </Text>
    </YStack>
  );
}
