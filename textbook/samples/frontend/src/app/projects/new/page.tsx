// 作成：Phase-3-4｜更新：Phase-15-7
// Phase-15-7：更新(?mode= を読むため非同期の Server Component にし、実体を NewProjectPageContent へ移した)
// "use client";
//
// import { H2, YStack } from "tamagui";
// import { RequireAuth } from "@/components/auth/RequireAuth";
// import { StyledCard } from "@/components/ui/primitives/StyledCard";
// import { IntakeForm } from "@/features/hearing/components/IntakeForm";
//
// export default function NewProjectPage() {
//   return (
//     <RequireAuth>
//       <YStack paddingVertical="$4" gap="$6">
//         <H2>新規プロジェクト</H2>
//         <StyledCard>
//           <IntakeForm />
//         </StyledCard>
//       </YStack>
//     </RequireAuth>
//   );
// }
// ↓↓
import { RequireAuth } from "@/components/auth/RequireAuth";
import { toProjectMode } from "@/features/dashboard/api/projects";
import { NewProjectPageContent } from "@/features/hearing/components/NewProjectPageContent";

// searchParams(Next.js 16 では Promise)を読むため、ページ自体は非同期の Server Component にし、
// Tamagui を使う実体は Client Component(NewProjectPageContent)へ切り出す(他の動的ページと同じ形)。
export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { mode } = await searchParams;
  return (
    <RequireAuth>
      <NewProjectPageContent mode={toProjectMode(mode)} />
    </RequireAuth>
  );
}
