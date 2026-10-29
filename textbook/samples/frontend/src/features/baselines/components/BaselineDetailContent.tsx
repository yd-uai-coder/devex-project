// 作成：Phase-88-3｜更新：Phase-88(完了後の調整),109-2,116-4
"use client";

// Phase-88(完了後の調整):追記 ── next/navigation.useRouter, @/features/change-requests/components/DetailedModeOnlyNotice.DetailedModeOnlyNotice, @/features/baselines/baselineOps.newChangeRequestHref
// Phase-109-2:追記 ── @/features/change-requests/changeRequestOps.changeRequestLabel
// Phase-109-2：削除 ── @/features/change-requests/change-requests-store.useChangeRequestsStore, @/features/change-requests/components/StatusBadge.StatusBadge, @/features/baselines/baselineOps.includedChangeRequests
// Phase-116-4:追記 ── @/features/baselines/components/BaselineFreshnessNotice.BaselineFreshnessNotice
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, H2, H3, Paragraph, Text, XStack, YStack } from "tamagui";
import { ProjectNotFoundNotice } from "@/components/errors/ProjectNotFoundNotice";
import { changeRequestHref, changeRequestLabel } from "@/features/change-requests/changeRequestOps";
import { DetailedModeOnlyNotice } from "@/features/change-requests/components/DetailedModeOnlyNotice";
import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import { MarkdownBody } from "@/features/documents/components/MarkdownBody";
import type { BaselineItemRead } from "@/features/baselines/api/types";
import { useBaselinesStore } from "@/features/baselines/baselines-store";
import { BaselineFreshnessNotice } from "@/features/baselines/components/BaselineFreshnessNotice";
import {
  baselinesHref,
  itemLabel,
  newChangeRequestHref,
  itemStateLabel,
  stageOfKey,
} from "@/features/baselines/baselineOps";

// Phase-88(完了後の調整)：更新
// // 合意済みの版(束)の中身(SCR-010)。合意の記録・入れた変更要求・写した文書(md)・段階の表を出す。
// ↓↓
// 合意済みの版(束)の中身(SCR-010)。合意の記録・入れた変更要求・写した文書(md)・段階の表を出し、
// Phase-116-4：更新
// // この版を基準に変更要求を作るページへ移れる。
// ↓↓
// この版を基準に変更要求を作るページへ移れる。束が古ければ、作る前に知らせる。
// 段階の写し(model)の中身は出さない(重いため。詳細設計画面で今の段階を見る)
export function BaselineDetailContent({ projectId, number }: { projectId: string; number: number }) {
  // Phase-88(完了後の調整):追記
  const router = useRouter();
  const detail = useBaselinesStore((s) => (s.projectId === projectId && s.detail?.number === number ? s.detail : null));
  const detailStatus = useBaselinesStore((s) => s.detailStatus);
  const detailError = useBaselinesStore((s) => s.detailError);
  const detailNotFound = useBaselinesStore((s) => s.detailNotFound && s.projectId === projectId);
  // Phase-88(完了後の調整):追記
  const unavailable = useBaselinesStore((s) => s.unavailable && s.projectId === projectId);
  const fetchDetail = useBaselinesStore((s) => s.fetchDetail);
  // Phase-116-4:追記
  const freshness = useBaselinesStore((s) =>
    s.projectId === projectId && s.freshness?.baseline_number === number ? s.freshness : null,
  );
  // Phase-109-2：削除
  // const changeRequests = useChangeRequestsStore((s) => (s.projectId === projectId ? s.list : []));
  // const fetchChangeRequests = useChangeRequestsStore((s) => s.fetchList);

  useEffect(() => {
    void fetchDetail(projectId, number);
  // Phase-109-2：更新
  //   void fetchChangeRequests(projectId);
  // }, [projectId, number, fetchDetail, fetchChangeRequests]);
  // ↓↓
  }, [projectId, number, fetchDetail]);

  if (detailNotFound) return <ProjectNotFoundNotice />;
  // Phase-88(完了後の調整):追記
  if (unavailable) return <DetailedModeOnlyNotice projectId={projectId} title="合意済みの版" />;

  const header = (
    <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
      <H2>{detail ? `${detail.label} 合意済みの版` : "合意済みの版"}</H2>
      <Link href={baselinesHref(projectId)}>
        <Text color="$blue10">← 合意済みの版の一覧</Text>
      </Link>
    </XStack>
  );
  if (!detail) {
    return (
      <YStack paddingVertical="$4" gap="$4">
        {header}
        {detailStatus === "error" ? (
          <Text role="alert" color="$red10">
            {detailError}
          </Text>
        ) : (
          <Text color="$color11">読み込み中...</Text>
        )}
      </YStack>
    );
  }

  const documents = detail.items.filter((i) => stageOfKey(i.key) === null);
  const stages = detail.items.filter((i) => stageOfKey(i.key) !== null);
  // Phase-109-2：更新
  // const included = includedChangeRequests(changeRequests, detail.number);
  // ↓↓
  const included = detail.included_change_requests;

  return (
    <YStack paddingVertical="$4" gap="$4">
      {header}
      {/* Phase-116-4:追記 */}
      <BaselineFreshnessNotice
        projectId={projectId}
        freshness={freshness}
        lead={`この版を基準に変更要求を作ると、対象の要件の文・説明・規模は ${detail.label} の設計から求めます。`}
      />
      {freshness && !freshness.tracked ? (
        <Text color="$color11">
          この版は合意の記録を始める前に作ったので、後に反映した変更要求があるかは判定できません。
        </Text>
      ) : null}
      {/* Phase-88(完了後の調整):追記 */}
      {/* 変更要求は、合意済みの版の中身から作る(基準の版はこの版に固定する) */}
      <XStack>
        <Button size="$3" theme="green" onPress={() => router.push(newChangeRequestHref(projectId, detail.number))}>
          この版を基準に変更要求を作る →
        </Button>
      </XStack>

      <YStack gap="$1">
        <H3>合意の記録</H3>
        <Text>合意の日時: {new Date(detail.agreed_at).toLocaleString("ja-JP")}</Text>
        <Text>相手: {detail.counterpart ?? "(記録なし)"}</Text>
        <Text whiteSpace="pre-wrap">理由: {detail.reason}</Text>
        {detail.memo ? <Text whiteSpace="pre-wrap">打ち合わせのメモ: {detail.memo}</Text> : null}
        <Text color="$color11">記録した日時: {new Date(detail.created_at).toLocaleString("ja-JP")}</Text>
      </YStack>

      <YStack gap="$1">
        <H3>入れた変更要求</H3>
        {included.length === 0 ? (
          <Text color="$color11">この版に入れた変更要求はありません。</Text>
        ) : (
          included.map((cr) => (
            <XStack key={cr.number} gap="$2" alignItems="center">
              <Link href={changeRequestHref(projectId, cr.number)}>
                {/* Phase-109-2：更新 */}
                {/* <Text color="$blue10">{cr.label}</Text> */}
                {/* ↓↓ */}
                <Text color="$blue10">{changeRequestLabel(cr.number)}</Text>
              </Link>
              <Text>{cr.title}</Text>
              {/* Phase-109-2：削除 */}
              {/* <StatusBadge status={cr.status} label={cr.status_label} /> */}
            </XStack>
          ))
        )}
      </YStack>

      <YStack gap="$2">
        <H3>写した文書</H3>
        {documents.map((item) => (
          <DocumentSnapshot key={item.key} item={item} />
        ))}
      </YStack>

      <YStack gap="$2">
        <H3>段階</H3>
        <Paragraph color="$color11" size="$2">
          入ったのは、作った時点で承認の写しがあった段階です。状態は作った時点のもの(承認の後に直した・古い、も含む)。
        </Paragraph>
        <table style={TABLE} aria-label="束の段階">
          <thead>
            <tr>
              <th style={HEAD}>段階</th>
              <th style={HEAD}>束に</th>
              <th style={HEAD}>作った時点の状態</th>
              <th style={HEAD}>承認した版</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((item) => (
              <tr key={item.key}>
                <td style={CELL}>{itemLabel(item.key)}</td>
                <td style={CELL}>{item.included ? "入った" : "入っていない"}</td>
                <td style={CELL}>{itemStateLabel(item)}</td>
                <td style={{ ...CELL, ...MONO }}>{item.source_version !== null ? `v${item.source_version}` : "─"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </YStack>
    </YStack>
  );
}

// 写した文書1つ。md は開いたときだけ描く(3つとも長いため)
function DocumentSnapshot({ item }: { item: BaselineItemRead }) {
  const [open, setOpen] = useState(false);
  const label = itemLabel(item.key);
  if (!item.included || item.content === null) {
    return (
      <Text color="$color11">
        {label}: {itemStateLabel(item)}(作った時点で無かった)
      </Text>
    );
  }
  return (
    <YStack gap="$2">
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <Text fontWeight="bold">{label}</Text>
        <Text color="$color11">
          {item.source_version !== null ? `v${item.source_version}` : ""}
          {item.generated_model ? ` ・${item.generated_model}` : ""}
        </Text>
        <Button size="$2" onPress={() => setOpen(!open)} aria-expanded={open}>
          {open ? `${label}を閉じる` : `${label}を見る`}
        </Button>
      </XStack>
      {open ? <MarkdownBody content={item.content} label={`${label}の写し`} /> : null}
    </YStack>
  );
}
