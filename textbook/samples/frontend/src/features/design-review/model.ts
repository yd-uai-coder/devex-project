// 作成：Phase-53-3｜更新：Phase-53-4,53(完了後の調整)
// AI 設計レビューの画面の意味モデル(純粋関数)。見せ方はデモ /design-review-demo で決めたもの。
//
// レビューは別のモデル(Sonnet)が指摘だけを返し、設計は書き換えない。人が指摘ごとに採用・却下・保留を
// 付ける(採用した指摘を再生成・聞き直しに使うのは Phase 54)。区切りは、文書の生成の後(自動)と、
// 詳細設計モードの段階6・7の承認の後(ボタン)。

import type { DocType } from "@/features/documents/api/documentsApi";
import type {
  FindingDecision,
  GateStatus,
  ReviewCause,
  ReviewFindingRead,
  ReviewGate,
  ReviewGateSummaryRead,
  ReviewLevel,
} from "@/features/design-review/api/reviewApi";

export const LEVEL_LABEL: Record<ReviewLevel, string> = { critical: "最重要", major: "中程度", minor: "軽微" };
export const CAUSE_LABEL: Record<ReviewCause, string> = { hearing: "ヒアリング", design: "設計", inconsistency: "不整合" };
export const DECISION_LABEL: Record<FindingDecision, string> = {
  pending: "未判断",
  adopted: "採用",
  rejected: "却下",
  held: "保留",
};
export const GATE_LABEL: Record<ReviewGate, string> = {
  documents: "文書の生成の後",
  stage6: "段階6の承認の後",
  stage7: "段階7の承認の後",
};
export const STATUS_TEXT: Record<GateStatus, string> = {
  not_ready: "文書がまだ無い",
  unreviewed: "未レビュー",
  running: "レビュー中",
  reviewed: "レビュー済み",
  failed: "失敗(自己診断に切り替え)",
};

const LEVEL_ORDER: Record<ReviewLevel, number> = { critical: 0, major: 1, minor: 2 };

// 区切りに渡す文書(簡易モードは文書の区切りだけで4文書)
export function gateDocuments(gate: ReviewGate, detailed: boolean): string {
  if (gate === "documents") return detailed ? "要件定義書・外部設計書" : "4文書";
  return gate === "stage6" ? "要件・外部・詳細設計書" : "要件・外部・詳細設計書・実装計画書";
}

// 段階6・7 はボタンで流す。文書の区切りは生成の後に自動で流れ、ボタンは流し直し
export function triggerLabel(gate: ReviewGate): string {
  return gate === "documents" ? "自動" : "ボタン";
}

// 区切りで押せる操作の文言。そろっていない・実行中は押せない(null)
export function actionLabel(status: GateStatus): string | null {
  if (status === "not_ready" || status === "running") return null;
  return status === "unreviewed" ? "レビューする" : "もう一度レビュー";
}

export function sortFindings(findings: ReviewFindingRead[]): ReviewFindingRead[] {
  return [...findings].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.position - b.position);
}

export function decisionCounts(findings: ReviewFindingRead[]): Record<FindingDecision, number> {
  const counts: Record<FindingDecision, number> = { pending: 0, adopted: 0, rejected: 0, held: 0 };
  for (const f of findings) counts[f.decision] += 1;
  return counts;
}

export function isRunning(gates: ReviewGateSummaryRead[]): boolean {
  return gates.some((g) => g.status === "running");
}

// 手順書を生成するときの知らせ(止めはしない)。そろっているのにレビューしていない・失敗した区切りを挙げる
export function unreviewedNotice(gates: ReviewGateSummaryRead[]): string | null {
  const pending = gates.filter((g) => g.status === "unreviewed" || g.status === "failed").map((g) => GATE_LABEL[g.gate]);
  if (pending.length === 0) return null;
  return `未レビューの区切りがあります(${pending.join("・")})。このまま手順書を生成できます。`;
}

// 指摘の対象(文書の中の ID・名前)から、それを載せている文書を推定する。当たらなければ null。
// 要件 ID(FR-/NFR-/CON-)は要件定義書、画面(SCR-)・API(メソッド + パス)は外部設計書、処理別の
// データフロー(DF-)・テーブルは内部設計書、マイルストーン・単位(M-)は実装計画書。
export function documentOfTarget(target: string): DocType | null {
  const text = target.trim();
  if (/^(FR|NFR|CON)-\d+/.test(text)) return "requirements";
  if (/^SCR-\d+/.test(text) || /^(GET|POST|PUT|PATCH|DELETE)\s+\//.test(text)) return "external_design";
  if (/^DF-\d+/.test(text) || text.startsWith("テーブル")) return "internal_design";
  if (/^M-\d+/.test(text)) return "implementation_plan";
  return null;
}

// Phase-53-4:追記
// 指摘の対象から飛ぶ操作(画面ごとに作る。作業領域は段階の表、プレビューは文書のタブ)
export type TargetAction = { label: string; onPress: () => void };
export type TargetActionOf = (target: string) => TargetAction | null;

// Phase-53(完了後の調整):追記
// 指摘が関連する文書の凡例(表の幅を取らないよう、文書を A〜D の1文字で出す)。詳細設計モードの段階の
// 区切りでは、C が詳細設計書・D が段階7の実装計画書になる
export const DOCUMENT_LETTER: Record<string, string> = {
  requirements: "A",
  external_design: "B",
  internal_design: "C",
  implementation_plan: "D",
  detailed_design: "C",
  detailed_plan: "D",
};

export function documentLegend(gate: ReviewGate): { letter: string; label: string }[] {
  const stage = gate !== "documents";
  return [
    { letter: "A", label: "要件定義" },
    { letter: "B", label: "外部設計" },
    { letter: "C", label: stage ? "詳細設計" : "内部設計" },
    { letter: "D", label: stage ? "実装計画(詳細)" : "実装計画" },
  ];
}

// 指摘の関連文書の文字(A・B など)。レビューが返した文書が無い古い指摘は、対象の書き方から推定する
// (inferred = 推定。画面では薄く出す)
export function findingDocuments(finding: ReviewFindingRead): { letters: string[]; inferred: boolean } {
  const toLetters = (docs: string[]) =>
    [...new Set(docs.map((d) => DOCUMENT_LETTER[d]).filter((l): l is string => Boolean(l)))].sort();
  if (finding.documents !== null) return { letters: toLetters(finding.documents), inferred: false };
  const guessed = finding.targets.map(documentOfTarget).filter((d): d is DocType => d !== null);
  return { letters: toLetters(guessed), inferred: true };
}
