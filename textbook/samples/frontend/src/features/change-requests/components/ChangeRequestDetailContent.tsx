// 作成：Phase-87-3｜更新：Phase-87-4,88-4,88(完了後の調整),89(完了後の調整)
// Phase-87-4:追記 ── @/features/change-requests/components/VerificationTab.VerificationTab
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, H2, Text, XStack, YStack } from "tamagui";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { isApplied } from "@/features/change-requests/changeRequestOps";
import { ChangeRequestActions } from "@/features/change-requests/components/ChangeRequestActions";
import { ContentTab } from "@/features/change-requests/components/ContentTab";
// Phase-88-4:追記
// Phase-88(完了後の調整):追記
import { DetailedModeOnlyNotice } from "@/features/change-requests/components/DetailedModeOnlyNotice";
import { ExplanationTab } from "@/features/change-requests/components/ExplanationTab";
import { ImpactTab } from "@/features/change-requests/components/ImpactTab";
import { StatusBadge } from "@/features/change-requests/components/StatusBadge";
import { TraceTab } from "@/features/change-requests/components/TraceTab";
import { VerificationTab } from "@/features/change-requests/components/VerificationTab";
import { useGenerationPolling } from "@/hooks/useGenerationPolling";

// Phase-88-4：更新
// export type DetailTab = "content" | "impact" | "verification" | "trace";
// ↓↓
export type DetailTab = "content" | "impact" | "verification" | "explanation" | "trace";

const TABS: { value: DetailTab; label: string }[] = [
  { value: "content", label: "内容" },
  { value: "impact", label: "影響" },
  // Phase-87-4:追記
  { value: "verification", label: "検証" },
  // ── ここから Phase-87-3 の作成分 ──
  // Phase-88-4:追記
  { value: "explanation", label: "説明書" },
  { value: "trace", label: "たどる記録" },
];

// Phase-88-4：更新
// // 変更要求(CR)の詳細(SCR-010)。見出しに状態と操作、本文は4つのタブ(内容・影響・検証・たどる記録)。
// // タブの中身(予測・比較・検証・記録)は開いたときに読む。タブは選んだものだけを描く(入力中の
// ↓↓
// 変更要求(CR)の詳細(SCR-010)。見出しに状態と操作、本文は5つのタブ(内容・影響・検証・説明書・
// たどる記録)。タブの中身(予測・比較・検証・説明書・記録)は開いたときに読む。タブは選んだものだけを描く(入力中の
// フォームの状態を、親の再描画で失わないよう、部品を作り直さない)。文書への反映の完了待ちは、
// Phase-89(完了後の調整)：更新
// // タブを移っても続くようにここで持つ。
// ↓↓
// タブを移っても続くようにここで持ち、開いたときにプロジェクトが生成中なら待ち直す。
export function ChangeRequestDetailContent({ projectId, number }: { projectId: string; number: number }) {
  const detail = useChangeRequestsStore((s) => (s.projectId === projectId && s.detail?.number === number ? s.detail : null));
  const detailStatus = useChangeRequestsStore((s) => s.detailStatus);
  const detailError = useChangeRequestsStore((s) => s.detailError);
  const detailNotFound = useChangeRequestsStore((s) => s.detailNotFound);
  // Phase-88(完了後の調整):追記
  const unavailable = useChangeRequestsStore((s) => s.unavailable && s.projectId === projectId);
  const actionError = useChangeRequestsStore((s) => s.actionError);
  const reflecting = useChangeRequestsStore((s) => s.reflecting);
  const fetchDetail = useChangeRequestsStore((s) => s.fetchDetail);
  const onReflectionFinished = useChangeRequestsStore((s) => s.onReflectionFinished);
  // Phase-89(完了後の調整):追記
  const resumeReflection = useChangeRequestsStore((s) => s.resumeReflection);
  const [tab, setTab] = useState<DetailTab>("content");

  useEffect(() => {
    void fetchDetail(projectId, number);
    // Phase-89(完了後の調整):追記
    void resumeReflection(projectId);
    // Phase-89(完了後の調整)：更新
    // }, [projectId, number, fetchDetail]);
    // ↓↓
  }, [projectId, number, fetchDetail, resumeReflection]);

  const { timedOut } = useGenerationPolling(projectId, reflecting, (project) =>
    onReflectionFinished(projectId, number, project),
  );

  const back = (
    <Link href={`/projects/${projectId}/change-requests`}>
      <Text color="$blue10">← 変更要求の一覧</Text>
    </Link>
  );

  // Phase-88(完了後の調整):追記
  if (unavailable) return <DetailedModeOnlyNotice projectId={projectId} title={`CR-${number}`} />;
  if (detailNotFound) {
    return (
      <YStack paddingVertical="$4" gap="$3">
        <H2>{`CR-${number} は見つかりません`}</H2>
        {back}
      </YStack>
    );
  }

  return (
    <YStack paddingVertical="$4" gap="$4">
      <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
        <XStack gap="$3" alignItems="center" flexWrap="wrap">
          <H2>{detail ? `${detail.label} ${detail.title}` : `CR-${number}`}</H2>
          {detail ? <StatusBadge status={detail.status} label={detail.status_label} /> : null}
        </XStack>
        <XStack gap="$3" alignItems="center">
          {back}
          <Link href={`/projects/${projectId}/detailed-design`}>
            <Text color="$blue10">詳細設計</Text>
          </Link>
        </XStack>
      </XStack>

      {detailStatus === "loading" && detail === null ? <Text color="$color11">読み込み中...</Text> : null}
      {detailStatus === "error" ? (
        <Text role="alert" color="$red10">
          {detailError}
        </Text>
      ) : null}

      {detail ? (
        <>
          <ChangeRequestActions projectId={projectId} cr={detail} />
          {actionError ? (
            <Text role="alert" color="$red10">
              {actionError}
            </Text>
          ) : null}
          {reflecting && timedOut ? (
            <Text color="$color11">反映に時間がかかっています。しばらくしてから開き直してください。</Text>
          ) : null}

          <XStack gap="$2" role="tablist" flexWrap="wrap">
            {TABS.map((t) => (
              <Button
                key={t.value}
                size="$3"
                role="tab"
                aria-selected={tab === t.value}
                theme={tab === t.value ? "green" : undefined}
                chromeless={tab !== t.value}
                onPress={() => setTab(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </XStack>
          <YStack role="tabpanel" padding="$3" borderWidth={1} borderColor="$borderColor" borderRadius="$4">
            {tab === "content" ? <ContentTab projectId={projectId} cr={detail} /> : null}
            {tab === "impact" ? <ImpactTab projectId={projectId} cr={detail} /> : null}
            {/* Phase-87-4:追記 */}
            {tab === "verification" ? (
              isApplied(detail.status) ? (
                <VerificationTab projectId={projectId} cr={detail} />
              ) : (
                <Text color="$color11">検証は、文書へ反映した後にできます。</Text>
              )
            ) : null}
            {/* ── ここから Phase-87-3 の作成分 ── */}
            {/* Phase-88-4:追記 */}
            {tab === "explanation" ? <ExplanationTab projectId={projectId} cr={detail} /> : null}
            {tab === "trace" ? <TraceTab projectId={projectId} number={number} /> : null}
          </YStack>
        </>
      ) : null}
    </YStack>
  );
}
