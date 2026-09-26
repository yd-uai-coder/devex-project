// 作成：Phase-3-4
"use client";

import { H2, YStack } from "tamagui";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { StyledCard } from "@/components/ui/primitives/StyledCard";
import { IntakeForm } from "@/features/hearing/components/IntakeForm";

export default function NewProjectPage() {
  return (
    <RequireAuth>
      <YStack paddingVertical="$4" gap="$6">
        <H2>新規プロジェクト</H2>
        <StyledCard>
          <IntakeForm />
        </StyledCard>
      </YStack>
    </RequireAuth>
  );
}
