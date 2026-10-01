// 作成：Phase-15-7
// 写経レベル: 定型 ── 作成画面の本体(モードの表示とフォーム)。
"use client";

import { H2, Paragraph, YStack } from "tamagui";
import { StyledCard } from "@/components/ui/primitives/StyledCard";
import type { ProjectMode } from "@/features/dashboard/api/projects";
import { MODE_OPTIONS } from "@/features/dashboard/components/ModeSelectDialog";
import { IntakeForm } from "@/features/hearing/components/IntakeForm";

// 作成画面の本体。モードはダッシュボードのモード選択ダイアログが ?mode= で渡す
// (page.tsx が解釈して渡す)。
export function NewProjectPageContent({ mode }: { mode: ProjectMode }) {
  const option = MODE_OPTIONS.find((o) => o.mode === mode);

  return (
    <YStack paddingVertical="$4" gap="$6">
      <H2>新規プロジェクト</H2>
      <Paragraph color="$color11">モード: {option?.title}</Paragraph>
      <StyledCard>
        <IntakeForm mode={mode} />
      </StyledCard>
    </YStack>
  );
}
