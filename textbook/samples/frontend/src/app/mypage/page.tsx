// 作成：Phase-66-3
"use client";

import { H2, YStack } from "tamagui";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AccountSection } from "@/features/mypage/components/AccountSection";

// マイページ(SCR-009)。アカウントの節のあとに、用途ごとのモデルと API キーの節を足していく。
export default function MyPage() {
  return (
    <RequireAuth>
      <YStack paddingVertical="$4" gap="$6" width="100%" maxWidth={640}>
        <H2>マイページ</H2>
        <AccountSection />
      </YStack>
    </RequireAuth>
  );
}
