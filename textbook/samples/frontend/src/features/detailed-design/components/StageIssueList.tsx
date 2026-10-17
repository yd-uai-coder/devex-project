// 作成：Phase-17-6｜更新：Phase-18-9,69-4
// 写経レベル: 定型 ── FunctionListPanel から切り出した検証の結果の一覧。
"use client";

// Phase-18-9:追記 ── @/features/detailed-design/labels.visibleIssues
import { Text, YStack } from "tamagui";
import type { StageIssue } from "@/features/detailed-design/api/types";
// Phase-69-4：更新
// import { visibleIssues } from "@/features/detailed-design/labels";
// ↓↓
import { STAGE_ISSUE_LIST_ID, visibleIssues } from "@/features/detailed-design/labels";

// 保存した内容の検証の結果(エラー・警告)の一覧。段階1・2のパネルで共有する(Phase 17 で
// FunctionListPanel から切り出した)。指摘が無ければ何も出さない。図の未承認は承認を押したときに
// 出すので、ここには出さない(Phase 18)。承認できない理由(StageWorkArea)から移れるように id を
// 持つ(Phase 69)。
// Phase-18-9：更新
// export function StageIssueList({ issues }: { issues: StageIssue[] }) {
// ↓↓
export function StageIssueList({ issues: all }: { issues: StageIssue[] }) {
  const issues = visibleIssues(all);
  if (issues.length === 0) return null;
  return (
    // Phase-69-4：更新
    // <YStack gap="$1" aria-label="検証の結果">
    // ↓↓
    <YStack id={STAGE_ISSUE_LIST_ID} gap="$1" aria-label="検証の結果">
      <Text fontWeight="700">検証の結果(保存した内容)</Text>
      {issues.map((issue, index) => (
        <Text
          key={`${issue.code}-${issue.target ?? ""}-${index}`}
          color={issue.severity === "error" ? "$red10" : "$orange10"}
          fontSize="$2"
        >
          {issue.severity === "error" ? "エラー" : "警告"}: {issue.message}
        </Text>
      ))}
    </YStack>
  );
}
