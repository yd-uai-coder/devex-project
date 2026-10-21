// 作成：Phase-99(完了後の調整)
"use client";

import { useEffect, useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import { getChangeRequestVerification } from "@/features/change-requests/api/changeRequestsApi";
import type { ChangeRequestVerificationRead } from "@/features/change-requests/api/types";
import { verifyBannerText } from "@/features/change-requests/changeRequestOps";
import { useAppliedChangeRequests } from "@/features/change-requests/hooks/useAppliedChangeRequests";

// 詳細設計の画面(SCR-008)の「変更要求の検証」の帯。反映済み(未検証)の CR ごとに、未確認の印・文書の側・
// 未承認の段階の数と「検証する」を出す(押すと検証のモーダル)。CR の一覧から CR を開いて検証のタブへ
// 移らなくても、段階を承認したその場で検証に届くようにする。反映済みの CR が無ければ何も出さない。
// `refreshKey` が変わったら(段階の承認・印の確認)数を読み直す。
export function ChangeRequestVerifyBanner({
  projectId,
  refreshKey,
  onVerify,
}: {
  projectId: string;
  refreshKey: string;
  onVerify: (number: number) => void;
}) {
  const applied = useAppliedChangeRequests(projectId, true);
  const [counts, setCounts] = useState<Record<number, ChangeRequestVerificationRead>>({});
  const numbers = applied.map((cr) => cr.number).join(",");

  useEffect(() => {
    if (numbers === "") return;
    let cancelled = false;
    void Promise.all(
      numbers.split(",").map((n) =>
        getChangeRequestVerification(projectId, Number(n)).catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<number, ChangeRequestVerificationRead> = {};
      for (const v of results) if (v) next[v.number] = v;
      setCounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, numbers, refreshKey]);

  if (applied.length === 0) return null;
  return (
    <YStack
      gap="$2"
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$4"
      padding="$3"
      aria-label="変更要求の検証"
    >
      <Text fontWeight="700">変更要求の検証</Text>
      {applied.map((cr) => {
        const v = counts[cr.number];
        return (
          <XStack key={cr.number} gap="$3" alignItems="center" flexWrap="wrap">
            <Text flex={1} minWidth={200}>
              {`CR-${cr.number} ${cr.title}(反映済み)`}
            </Text>
            <Text fontSize="$2" color="$color11">
              {v ? verifyBannerText(v) : "読み込み中..."}
            </Text>
            <Button size="$2" aria-label={`CR-${cr.number} を検証する`} onPress={() => onVerify(cr.number)}>
              検証する
            </Button>
          </XStack>
        );
      })}
    </YStack>
  );
}
