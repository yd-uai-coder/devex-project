// 作成：Phase-3-2｜更新：Phase-76-2
"use client"

// Phase-76-2:追記 ── Suspense, GoogleLoginSection
import { Suspense } from "react";
import Link from "next/link";
import { H2, Text, YStack } from "tamagui";
import { StyledCard } from "@/components/ui/primitives/StyledCard";
import { GoogleLoginSection } from "@/features/auth/components/GoogleLoginSection";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export default function RegisterPage() {
  return (
    <YStack paddingVertical="$6" alignItems="center">
      <YStack width="100%" maxWidth={420} gap="$4">
        <H2>アカウント登録</H2>
        <StyledCard>
          <RegisterForm />
          {/* Phase-76-2:追記 */}
          {/* Google での登録はログインと同じ処理(初めての Google アカウントならそのまま登録して
              ログインする)。戻り先(?redirect=)を読むので、Next.jsの規約で Suspense 境界が要る */}
          <Suspense fallback={null}>
            <GoogleLoginSection text="signup_with" />
          </Suspense>
        </StyledCard>
        <Text fontSize="$3">
          既にアカウントをお持ちの方は<Link href="/login">こちらからログイン</Link>
        </Text>
      </YStack>
    </YStack>
  );
}
