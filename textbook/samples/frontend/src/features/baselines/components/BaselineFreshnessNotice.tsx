// 作成：Phase-116-4
"use client";

import Link from "next/link";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import type { BaselineFreshnessRead } from "@/features/baselines/api/types";
import { baselineCreateHref, baselineHref, needsRebuild } from "@/features/baselines/baselineOps";
import { changeRequestHref, changeRequestLabel } from "@/features/change-requests/changeRequestOps";
import { elementLabel } from "@/features/materials/materialOps";

const LIST = { margin: 0, paddingLeft: "1.5em", fontSize: 14 } as const;

// 束が古いときの知らせ(docs/external_design.md 2.17節「束が古いときの知らせ」)。資料の取り込み・CR の詳細・
// 共有リンクの作成・束の中身で同じ形で出す(止めはしない)。理由は、後の束・束の後に反映した CR(書き換えた要素)・
// 束を作った時点で承認のままでなかった段階。束の後の CR や古い段階があれば、段階を最新にしてから束を作り直す
// ように案内し、後の束があるだけなら最新の束へ案内する。新しい束・鮮度が無いときは何も出さない
export function BaselineFreshnessNotice({
  projectId,
  freshness,
  lead,
}: {
  projectId: string;
  freshness: BaselineFreshnessRead | null | undefined;
  // 画面ごとの1文目(何がこの束から数えた・比べたものか)
  lead?: string;
}) {
  if (!freshness || freshness.fresh) return null;
  const label = freshness.label;
  const latest = freshness.newer_numbers.length > 0 ? Math.max(...freshness.newer_numbers) : null;

  return (
    <YStack
      gap="$2"
      padding="$3"
      borderWidth={1}
      borderColor="$orange8"
      borderRadius="$4"
      aria-label={`${label} が古いことの知らせ`}
    >
      <Text fontWeight="600" color="$orange11">
        {`合意済みの版 ${label} は、今の合意と食い違っているかもしれません`}
      </Text>
      {lead ? (
        <Paragraph color="$color11" fontSize="$3">
          {lead}
        </Paragraph>
      ) : null}
      <ul style={LIST}>
        {freshness.newer_numbers.length > 0 ? (
          <li>{`${label} の後に ${freshness.newer_numbers.map((n) => `B-${n}`).join("・")} を作りました(${label} は最新ではありません)。`}</li>
        ) : null}
        {freshness.applied_after.length > 0 ? (
          <li>
            {`${label} を作った後に反映した変更要求: `}
            {freshness.applied_after.map((applied, index) => (
              <span key={applied.number}>
                {index > 0 ? "、" : ""}
                <Link href={changeRequestHref(projectId, applied.number)} style={{ color: "var(--blue10)" }}>
                  {changeRequestLabel(applied.number)}
                </Link>
                {applied.keys.length > 0 ? `(${applied.keys.map(elementLabel).join("・")} を書き換え)` : ""}
              </span>
            ))}
          </li>
        ) : null}
        {freshness.outdated_stages.length > 0 ? (
          <li>{`${label} を作った時点で、${freshness.outdated_stages.map((n) => `段階${n}`).join("・")} が承認のままではありませんでした(古い段階の写しが入っています)。`}</li>
        ) : null}
      </ul>
      {needsRebuild(freshness) ? (
        <XStack gap="$3" flexWrap="wrap" alignItems="center">
          <Text fontSize="$3">段階を最新にしてから、合意済みの版を作り直してください。</Text>
          {freshness.outdated_stages.length > 0 ? (
            <Link href={`/projects/${projectId}/detailed-design`}>
              <Text color="$blue10">詳細設計で段階を見る →</Text>
            </Link>
          ) : null}
          <Link href={baselineCreateHref(projectId)}>
            <Text color="$blue10">合意済みの版を作り直す →</Text>
          </Link>
        </XStack>
      ) : latest !== null ? (
        <Link href={baselineHref(projectId, latest)}>
          <Text color="$blue10">{`最新の B-${latest} を見る →`}</Text>
        </Link>
      ) : null}
    </YStack>
  );
}
