"use client";
// 作成：Phase-88(完了後の調整)

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { H2, Text, XStack, YStack } from "tamagui";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { changeRequestHref, emptyForm, toCreateBody } from "@/features/change-requests/changeRequestOps";
import { ChangeRequestForm } from "@/features/change-requests/components/ChangeRequestForm";
import { DetailedModeOnlyNotice } from "@/features/change-requests/components/DetailedModeOnlyNotice";
import { baselineHref, baselinesHref } from "@/features/baselines/baselineOps";

// 合意済みの版を基準に変更要求(CR)を作るページ(SCR-010)。合意済みの版の中身から移る。基準の版は
// URL の番号に固定し、選ぶ欄は出さない(対象の版が分かりやすいように)。対象はその版の要件から選ぶ。
// 作ったら CR の詳細へ、やめると合意済みの版の中身へ戻る。
export function ChangeRequestCreateContent({ projectId, baselineNumber }: { projectId: string; baselineNumber: number }) {
  const router = useRouter();
  const baselines = useChangeRequestsStore((s) => (s.projectId === projectId ? s.baselines : null));
  const requirements = useChangeRequestsStore((s) => s.requirements[baselineNumber] ?? null);
  const unavailable = useChangeRequestsStore((s) => s.unavailable && s.projectId === projectId);
  const acting = useChangeRequestsStore((s) => s.acting);
  const actionError = useChangeRequestsStore((s) => s.actionError);
  const fetchBaselines = useChangeRequestsStore((s) => s.fetchBaselines);
  const fetchRequirements = useChangeRequestsStore((s) => s.fetchRequirements);
  const clearActionError = useChangeRequestsStore((s) => s.clearActionError);
  const create = useChangeRequestsStore((s) => s.create);

  useEffect(() => {
    clearActionError();
    void fetchBaselines(projectId);
  }, [projectId, fetchBaselines, clearActionError]);

  const baseline = baselines?.find((b) => b.number === baselineNumber) ?? null;
  useEffect(() => {
    if (baseline) void fetchRequirements(projectId, baseline.number);
  }, [baseline, projectId, fetchRequirements]);

  if (unavailable) return <DetailedModeOnlyNotice projectId={projectId} title="変更要求を作る" />;

  const back = baseline ? (
    <Link href={baselineHref(projectId, baseline.number)}>
      <Text color="$blue10">{`← ${baseline.label} 合意済みの版`}</Text>
    </Link>
  ) : (
    <Link href={baselinesHref(projectId)}>
      <Text color="$blue10">← 合意済みの版の一覧</Text>
    </Link>
  );

  return (
    <YStack paddingVertical="$4" gap="$4">
      <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
        <H2>変更要求を作る</H2>
        {back}
      </XStack>

      {actionError ? (
        <Text role="alert" color="$red10">
          {actionError}
        </Text>
      ) : null}

      {baselines === null ? <Text color="$color11">読み込み中...</Text> : null}
      {baselines !== null && baseline === null ? (
        <Text color="$color11">{`合意済みの版 B-${baselineNumber} は見つかりません。一覧から基準にする版を開いてください。`}</Text>
      ) : null}

      {baseline ? (
        <YStack gap="$3">
          <Text>
            {`基準の合意済みの版: ${baseline.label}(${new Date(baseline.agreed_at).toLocaleDateString("ja-JP")} 合意)`}
          </Text>
          <ChangeRequestForm
            initial={emptyForm(baseline.number)}
            requirements={requirements}
            submitting={acting}
            submitLabel="下書きで作る"
            onCancel={() => {
              clearActionError();
              router.push(baselineHref(projectId, baseline.number));
            }}
            onSubmit={async (form) => {
              const created = await create(projectId, toCreateBody(form));
              if (created) router.push(changeRequestHref(projectId, created.number));
            }}
          />
        </YStack>
      ) : null}
    </YStack>
  );
}
