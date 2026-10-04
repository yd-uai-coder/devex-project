// 作成：Phase-15-7｜更新：Phase-16-6,18-9,19-5,23-6
// 写経レベル: コア ── 状態の言葉と、承認できる条件(古い段階は承認し直せる)。
// Phase-18-9:追記 ── @/features/detailed-design/api/types.StageIssue
import type {
  DesignStageRead,
  StageIssue,
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
  // Phase-23-6：更新
  // 7: "実装計画",
  // ↓↓
  7: "横断事項と実装計画",
};

export const STATE_LABELS: Record<StageState, string> = {
  not_started: "未着手",
  draft: "下書き",
  // Phase-16-6:追記
  regenerated: "再生成済(未承認)",
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

// Phase-16-6:追記
// Phase-18-9：更新(図の未承認は承認時に出すので、承認ボタンを止めるエラーから除く)
// export function hasErrors(stage: DesignStageRead): boolean {
//   return stage.issues.some((issue) => issue.severity === "error");
// }
// ↓↓
// 図の承認待ち(段階2の DFD・段階3の ER・段階4の構成図)。図のエディタで承認すれば消える指摘なので、検証の結果の
// 一覧には常に出さず、段階の承認を押したときに理由として出す(承認ボタンは押せるようにする)。
// バックエンドは検証のエラーのまま残し、承認を 409 で断る(画面を通らない承認の守り。Phase 18)。
export const APPROVAL_TIME_CODES: ReadonlySet<string> = new Set([
  "DFD_NOT_APPROVED",
  "ER_NOT_APPROVED",
  // Phase-19-5:追記
  "COMPONENT_NOT_APPROVED",
]);

const isApprovalTime = (issue: StageIssue) =>
  issue.severity === "error" && APPROVAL_TIME_CODES.has(issue.code);

// 検証の結果の一覧に出す指摘(承認時に出すものを除く)。
export function visibleIssues(issues: StageIssue[]): StageIssue[] {
  return issues.filter((issue) => !isApprovalTime(issue));
}

// 段階の承認を押したときに、承認を止めて理由として出す指摘。
export function approvalBlockers(stage: DesignStageRead): StageIssue[] {
  return stage.issues.filter(isApprovalTime);
}

// 承認ボタンを止める検証のエラーがあるか(承認時に出すものは数えない)。
export function hasErrors(stage: DesignStageRead): boolean {
  return visibleIssues(stage.issues).some((issue) => issue.severity === "error");
}

// 承認ボタンを押せるか。古い段階は、内容を変えずに承認し直せる(入力の版を記録し直す)。
// Phase-16-6:追記
// 生成中・内容が空・検証のエラーがある段階は承認できない(バックエンドも409で断る。Phase 16)。
export function canApprove(stage: DesignStageRead): boolean {
  return (
    stage.is_open &&
    stage.version !== null &&
    // Phase-16-6:追記
    stage.model !== null &&
    stage.generation_status !== "generating" &&
    !hasErrors(stage) &&
    (stage.state === "draft" ||
      // Phase-16-6:追記
      stage.state === "regenerated" ||
      stage.state === "reviewing" ||
      stage.state === "outdated")
  );
}
