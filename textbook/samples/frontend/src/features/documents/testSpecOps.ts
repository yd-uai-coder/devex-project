// 作成：Phase-57-2｜更新：Phase-57(完了後の調整),69-3
// テスト仕様書の画面の表示(純粋関数)。簡易モードはプレビューのタブ、詳細設計モードは詳細設計画面
// (SCR-008)のステッパーの段階8の下の行で、同じパネル(TestSpecPanel)を出す。

import type { DocumentIssueRead, TestSpecRead } from "@/features/documents/api/documentsApi";
import type { DesignStageRead, FindingLevel } from "@/features/detailed-design/api/types";

// 詳細設計モードのテスト仕様書が読む段階(段階1の処理・段階7の単位。devex-api の TEST_SPEC_STAGES)
export const TEST_SPEC_STAGES = [1, 7];

// Phase-57(完了後の調整):追記
// 画面での名前(扱うのは結合・総合テストだけ。単体テストは実装手順書のテスト観点で見る)
export const TEST_SPEC_TITLE = "テスト仕様書(結合・総合)";

// Phase-69-3：更新
// export type TestSpecStatus = "none" | "outdated" | "ready";
// ↓↓
export type TestSpecStatus = "none" | "outdated" | "ready" | "generating" | "failed";

export const TEST_SPEC_STATUS_LABELS: Record<TestSpecStatus, string> = {
  none: "未作成",
  outdated: "古い",
  ready: "作成済み",
  // Phase-69-3:追記
  generating: "作っています",
  failed: "前回の作成に失敗",
};

// Phase-69-3：更新
// export function testSpecStatus(spec: TestSpecRead | null): TestSpecStatus {
// ↓↓
// 作っている間はそれを、直近の作成が失敗していればそれを、どちらでもなければ版の状態を返す
// (失敗しても前の版は残るので、版より先に出す)。
export function testSpecStatus(
  spec: TestSpecRead | null,
  { generating = false, failed = false }: { generating?: boolean; failed?: boolean } = {},
): TestSpecStatus {
  if (generating) return "generating";
  if (failed) return "failed";
  if (spec === null) return "none";
  return spec.outdated ? "outdated" : "ready";
}

// 「結合 12 件・総合 5 件」(「設計に無い」があれば後ろに足す)
export function countText(spec: TestSpecRead): string {
  const base = `結合 ${spec.counts.integration} 件・総合 ${spec.counts.system} 件`;
  return spec.design_gaps > 0 ? `${base}(「設計に無い」${spec.design_gaps} 件)` : base;
}

export type Readiness = { ready: boolean; reason: string | null };

// 詳細設計モードでテスト仕様書を作れるか(段階1・段階7 が承認済みで古くない。サーバーも 409 で断る)
export function testSpecReadiness(stages: DesignStageRead[]): Readiness {
  const missing = TEST_SPEC_STAGES.filter(
    (target) => stages.find((s) => s.stage === target)?.state !== "approved",
  );
  if (missing.length === 0) return { ready: true, reason: null };
  return {
    ready: false,
    reason: `段階${missing.join("・")}が承認されていません。承認するとテスト仕様書を作れます。`,
  };
}

// 詳細設計書の zip にテスト仕様書が入るか(古くない今の版だけを入れる)
export function zipTestSpecNote(spec: TestSpecRead | null): string {
  if (spec === null) return "テスト仕様書はまだ無いため、zip には入りません。";
  if (spec.outdated) return "テスト仕様書は古いため、zip には入りません(作り直すと入ります)。";
  return "テスト仕様書(test_spec.md)も zip に入ります。";
}

// 指摘の表の1行。内容は message から末尾の「: 対象」を除いたもの(対象は別の列に出す)
export type IssueRow = { level: FindingLevel; targets: string; content: string };

export function issueRows(issues: DocumentIssueRead[]): IssueRow[] {
  return issues.map((issue) => {
    const targets = issue.targets.join("・");
    const suffix = `: ${targets}`;
    const content =
      targets && issue.message.endsWith(suffix) ? issue.message.slice(0, -suffix.length) : issue.message;
    return { level: issue.level, targets: targets || "—", content };
  });
}

export function countIssues(rows: IssueRow[]): Record<FindingLevel, number> {
  const counts: Record<FindingLevel, number> = { critical: 0, major: 0, minor: 0 };
  for (const row of rows) counts[row.level] += 1;
  return counts;
}

export function filterIssues(rows: IssueRow[], level: FindingLevel | "all"): IssueRow[] {
  return level === "all" ? rows : rows.filter((row) => row.level === level);
}
