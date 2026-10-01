// 作成：Phase-3-3｜更新：Phase-15-7
// Phase-15-7：更新(作成画面へのリンクを、モード選択ダイアログを開くボタンに替えた)
// "use client";
//
// import Link from "next/link";
// import { H2, Text, XStack, YStack } from "tamagui";
// import { RequireAuth } from "@/components/auth/RequireAuth";
// import { ProjectList } from "@/features/dashboard/components/ProjectList";
//
// export default function DashboardPage() {
//   return (
//     <RequireAuth>
//       <YStack paddingVertical="$4" gap="$6">
//         <XStack justifyContent="space-between" alignItems="center">
//           <H2>ダッシュボード</H2>
//           {/* StyledButton(<button>)をLinkの<a>直下に置くと入れ子の対話要素になり
//               HTML的に不正なため、リンクをボタン風にスタイリングする素朴な方法を使う。 */}
//           <Link href="/projects/new">
//             <XStack
//               backgroundColor="$color9"
//               hoverStyle={{ backgroundColor: "$color10" }}
//               paddingHorizontal="$4"
//               paddingVertical="$2"
//               borderRadius="$4"
//             >
//               <Text color="white" fontWeight="600">
//                 新規プロジェクトを作成
//               </Text>
//             </XStack>
//           </Link>
//         </XStack>
//         <ProjectList />
//       </YStack>
//     </RequireAuth>
//   );
// }
// ↓↓
"use client";

import { useState } from "react";
import { H2, XStack, YStack } from "tamagui";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import { ModeSelectDialog } from "@/features/dashboard/components/ModeSelectDialog";
import { ProjectList } from "@/features/dashboard/components/ProjectList";

export default function DashboardPage() {
  // 新規作成は、まずモード(簡易ドキュメント/詳細設計)を選ばせる(docs/external_design.md 2.7節)。
  // そのため作成画面への直接のリンクではなく、ダイアログを開くボタンにする。
  const [modeDialogOpen, setModeDialogOpen] = useState(false);

  return (
    <RequireAuth>
      <YStack paddingVertical="$4" gap="$6">
        <XStack justifyContent="space-between" alignItems="center">
          <H2>ダッシュボード</H2>
          <StyledButton onPress={() => setModeDialogOpen(true)}>新規プロジェクトを作成</StyledButton>
        </XStack>
        <ProjectList />
      </YStack>
      <ModeSelectDialog open={modeDialogOpen} onClose={() => setModeDialogOpen(false)} />
    </RequireAuth>
  );
}
