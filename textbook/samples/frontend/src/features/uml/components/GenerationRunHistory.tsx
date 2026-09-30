// 作成：Phase-11-4
// 写経レベル: コア ── 「止まった理由」と「再度の生成指示が必要なこと」を見せる表示規則(describeResult)。
"use client";

import { H3, Text, YStack } from "tamagui";
import type { UmlGenerationResultRead, UmlGenerationRunRead } from "@/features/uml/api/types";
import {
  NOTATION_LABELS,
  OUTCOME_LABELS,
  REASON_LABELS,
  RUN_STATUS_LABELS,
} from "@/features/uml/labels";
import { useUmlStore } from "@/features/uml/uml-store";

// 生成履歴(GET /generation-runs)。図の数に上限を設けない代わりに、止まった理由と
// 「再度の生成指示が必要なこと」をここで見せる(Phase 10 の決定)。
export function GenerationRunHistory() {
  const runs = useUmlStore((s) => s.runs);

  return (
    <YStack gap="$2">
      <H3>生成履歴</H3>
      {runs.length === 0 ? <Text color="$color11">まだ生成していません。</Text> : null}
      {runs.map((run) => (
        <YStack key={run.id} gap="$1" padding="$2" borderWidth={1} borderColor="$borderColor">
          <Text fontWeight="700">
            {`${new Date(run.started_at).toLocaleString("ja-JP")} ${NOTATION_LABELS[run.notation]}(${RUN_STATUS_LABELS[run.status]})`}
          </Text>
          {run.requested.map((req) => (
            <Text key={req.diagram_id} fontSize="$2">
              {`${req.subject || "(全体)"}: ${describeResult(run, findResult(run, req.diagram_id))}`}
            </Text>
          ))}
        </YStack>
      ))}
    </YStack>
  );
}

function findResult(run: UmlGenerationRunRead, diagramId: string) {
  return run.results.find((r) => r.diagram_id === diagramId);
}

export function describeResult(
  run: UmlGenerationRunRead,
  result: UmlGenerationResultRead | undefined,
): string {
  if (!result) return run.status === "running" ? "処理待ち" : "結果なし";
  if (result.outcome === "succeeded") return OUTCOME_LABELS.succeeded;
  const reason = result.reason_code ? REASON_LABELS[result.reason_code] : result.message;
  return `${OUTCOME_LABELS[result.outcome]}(${reason ?? "理由不明"})。再度の生成指示が必要です`;
}
