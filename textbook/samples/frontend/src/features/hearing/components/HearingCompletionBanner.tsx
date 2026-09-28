// 作成：Phase-3-5｜更新：Phase-6-6
// Phase-6-6:追記 ── @/features/hearing/hearing-store.useHearingStore
import { Button, Text, YStack } from "tamagui";
import { useHearingStore } from "@/features/hearing/hearing-store";
import type { HearingCompletionCheck } from "@/features/hearing/api/hearingApi";

type HearingCompletionBannerProps = {
  completion: HearingCompletionCheck;
  onApprove: () => void;
  approving: boolean;
};

// is_sufficient=trueでも即座に生成へは進まない。構造化サマリを提示しユーザーの明示的な
// 承認を得てから/generateを呼ぶ(docs/external_design.md 2.3節)。
export function HearingCompletionBanner({ completion, onApprove, approving }: HearingCompletionBannerProps) {
  // Phase-6-6:追記 ── 生成済み(completed)のプロジェクトでは、同じ完了判定のまま二重に生成を
  // 承認させない。projectStatusはsendMessage(completed→revising)・approveAndGenerate
  // (→generating)でstore側が追従させるため、ここで購読するだけでボタンが再描画される。
  const projectStatus = useHearingStore((s) => s.projectStatus);

  if (!completion.is_sufficient) return null;

  return (
    <YStack
      role="status"
      gap="$3"
      padding="$4"
      borderWidth={1}
      borderColor="$color8"
      borderRadius="$4"
      backgroundColor="$color2"
    >
      <Text fontWeight="600">ヒアリング内容の確認</Text>
      <Text>{completion.summary}</Text>
      {/* Phase-6-6：更新
      <Button theme="green" disabled={approving} onPress={onApprove}>
        {approving ? "生成を開始しています..." : "この内容で設計書を生成する"}
      </Button>
      ↓↓ */}
      <Button theme="green" disabled={projectStatus === "completed" || approving} onPress={onApprove}>
        {projectStatus === "completed"
          ? "設計書は生成済みです"
          : approving
            ? "生成を開始しています..."
            : "この内容で設計書を生成する"}
      </Button>
    </YStack>
  );
}
