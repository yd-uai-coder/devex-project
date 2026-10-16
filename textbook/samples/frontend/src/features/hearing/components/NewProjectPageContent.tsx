// 作成：Phase-15-7｜更新：Phase-62-3
// 写経レベル: 定型 ── 作成画面の本体(モードの表示とフォーム)。
"use client";

// Phase-62-3:追記 ── useRouter(next/navigation), ModeSelectDialog(@/features/dashboard/components/ModeSelectDialog)
import { useRouter } from "next/navigation";
import { H2, Paragraph, YStack } from "tamagui";
import { StyledCard } from "@/components/ui/primitives/StyledCard";
import type { ProjectMode } from "@/features/dashboard/api/projects";
import { MODE_OPTIONS, ModeSelectDialog } from "@/features/dashboard/components/ModeSelectDialog";
import { IntakeForm } from "@/features/hearing/components/IntakeForm";

// 作成画面の本体。モードはダッシュボードのモード選択ダイアログが ?mode= で渡す
// Phase-62-3：更新
// // (page.tsx が解釈して渡す)。
// export function NewProjectPageContent({ mode }: { mode: ProjectMode }) {
// ↓↓
// (page.tsx が解釈して渡す)。mode が無い(メニュー・URL の直打ち)ときは、ここで
// 同じダイアログを出して選ばせる。選ぶと ?mode= 付きで開き直し、キャンセルならダッシュボードへ戻す。
export function NewProjectPageContent({ mode }: { mode: ProjectMode | null }) {
  const router = useRouter();

  if (mode === null) {
    return (
      <YStack paddingVertical="$4" gap="$6">
        <H2>新規プロジェクト</H2>
        <ModeSelectDialog open onClose={() => {}} onCancel={() => router.push("/dashboard")} />
      </YStack>
    );
  }

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
