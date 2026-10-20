// 作成：Phase-87-2｜更新：Phase-88-3,88(完了後の調整)
"use client";

import Link from "next/link";
import { Text } from "tamagui";
import type { ChangeRequestSummaryRead } from "@/features/change-requests/api/types";
import { changeRequestHref } from "@/features/change-requests/changeRequestOps";
import { StatusBadge } from "@/features/change-requests/components/StatusBadge";
// Phase-88(完了後の調整)：更新
// import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
// ↓↓
import { CELL, HEAD, LINK, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
// Phase-88-3:追記
import { baselineHref } from "@/features/baselines/baselineOps";

// Phase-88-3：更新
// // CR の一覧(新しい順。サーバーの並びのまま)。番号から詳細へ移る
// ↓↓
// CR の一覧(新しい順。サーバーの並びのまま)。番号から詳細へ、基準の版から束の中身へ移る
export function ChangeRequestList({
  projectId,
  items,
}: {
  projectId: string;
  items: ChangeRequestSummaryRead[];
}) {
  if (items.length === 0) {
    return <Text color="$color11">変更要求はまだありません。</Text>;
  }
  return (
    <table style={TABLE} aria-label="変更要求の一覧">
      <thead>
        <tr>
          <th style={HEAD}>番号</th>
          <th style={HEAD}>タイトル</th>
          <th style={HEAD}>状態</th>
          <th style={HEAD}>対象の要件</th>
          <th style={HEAD}>基準の版</th>
          <th style={HEAD}>更新</th>
        </tr>
      </thead>
      <tbody>
        {items.map((cr) => (
          <tr key={cr.number}>
            <td style={{ ...CELL, ...MONO }}>
              {/* Phase-88(完了後の調整)：更新
              <Link href={changeRequestHref(projectId, cr.number)}>{cr.label}</Link>
              ↓↓ */}
              <Link href={changeRequestHref(projectId, cr.number)} style={LINK}>
                {cr.label}
              </Link>
            </td>
            <td style={CELL}>{cr.title}</td>
            <td style={CELL}>
              <StatusBadge status={cr.status} label={cr.status_label} />
            </td>
            <td style={CELL}>
              {cr.targets.map((t) => `${t.requirement_id}(${t.kind_label})`).join("、")}
              {cr.adds_requirement ? `${cr.targets.length > 0 ? "、" : ""}新しい要件を足す` : ""}
            </td>
            {/* Phase-88-3：更新
            <td style={{ ...CELL, ...MONO }}>{cr.baseline_label}</td>
            ↓↓ */}
            <td style={{ ...CELL, ...MONO }}>
              {/* Phase-88(完了後の調整)：更新
              <Link href={baselineHref(projectId, cr.baseline_number)}>{cr.baseline_label}</Link>
              ↓↓ */}
              <Link href={baselineHref(projectId, cr.baseline_number)} style={LINK}>
                {cr.baseline_label}
              </Link>
            </td>
            <td style={{ ...CELL, whiteSpace: "nowrap" }}>{new Date(cr.updated_at).toLocaleString("ja-JP")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
