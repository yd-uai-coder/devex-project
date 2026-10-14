// 作成：Phase-54-3
// 差し戻し: AI 設計レビューの採用した指摘から、段階を作り直す先と引数を決める(純粋関数)。
//
// 指摘の対象(「F-03」「テーブル projects」など)から、それを載せている段階を `locateTargetStage` で
// 推定し、最も多くの指摘が当たる段階(同数なら上流)を作り直す先の初期値にする。段階5・6・8 は
// 部分再生成なので、指摘の対象を要素のキーに結んで(`resolveFixTarget`)作り直す行を決める。

import type { DesignStageRead } from "@/features/detailed-design/api/types";
import {
  locateTargetStage,
  regenerationArgs,
  resolveFixTarget,
  type RegenerationArgs,
} from "@/features/detailed-design/impactOps";
import type { ReviewFindingRead } from "@/features/design-review/api/reviewApi";

// 部分再生成の段階(作り直す行を指摘の対象から決める)
const PARTIAL_STAGES = new Set([5, 6, 8]);

// 作り直す段階の初期値。どの指摘も段階に当たらなければ、実装計画書(詳細)の指摘は段階7、それ以外は null
export function sendbackStage(findings: ReviewFindingRead[], stages: DesignStageRead[]): number | null {
  const counts = new Map<number, number>();
  for (const f of findings) {
    const located = new Set(
      f.targets.map((t) => locateTargetStage(t, stages)).filter((s): s is number => s !== null),
    );
    for (const stage of located) counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  if (best) return best[0];
  return findings.some((f) => f.documents?.includes("detailed_plan")) ? 7 : null;
}

// 段階の作り直しの引数。段階5・6・8 は指摘の対象から行を決め、1つも決まらなければ null(作り直せない)。
// ほかの段階は段階全体を作り直す(引数なし)
export function sendbackArgs(
  stage: number,
  findings: ReviewFindingRead[],
  stages: DesignStageRead[],
): RegenerationArgs | null {
  if (!PARTIAL_STAGES.has(stage)) return {};
  const keys = [
    ...new Set(
      findings.flatMap((f) => f.targets.map((t) => resolveFixTarget(stage, t, stages))).filter((k): k is string => k !== null),
    ),
  ];
  const plan = stages.find((s) => s.stage === 8)?.plan ?? null;
  const args = regenerationArgs(stage, keys, plan);
  const count = (args.functionIds?.length ?? 0) + (args.logics?.length ?? 0) + (args.unitIds?.length ?? 0);
  return count > 0 ? args : null;
}
