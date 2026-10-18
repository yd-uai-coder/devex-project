// 作成：Phase-3-2｜更新：Phase-76-2
"use client"

// Phase-76-2:追記 ── GoogleLoginSection
import { Suspense } from "react";
import Link from "next/link";
import { H2, Text, YStack } from "tamagui";
import { StyledCard } from "@/components/ui/primitives/StyledCard";
import { GoogleLoginSection } from "@/features/auth/components/GoogleLoginSection";
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <YStack paddingVertical="$6" alignItems="center">
      <YStack width="100%" maxWidth={420} gap="$4">
        <H2>ログイン</H2>
        <StyledCard>
          {/* useSearchParams()(?redirect=...の読み取り)を使うため、Next.jsの規約で
              Suspense境界が必要になる */}
          <Suspense fallback={null}>
            <LoginForm />
            {/* Phase-76-2:追記 */}
            {/* Google でのログイン(クライアント ID が無い環境では出ない) */}
            <GoogleLoginSection text="signin_with" />
          </Suspense>
        </StyledCard>
        <Text fontSize="$3">
          アカウントをお持ちでない方は<Link href="/register">こちらから登録</Link>
        </Text>
      </YStack>
    </YStack>
  );
}
