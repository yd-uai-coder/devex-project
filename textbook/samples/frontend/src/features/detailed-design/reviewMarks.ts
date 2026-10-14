// 作成：Phase-53(完了後の調整)
// 詳細設計の各段階の表に出す、AI 設計レビューの指摘(純粋関数)。
//
// 指摘の対象(LLM が書く文字列。「F-03」「テーブル projects」「app/services/x.py」など)ごとに、段階の
// 要素のキーを `resolveFixTarget`(「段階Nで直す」と同じ推定)で求める。1つの対象が複数の段階に当たれば、
// それぞれの段階の行に出す。当たらない対象(要件 ID・画面など)は表には出さない(レビューのパネルに出る)。
// 却下した指摘は出さない。

import type { DesignStageRead } from "@/features/detailed-design/api/types";
import { resolveFixTarget } from "@/features/detailed-design/impactOps";
import type {
  ReviewFindingRead,
  ReviewGate,
  ReviewGateSummaryRead,
  ReviewLevel,
} from "@/features/design-review/api/reviewApi";

export type StageReviewItem = {
  finding: ReviewFindingRead;
  gate: ReviewGate;
  // レビューした版が今の版と同じか(違えば、文書・段階が変わる前のレビュー)
  isCurrent: boolean;
};

const LEVEL_ORDER: Record<ReviewLevel, number> = { critical: 0, major: 1, minor: 2 };

export function reviewFindingsByKey(
  gates: ReviewGateSummaryRead[],
  stages: DesignStageRead[],
  stage: number,
): Map<string, StageReviewItem[]> {
  const byKey = new Map<string, StageReviewItem[]>();
  for (const g of gates) {
    if (!g.run || g.run.status !== "succeeded") continue;
    for (const finding of g.run.findings) {
      if (finding.decision === "rejected") continue;
      const keys = new Set(
        finding.targets
          .map((target) => resolveFixTarget(stage, target, stages))
          .filter((key): key is string => key !== null),
      );
      for (const key of keys) {
        byKey.set(key, [...(byKey.get(key) ?? []), { finding, gate: g.gate, isCurrent: g.run.is_current }]);
      }
    }
  }
  for (const items of byKey.values()) {
    items.sort((a, b) => LEVEL_ORDER[a.finding.level] - LEVEL_ORDER[b.finding.level]);
  }
  return byKey;
}
