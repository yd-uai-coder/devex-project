// 作成：Phase-54-4
"use client";

import { useRouter } from "next/navigation";
import { Button, Text, XStack } from "tamagui";
import type { ReviewFindingRead } from "@/features/design-review/api/reviewApi";
import { useReviewStore } from "@/features/design-review/review-store";

// 差し戻しの聞き直し: 採用したヒアリングの指摘の観点を未決に戻し、チャットへ移って聞き直す
// (最初の問いかけはサーバーがチャットに出す)。呼び出し側は、指摘があるときだけ置く。
export function RehearingButton({ projectId, findings }: { projectId: string; findings: ReviewFindingRead[] }) {
  const router = useRouter();
  const rehear = useReviewStore((s) => s.rehear);
  const rehearing = useReviewStore((s) => s.rehearing);
  const keys = [...new Set(findings.map((f) => f.point_key))].join("・");

  return (
    <XStack gap="$2" alignItems="center" flexWrap="wrap">
      <Button
        size="$1"
        disabled={rehearing}
        onPress={async () => {
          if (await rehear(projectId, findings.map((f) => f.id))) router.push(`/projects/${projectId}/chat`);
        }}
      >
        {`チャットで聞き直す(${findings.length}件)`}
      </Button>
      <Text fontSize="$1" color="$color10">
        {`採用したヒアリングの指摘の観点(${keys})を未決に戻し、チャットで聞き直します。`}
      </Text>
    </XStack>
  );
}
