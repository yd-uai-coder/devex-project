// 作成：Phase-37-3
"use client";

import { Text, YStack } from "tamagui";
import type { DocumentIssueRead } from "@/features/documents/api/documentsApi";

const LEVEL_LABELS: Record<DocumentIssueRead["level"], string> = {
  critical: "最重要",
  major: "中程度",
  minor: "軽微",
};

type DocumentIssueListProps = {
  issues: DocumentIssueRead[];
  label: string;
};

// 要件定義書・外部設計書の検証の指摘(警告だけ)を、重要度の見出しを付けて並べる。
// 指摘が無ければ何も出さない。
export function DocumentIssueList({ issues, label }: DocumentIssueListProps) {
  if (issues.length === 0) return null;
  return (
    <YStack gap="$1" role="list" aria-label={label}>
      {issues.map((issue) => (
        <Text role="listitem" key={issue.code} color={issue.level === "minor" ? "$color11" : "$red10"}>
          【{LEVEL_LABELS[issue.level]}】{issue.message}
        </Text>
      ))}
    </YStack>
  );
}
