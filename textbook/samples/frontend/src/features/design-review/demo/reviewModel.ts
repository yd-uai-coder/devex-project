// 作成：Phase-51-3
// AI 設計レビューの意味モデルと純粋関数(デモ用)。
//
// 生成は今のモデル(Gemini)のまま、レビューは別のモデル(Sonnet)が指摘だけを返す。設計は書き換えない。
// 人が指摘ごとに採用・却下・保留を決め、採用した指摘は再生成の指示に入れる。原因がヒアリングの指摘は、
// 観点を「未決」に戻してチャットで聞き直す。レビューを流す区切りは、簡易=4文書の生成の後(自動)、
// 詳細=要件・外部の生成の後(自動)と、段階6・7の承認の後(ボタン)。

export type Mode = "simple" | "detailed";
export type Level = "critical" | "major" | "minor";
export type Cause = "hearing" | "design" | "inconsistency";
export type Decision = "open" | "adopted" | "rejected" | "held";

export type Finding = {
  id: string;
  gate: string;
  level: Level;
  cause: Cause;
  targets: string[];
  // 原因がヒアリングのとき、戻す観点のキー
  pointKey?: string;
  problem: string;
  // 文書からの引用(指摘の根拠を確かめられるようにする)
  evidence: string;
  reason: string;
  suggestion: string;
};

export type Gate = {
  key: string;
  mode: Mode;
  label: string;
  trigger: "auto" | "button";
  // レビューに渡す文書
  documents: string[];
};

export type GateStatus = "not_ready" | "unreviewed" | "reviewed" | "failed";

export type HearingPoint = { key: string; label: string; status: "decided" | "adopted" | "open"; summary: string };

export const LEVEL_LABEL: Record<Level, string> = { critical: "最重要", major: "中程度", minor: "軽微" };
export const CAUSE_LABEL: Record<Cause, string> = { hearing: "ヒアリング", design: "設計", inconsistency: "不整合" };
export const DECISION_LABEL: Record<Decision, string> = { open: "未判断", adopted: "採用", rejected: "却下", held: "保留" };
export const POINT_STATUS_LABEL: Record<HearingPoint["status"], string> = {
  decided: "ユーザーが決定",
  adopted: "AI の提案を採用",
  open: "未決",
};

const LEVEL_ORDER: Record<Level, number> = { critical: 0, major: 1, minor: 2 };

export const GATES: Gate[] = [
  {
    key: "simple-docs",
    mode: "simple",
    label: "4文書の生成の後",
    trigger: "auto",
    documents: ["要件定義書", "外部設計書", "内部設計書", "実装計画書"],
  },
  { key: "detailed-docs", mode: "detailed", label: "要件・外部の生成の後", trigger: "auto", documents: ["要件定義書", "外部設計書"] },
  {
    key: "detailed-stage6",
    mode: "detailed",
    label: "段階6の承認の後",
    trigger: "button",
    documents: ["要件定義書", "外部設計書", "詳細設計書"],
  },
  {
    key: "detailed-stage7",
    mode: "detailed",
    label: "段階7の承認の後",
    trigger: "button",
    documents: ["要件定義書", "外部設計書", "詳細設計書", "実装計画書"],
  },
];

// レビューが実際に動くか。superuser だけが切り替えられ、それ以外は保存値によらずオフ(サーバーで判定する)。
export function reviewEnabled(user: { isSuperuser: boolean; reviewSetting: boolean }): boolean {
  return user.isSuperuser && user.reviewSetting;
}

export function gatesOf(mode: Mode): Gate[] {
  return GATES.filter((g) => g.mode === mode);
}

// 区切りの状態。ready = その区切りの文書がそろっている(生成済み・段階が承認済み)。
export function gateStatus(ready: boolean, reviewed: boolean, failed: boolean): GateStatus {
  if (!ready) return "not_ready";
  if (failed) return "failed";
  return reviewed ? "reviewed" : "unreviewed";
}

// 手順書を生成するときの知らせ(止めはしない)。そろっているのにレビューしていない区切りを挙げる。
export function unreviewedNotice(statuses: { gate: Gate; status: GateStatus }[]): string | null {
  const pending = statuses.filter((s) => s.status === "unreviewed" || s.status === "failed").map((s) => s.gate.label);
  if (pending.length === 0) return null;
  return `未レビューの区切りがあります(${pending.join("・")})。このまま手順書を生成できます。`;
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.id.localeCompare(b.id));
}

export function decisionCounts(findings: Finding[], decisions: Map<string, Decision>): Record<Decision, number> {
  const counts: Record<Decision, number> = { open: 0, adopted: 0, rejected: 0, held: 0 };
  for (const f of findings) counts[decisions.get(f.id) ?? "open"] += 1;
  return counts;
}

// 採用した指摘のうち、設計・不整合のもの(再生成で直す)。ヒアリングのものは聞き直してから再生成する。
export function regenerationFindings(findings: Finding[], decisions: Map<string, Decision>): Finding[] {
  return sortFindings(findings.filter((f) => decisions.get(f.id) === "adopted" && f.cause !== "hearing"));
}

// Gemini の再生成に渡す指示の文。指摘ごとに対象・問題・改善案を書く。
export function regenerationInstruction(findings: Finding[], decisions: Map<string, Decision>): string {
  const adopted = regenerationFindings(findings, decisions);
  if (adopted.length === 0) return "";
  const lines = adopted.map(
    (f, i) => `${i + 1}. [${LEVEL_LABEL[f.level]}] ${f.targets.join(", ")}: ${f.problem} → ${f.suggestion}`,
  );
  return ["次のレビューの指摘を反映して、設計書を作り直してください。指摘に無い部分は変えないでください。", ...lines].join("\n");
}

// 採用したヒアリングの指摘が指す観点を「未決」に戻す。戻した観点のキーも返す。
export function reopenPoints(
  points: HearingPoint[],
  findings: Finding[],
  decisions: Map<string, Decision>,
): { points: HearingPoint[]; reopened: string[] } {
  const keys = new Set(
    findings
      .filter((f) => f.cause === "hearing" && f.pointKey && decisions.get(f.id) === "adopted")
      .map((f) => f.pointKey as string),
  );
  const reopened = points.filter((p) => keys.has(p.key) && p.status !== "open").map((p) => p.key);
  return {
    points: points.map((p) => (keys.has(p.key) ? { ...p, status: "open" } : p)),
    reopened,
  };
}

// 聞き直すときに AI がチャットで最初に出す問いかけ(観点ごとに、採用した指摘の問題をまとめる)。
export function rehearingQuestions(points: HearingPoint[], findings: Finding[], decisions: Map<string, Decision>): string[] {
  const label = new Map(points.map((p) => [p.key, p.label]));
  const byPoint = new Map<string, string[]>();
  for (const f of findings) {
    if (f.cause !== "hearing" || !f.pointKey || decisions.get(f.id) !== "adopted") continue;
    byPoint.set(f.pointKey, [...(byPoint.get(f.pointKey) ?? []), f.problem]);
  }
  return [...byPoint].map(([key, problems]) => `「${label.get(key) ?? key}」について確認させてください: ${problems.join(" / ")}`);
}
