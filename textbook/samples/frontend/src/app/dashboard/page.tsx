// 作成：Phase-3-3
"use client";

import Link from "next/link";
import { H2, Text, XStack, YStack } from "tamagui";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ProjectList } from "@/features/dashboard/components/ProjectList";

export default function DashboardPage() {
  return (
    <RequireAuth>
      <YStack paddingVertical="$4" gap="$6">
        <XStack justifyContent="space-between" alignItems="center">
          <H2>ダッシュボード</H2>
          {/* StyledButton(<button>)をLinkの<a>直下に置くと入れ子の対話要素になり
              HTML的に不正なため、リンクをボタン風にスタイリングする素朴な方法を使う。 */}
          <Link href="/projects/new">
            <XStack
              backgroundColor="$color9"
              hoverStyle={{ backgroundColor: "$color10" }}
              paddingHorizontal="$4"
              paddingVertical="$2"
              borderRadius="$4"
            >
              <Text color="white" fontWeight="600">
                新規プロジェクトを作成
              </Text>
            </XStack>
          </Link>
        </XStack>
        <ProjectList />
      </YStack>
    </RequireAuth>
  );
}
