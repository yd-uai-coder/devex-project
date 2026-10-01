// 作成：Phase-15-7
// 写経レベル: コア ── 状態の言葉と、承認できる条件(古い段階は承認し直せる)。
import type {
  DesignStageRead,
  StageState,
} from "@/features/detailed-design/api/types";

// 段階と詳細設計書の章は1対1(docs/external_design.md 2.7節の段階表)。
export const STAGE_TITLES: Record<number, string> = {
  1: "機能一覧",
  2: "データフロー",
  3: "データモデル",
  4: "ソフトウェア構造",
  5: "主要処理の手順",
  6: "処理ロジックの詳細(任意)",
  7: "実装計画",
};

export const STATE_LABELS: Record<StageState, string> = {
  not_started: "未着手",
  draft: "下書き",
  reviewing: "レビュー中",
  approved: "承認済み",
  outdated: "古い",
};

const DOC_LABELS: Record<string, string> = {
  requirements: "要件定義書",
  external_design: "外部設計書",
};

// バックエンドの missing_inputs("stage:<n>" / "doc:<doc_type>")を、何が足りないかの言葉にする。
export function describeMissingInput(key: string): string {
  const [kind, value] = key.split(":");
  if (kind === "stage")
    return `段階${value}(${STAGE_TITLES[Number(value)] ?? ""})の承認`;
  if (kind === "doc") return DOC_LABELS[value] ?? value;
  return key;
}

// 承認ボタンを押せるか。古い段階は、内容を変えずに承認し直せる(入力の版を記録し直す)。
export function canApprove(stage: DesignStageRead): boolean {
  return (
    stage.is_open &&
    stage.version !== null &&
    (stage.state === "draft" ||
      stage.state === "reviewing" ||
      stage.state === "outdated")
  );
}
