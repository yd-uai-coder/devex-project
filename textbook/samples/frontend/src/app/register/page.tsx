// 作成：Phase-3-2
"use client";

import Link from "next/link";
import { H2, Text, YStack } from "tamagui";
import { StyledCard } from "@/components/ui/primitives/StyledCard";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export default function RegisterPage() {
  return (
    <YStack paddingVertical="$6" alignItems="center">
      <YStack width="100%" maxWidth={420} gap="$4">
        <H2>アカウント登録</H2>
        <StyledCard>
          <RegisterForm />
        </StyledCard>
        <Text fontSize="$3">
          既にアカウントをお持ちの方は<Link href="/login">こちらからログイン</Link>
        </Text>
      </YStack>
    </YStack>
  );
}
