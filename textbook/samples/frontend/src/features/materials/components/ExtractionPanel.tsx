// 作成：Phase-116-3｜更新：Phase-116-4
"use client";

// Phase-116-4:追記 ── @/features/baselines/components/BaselineFreshnessNotice.BaselineFreshnessNotice
import Link from "next/link";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { baselinesHref } from "@/features/baselines/baselineOps";
import { BaselineFreshnessNotice } from "@/features/baselines/components/BaselineFreshnessNotice";
import type { MaterialDifferencesRead } from "@/features/materials/api/types";
import { useMaterialsStore } from "@/features/materials/materials-store";
import { isExtractionOutdated } from "@/features/materials/materialOps";

// 違いの取り出し(docs/external_design.md 2.17節「比べる相手」「違いの一覧」)。比べる相手は今の最新の束。
// 直近の取り出しの回(比べた束・モデル・日時)を出し、取り出した後に束を作り直していれば取り出し直しを促す
// Phase-116-4：更新
// // (そのままでは CR にできない)。取り出しは AI を同期で1回呼ぶ。束が無ければ取り出せない
// ↓↓
// (そのままでは CR にできない)。取り出しは AI を同期で1回呼ぶ。束が無ければ取り出せない。最新の束が古ければ、
// 取り出しの前に知らせる(止めない。古い束と比べると、束の後の CR で変えた所が違いとして出る)
export function ExtractionPanel({
  projectId,
  materialId,
  view,
}: {
  projectId: string;
  materialId: string;
  view: MaterialDifferencesRead;
}) {
  const extracting = useMaterialsStore((s) => s.extracting);
  const acting = useMaterialsStore((s) => s.acting);
  const extract = useMaterialsStore((s) => s.extract);
  // Phase-116-4:追記
  const latestFreshness = useMaterialsStore((s) => s.latestFreshness);
  const latest = view.latest_baseline_number;
  const extraction = view.extraction;
  const outdated = isExtractionOutdated(view);

  if (latest === null) {
    return (
      <Text color="$color11">
        合意済みの版がまだありません。比べる相手が無いので、違いを取り出せません。先に
        <Link href={baselinesHref(projectId)}>
          <Text color="$blue10">合意済みの版</Text>
        </Link>
        を作ってください。
      </Text>
    );
  }

  return (
    <YStack gap="$2" aria-label="違いの取り出し">
      {extraction ? (
        <Text color="$color11">
          {`${extraction.baseline_label} と比べて取り出しました(${extraction.generated_model ?? "モデル不明"}・${new Date(
            extraction.generated_at,
          ).toLocaleString("ja-JP")})。`}
        </Text>
      ) : (
        <Text color="$color11">まだ違いを取り出していません。</Text>
      )}
      {/* Phase-116-4:追記 */}
      {/* 今の最新の束が古ければ下の知らせが同じことを言うので、取り出した後に新しくなったときだけ出す */}
      {extraction && !extraction.freshness.fresh && !outdated && latestFreshness?.fresh === true ? (
        <Text color="$color11">{`取り出したとき、${extraction.baseline_label} は古い版でした。`}</Text>
      ) : null}
      <BaselineFreshnessNotice
        projectId={projectId}
        freshness={latestFreshness?.baseline_number === latest ? latestFreshness : null}
        lead={`違いは最新の版 B-${latest} と比べて取り出します。古い版と比べると、版の後に反映した変更要求で変えた所が違いとして出たり、違いを見落としたりします。`}
      />
      {outdated ? (
        <Text color="$orange11">
          {`取り出した後に、合意済みの版 B-${latest} が作られました。この一覧の対象は古い版のものなので、CR にする前に取り出し直してください。`}
        </Text>
      ) : null}
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <Button
          size="$3"
          theme={extraction && !outdated ? undefined : "green"}
          disabled={extracting || acting}
          onPress={() => void extract(projectId, materialId)}
        >
          {extracting ? "取り出しています..." : `最新の版 B-${latest} と比べて違いを${extraction ? "取り出し直す" : "取り出す"}`}
        </Button>
      </XStack>
      <Paragraph color="$color11" size="$2">
        AI を1回呼びます(数十秒かかることがあります)。取り出し直すと、未確認と弾いた違いは新しい結果に置き換わり、CR にした・捨てた違いは残ります。
      </Paragraph>
    </YStack>
  );
}
