// 作成：Phase-87-3｜更新：Phase-98-2
"use client";

import { useEffect } from "react";
import { Text, YStack } from "tamagui";
import type { TraceEntryRead } from "@/features/change-requests/api/types";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { stageLabel, statusLabel } from "@/features/change-requests/changeRequestOps";
import type { ReviewGate } from "@/features/design-review/api/reviewApi";
import { GATE_LABEL } from "@/features/design-review/model";
import { CELL, HEAD, TABLE } from "@/features/detailed-design/components/tableStyles";

// 詳細の「たどる記録」タブ。受付から検証・合意済みの版までの時系列を、指す先(作った文書の版と、
// Phase-98-2：更新
// // それが今も残っているか・段階の版・モデル名・結んだレビュー・入れた版)と一緒に出す。
// ↓↓
// それが今も残っているか・段階の版・モデル名・結んだレビュー・入れた版・直した項目・段階の承認で結んだ
// 印の数)と一緒に出す。
export function TraceTab({ projectId, number }: { projectId: string; number: number }) {
  const trace = useChangeRequestsStore((s) => s.views.trace);
  const error = useChangeRequestsStore((s) => s.viewErrors.trace);
  const fetchView = useChangeRequestsStore((s) => s.fetchView);

  useEffect(() => {
    if (trace === null) void fetchView(projectId, number, "trace");
  }, [trace, projectId, number, fetchView]);

  if (error) {
    return (
      <Text role="alert" color="$red10">
        {error}
      </Text>
    );
  }
  if (trace === null) return <Text color="$color11">読み込み中...</Text>;
  return (
    <YStack gap="$2">
      <Text color="$color11">
        {`基準: B-${trace.baseline_number}`}
        {trace.included_baseline_number !== null ? ` → 入れた版: B-${trace.included_baseline_number}` : ""}
      </Text>
      <table style={TABLE} aria-label="たどる記録">
        <thead>
          <tr>
            <th style={HEAD}>日時</th>
            <th style={HEAD}>操作</th>
            <th style={HEAD}>状態</th>
            <th style={HEAD}>指す先</th>
            <th style={HEAD}>メモ</th>
          </tr>
        </thead>
        <tbody>
          {trace.entries.map((entry) => (
            <tr key={entry.position}>
              <td style={{ ...CELL, whiteSpace: "nowrap" }}>{new Date(entry.occurred_at).toLocaleString("ja-JP")}</td>
              <td style={CELL}>{entry.action_label}</td>
              <td style={{ ...CELL, whiteSpace: "nowrap" }}>
                {entry.from_status && entry.from_status !== entry.to_status
                  ? `${statusLabel(entry.from_status)} → ${statusLabel(entry.to_status)}`
                  : statusLabel(entry.to_status)}
              </td>
              <td style={CELL}>
                <Refs entry={entry} />
              </td>
              <td style={CELL}>{entry.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </YStack>
  );
}

// 行の指す先(無ければ空)
function Refs({ entry }: { entry: TraceEntryRead }) {
  const lines: string[] = [];
  for (const doc of entry.documents) {
    lines.push(`${doc.label} 版${doc.version}${doc.available ? "" : "(もう残っていない)"}`);
  }
  if (entry.stage) lines.push(`${stageLabel(entry.stage.stage)} 版${entry.stage.version}`);
  // Phase-98-2:追記
  if (entry.mark_count !== null) lines.push(`結んだ印 ${entry.mark_count}件`);
  if (entry.edited_fields.length > 0) lines.push(`直した項目: ${entry.edited_fields.join("・")}`);
  if (entry.model) lines.push(`モデル: ${entry.model}`);
  for (const review of entry.reviews) {
    lines.push(`レビュー(${GATE_LABEL[review.gate as ReviewGate] ?? review.gate}・${review.model}): 指摘 ${review.findings}・採用 ${review.adopted}`);
  }
  if (entry.baseline_number !== null) lines.push(`合意済みの版 B-${entry.baseline_number}`);
  return (
    <>
      {lines.map((line) => (
        <span key={line} style={{ display: "block" }}>
          {line}
        </span>
      ))}
    </>
  );
}
