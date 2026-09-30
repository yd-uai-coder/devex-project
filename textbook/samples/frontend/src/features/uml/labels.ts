// 作成：Phase-11-4
// 写経レベル: 定型 ── 列挙値の表示ラベル。
import type {
  DiagramStatus,
  GenerationOutcome,
  GenerationReasonCode,
  GenerationRunStatus,
  NotationType,
  UmlDiagramRead,
} from "@/features/uml/api/types";

// UML 画面で共通に使う表示ラベル(値はバックエンドの列挙値)。

export const NOTATION_LABELS: Record<NotationType, string> = {
  component: "コンポーネント図",
  er: "ER図",
  dfd: "データフロー図",
};

export const DIAGRAM_STATUS_LABELS: Record<DiagramStatus, string> = {
  draft: "下書き",
  reviewing: "レビュー中",
  approved: "承認済み",
  exported: "出力済み",
};

export const RUN_STATUS_LABELS: Record<GenerationRunStatus, string> = {
  running: "実行中",
  completed: "完了",
  partial: "一部失敗",
  failed: "失敗",
};

export const OUTCOME_LABELS: Record<GenerationOutcome, string> = {
  succeeded: "成功",
  failed: "失敗",
  skipped: "未着手",
};

// 止まった理由(app/uml/generation/failures.py の分類)
export const REASON_LABELS: Record<GenerationReasonCode, string> = {
  QUOTA_EXCEEDED: "AIの利用上限に達しました",
  TOKEN_LIMIT: "出力が長すぎて途中で止まりました",
  INVALID_OUTPUT: "AIの出力が形式に合いませんでした",
  GENERATION_FAILED: "生成に失敗しました",
};

// component・ER 全体図は subject が空文字
export function diagramTitle(diagram: Pick<UmlDiagramRead, "notation" | "subject">): string {
  const notation = NOTATION_LABELS[diagram.notation];
  return diagram.subject ? `${notation}: ${diagram.subject}` : `${notation}(全体)`;
}
