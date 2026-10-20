// 作成：Phase-87-4
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import type { ChangeRequestSummaryRead } from "@/features/change-requests/api/types";
import { PARTIAL_STAGES, changeRequestHref, stageLabel, stagesMarkedBy } from "@/features/change-requests/changeRequestOps";
import type { DesignImpactRead } from "@/features/detailed-design/api/types";
import { INPUT, OPTION } from "@/features/detailed-design/components/tableStyles";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";

// 詳細設計画面の「変更の影響」の中に置く、変更要求(CR)を段階の生成に渡す欄(docs/external_design.md
// 2.14節「反映」)。文書へ反映した後の、反映済みの CR を選ぶ(初期値は印の出どころの CR)。選んだ CR は
// 再生成の候補(段階5・6・8 の部分再生成)に渡り、それ以外の段階は、その CR の印がある段階ごとに
// 「作り直す」のボタンを出す。反映済みの CR が無ければ何も出さない。
export function CrReflectionSection({
  projectId,
  impact,
  applied,
  crNumber,
  onChange,
}: {
  projectId: string;
  impact: DesignImpactRead | null;
  applied: ChangeRequestSummaryRead[];
  crNumber: number | null;
  onChange: (crNumber: number | null) => void;
}) {
  const stages = useDetailedDesignStore((s) => s.stages);
  const requesting = useDetailedDesignStore((s) => s.requestingGeneration);
  const generate = useDetailedDesignStore((s) => s.generate);
  const selectStage = useDetailedDesignStore((s) => s.selectStage);
  const [confirming, setConfirming] = useState<number | null>(null);

  if (applied.length === 0) return null;
  const wholeStages =
    crNumber === null ? [] : stagesMarkedBy(impact, crNumber).filter((stage) => !PARTIAL_STAGES.includes(stage));

  return (
    <YStack gap="$2" aria-label="変更要求を段階に反映">
      <Text fontWeight="600">変更要求(CR)を段階に反映</Text>
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <select
          style={{ ...INPUT, width: "auto" }}
          aria-label="段階の生成に渡す変更要求"
          value={crNumber ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="" style={OPTION}>
            渡さない
          </option>
          {applied.map((cr) => (
            <option key={cr.number} value={cr.number} style={OPTION}>
              {`${cr.label} ${cr.title}`}
            </option>
          ))}
        </select>
        {crNumber !== null ? (
          <Link href={changeRequestHref(projectId, crNumber)}>
            <Text color="$blue10" fontSize="$2">
              CR を開く
            </Text>
          </Link>
        ) : null}
      </XStack>
      <Text fontSize="$2" color="$color11">
        選んだ CR は、下の再生成の候補(段階5・6・8)と、段階の作り直しの修正指示に入ります。作り直した段階を確かめて
        承認し、CR の「検証」で印の状態を確かめてください。
      </Text>
      {wholeStages.map((stage) => {
        const view = stages.find((s) => s.stage === stage);
        const disabled = !view?.is_open || view.generation_status === "generating" || requesting;
        return (
          <XStack key={stage} gap="$2" alignItems="center">
            <Button size="$2" disabled={disabled} onPress={() => setConfirming(stage)}>
              {`${stageLabel(stage)} を CR-${crNumber} で作り直す`}
            </Button>
          </XStack>
        );
      })}
      <ConfirmDialog
        open={confirming !== null}
        title="段階を作り直す"
        description={
          confirming !== null
            ? `${stageLabel(confirming)} を、CR-${crNumber} を修正指示に入れて作り直します(今の下書きは置き換わります)。`
            : ""
        }
        confirmLabel="作り直す"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const stage = confirming;
          setConfirming(null);
          if (stage === null || crNumber === null) return;
          // 生成の完了は段階のパネルが待つので、先にその段階へ移る
          selectStage(stage);
          void generate(projectId, stage, undefined, undefined, undefined, [], crNumber);
        }}
      />
    </YStack>
  );
}
