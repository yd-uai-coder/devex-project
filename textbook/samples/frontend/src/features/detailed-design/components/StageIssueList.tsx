// 作成：Phase-17-6
// 写経レベル: 定型 ── FunctionListPanel から切り出した検証の結果の一覧。
"use client";

import { Text, YStack } from "tamagui";
import type { StageIssue } from "@/features/detailed-design/api/types";

// 保存した内容の検証の結果(エラー・警告)の一覧。段階1・2のパネルで共有する(Phase 17 で
// FunctionListPanel から切り出した)。指摘が無ければ何も出さない。
export function StageIssueList({ issues }: { issues: StageIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <YStack gap="$1" aria-label="検証の結果">
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
