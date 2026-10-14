// 作成：Phase-53(完了後の調整)
import { useCallback, useMemo } from "react";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { reviewFindingsByKey, type StageReviewItem } from "@/features/detailed-design/reviewMarks";
import { useReviewStore } from "@/features/design-review/review-store";

const NONE: StageReviewItem[] = [];

// 段階の表の行に出す AI 設計レビューの指摘。findings(key) はその要素の指摘(無ければ空)。
// レビューがオフのアカウントでは常に空。projectId は採否を記録する先。
export function useStageReview(stage: number): {
  findings: (key: string) => StageReviewItem[];
  projectId: string | null;
} {
  const effective = useReviewStore((s) => s.me?.review_effective ?? false);
  const gates = useReviewStore((s) => s.gates);
  const stages = useDetailedDesignStore((s) => s.stages);
  const projectId = useDetailedDesignStore((s) => s.projectId);
  const byKey = useMemo(
    () => (effective ? reviewFindingsByKey(gates, stages, stage) : new Map<string, StageReviewItem[]>()),
    [effective, gates, stages, stage],
  );
  const findings = useCallback((key: string) => byKey.get(key) ?? NONE, [byKey]);
  return { findings, projectId };
}
