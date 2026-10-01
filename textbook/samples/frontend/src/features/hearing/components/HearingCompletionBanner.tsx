// 作成：Phase-3-5｜更新：Phase-6-6,15-8
// Phase-6-6:追記 ── @/features/hearing/hearing-store.useHearingStore
// Phase-15-8:追記 ── useState(react), ConfirmDialog
import { useState } from "react";
import { Button, Text, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
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
  // Phase-15-8:追記
  const [confirmOpen, setConfirmOpen] = useState(false);

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
      {/* Phase-15-8：更新(生成は数分かかり、やり直すとAIの利用枠も使うため、押す前に確認する。気づき#4)
      <Button theme="green" disabled={projectStatus === "completed" || approving} onPress={onApprove}>
          ↓↓ */}
      <Button
        theme="green"
        disabled={projectStatus === "completed" || approving}
        onPress={() => setConfirmOpen(true)}
      >
        {projectStatus === "completed"
          ? "設計書は生成済みです"
          : approving
            ? "生成を開始しています..."
            : "この内容で設計書を生成する"}
      </Button>
      {/* Phase-15-8:追記 */}
      <ConfirmDialog
        open={confirmOpen}
        title="設計書を生成しますか"
        description="この内容で設計書を生成します。生成には数分かかり、その間はチャットを送れません。"
        confirmLabel="生成する"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onApprove();
        }}
      />
    </YStack>
  );
}
