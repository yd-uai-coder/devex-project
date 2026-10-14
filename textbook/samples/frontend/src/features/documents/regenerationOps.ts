// 作成：Phase-53(完了後の調整)
// プレビューの再生成の起点と進み具合(純粋関数)。
//
// 下流の文書は上流を入力にして作るので、ある文書を作り直したら下流も必ず作り直す(整合を保つため)。
// 再生成は「どこから作り直すか」(起点)で選ぶ。実装計画は内部設計を入力にするので、内部設計からの
// 再生成は実装計画も作り直す。

import type { DocType, GenerationProgressRead } from "@/features/documents/api/documentsApi";

export const DOC_LABEL: Record<DocType, string> = {
  requirements: "要件定義",
  external_design: "外部設計",
  internal_design: "内部設計",
  implementation_plan: "実装計画",
};

// モードの文書(上流から)。詳細設計モードのプレビューは要件定義・外部設計だけ
export function modeDocTypes(mode: "simple" | "detailed"): DocType[] {
  return mode === "detailed"
    ? ["requirements", "external_design"]
    : ["requirements", "external_design", "internal_design", "implementation_plan"];
}

// 起点から作り直す文書(起点と下流)
export function regenerationTargets(docTypes: DocType[], startFrom: DocType): DocType[] {
  const index = docTypes.indexOf(startFrom);
  return index < 0 ? [] : docTypes.slice(index);
}

// 起点の選択肢の文言(最初は「から」、最後は「だけ」、間は「以降」)
export function startLabel(docTypes: DocType[], startFrom: DocType): string {
  const index = docTypes.indexOf(startFrom);
  if (index === 0) return `${DOC_LABEL[startFrom]}から再生成`;
  if (index === docTypes.length - 1) return `${DOC_LABEL[startFrom]}だけを再生成`;
  return `${DOC_LABEL[startFrom]}以降を再生成`;
}

export type ProgressState = "done" | "running" | "waiting" | "excluded";

export const PROGRESS_LABEL: Record<ProgressState, string> = {
  done: "生成完了",
  running: "生成中",
  waiting: "待ち",
  excluded: "対象外",
};

// 文書ごとの状態。上流から1つずつ作るので、まだ着手していない対象は「待ち」
export function progressStates(
  docTypes: DocType[],
  progress: GenerationProgressRead,
): { type: DocType; state: ProgressState }[] {
  return docTypes.map((type) => {
    if (!progress.targets.includes(type)) return { type, state: "excluded" };
    if (progress.done.includes(type)) return { type, state: "done" };
    return { type, state: progress.current === type ? "running" : "waiting" };
  });
}

export function progressText(docTypes: DocType[], progress: GenerationProgressRead): string {
  return progressStates(docTypes, progress)
    .map(({ type, state }) => `${DOC_LABEL[type]}：${PROGRESS_LABEL[state]}`)
    .join("　");
}
