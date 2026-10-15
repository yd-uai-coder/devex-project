// 作成：Phase-57-2
"use client";

import { useState } from "react";
import { Paragraph, Text, YStack } from "tamagui";
import type { DocumentIssueRead } from "@/features/documents/api/documentsApi";
import { countIssues, filterIssues, issueRows } from "@/features/documents/testSpecOps";
import {
  FindingLevelFilter,
  type FindingFilter,
} from "@/features/detailed-design/components/FindingLevelFilter";
import { CELL, HEAD, TABLE } from "@/features/detailed-design/components/tableStyles";
import { FINDING_LEVEL_COLORS, FINDING_LEVEL_LABELS } from "@/features/detailed-design/labels";

const NOWRAP = { ...CELL, whiteSpace: "nowrap" } as const;

// テスト仕様書の決定的な検証の結果。段階8の未定義・要決定と同じ形(重要度の絞り込み + 表)で出す。
// テスト仕様書はレビューにかけないので、ここに出るのはコードが調べられる指摘だけ。
export function TestSpecIssuePanel({ issues }: { issues: DocumentIssueRead[] }) {
  const [filter, setFilter] = useState<FindingFilter>("all");
  const rows = issueRows(issues);
  const shown = filterIssues(rows, filter);
  return (
    <YStack gap="$2">
      <Text fontWeight="700">検証の結果(テスト仕様書)</Text>
      <Paragraph color="$color11" fontSize="$2">
        要件定義書・外部設計書との突き合わせ(Must の要件にテストがあるか・存在しない要件や API・画面を指していないか・異常系のテストがある
        API か)です。期待結果と設計の食い違いや境界値の取り方は調べていません。
      </Paragraph>
      <FindingLevelFilter filter={filter} counts={countIssues(rows)} onChange={setFilter} />
      {shown.length === 0 ? (
        <Text fontSize="$2">指摘はありません。</Text>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label="テスト仕様書の検証の結果">
            <thead>
              <tr>
                {["重要度", "対象", "内容"].map((head) => (
                  <th key={head} style={HEAD}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, index) => (
                <tr key={`${row.level}-${row.content}-${index}`}>
                  <td style={{ ...NOWRAP, color: FINDING_LEVEL_COLORS[row.level] }}>
                    {FINDING_LEVEL_LABELS[row.level]}
                  </td>
                  <td style={CELL}>{row.targets}</td>
                  <td style={CELL}>{row.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </YStack>
  );
}
