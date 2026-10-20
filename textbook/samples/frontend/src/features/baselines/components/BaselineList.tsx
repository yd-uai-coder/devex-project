"use client";
// 作成：Phase-88-3｜更新：Phase-88(完了後の調整)

import Link from "next/link";
import { Text } from "tamagui";
import type { ChangeRequestSummaryRead } from "@/features/change-requests/api/types";
import { changeRequestHref } from "@/features/change-requests/changeRequestOps";
// Phase-88(完了後の調整)：更新
// import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
// ↓↓
import { CELL, HEAD, LINK, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import type { BaselineSummaryRead } from "@/features/baselines/api/types";
import { baselineHref, includedChangeRequests, stageOfKey } from "@/features/baselines/baselineOps";

// Phase-88(完了後の調整)：更新
// // 合意済みの版(束)の一覧(新しい順。サーバーの並びのまま)。番号から中身へ移る。入れた CR は CR の一覧から引く
// ↓↓
// 合意済みの版(束)の一覧(新しい順。サーバーの並びのまま)。番号と行の末尾の「中身を見る →」から中身へ移る。入れた CR は CR の一覧から引く
export function BaselineList({
  projectId,
  items,
  changeRequests,
}: {
  projectId: string;
  items: BaselineSummaryRead[];
  changeRequests: ChangeRequestSummaryRead[];
}) {
  if (items.length === 0) {
    return <Text color="$color11">合意済みの版はまだありません。</Text>;
  }
  return (
    <table style={TABLE} aria-label="合意済みの版の一覧">
      <thead>
        <tr>
          <th style={HEAD}>番号</th>
          <th style={HEAD}>合意の日時</th>
          <th style={HEAD}>相手</th>
          <th style={HEAD}>理由</th>
          <th style={HEAD}>入れた CR</th>
          <th style={HEAD}>段階</th>
          {/* Phase-88(完了後の調整):追記 */}
          <th style={HEAD}>中身</th>
        </tr>
      </thead>
      <tbody>
        {items.map((baseline) => {
          const stages = baseline.items.filter((i) => stageOfKey(i.key) !== null);
          const included = includedChangeRequests(changeRequests, baseline.number);
          return (
            <tr key={baseline.number}>
              <td style={{ ...CELL, ...MONO }}>
                {/* Phase-88(完了後の調整)：更新
                <Link href={baselineHref(projectId, baseline.number)}>{baseline.label}</Link>
                ↓↓ */}
                <Link href={baselineHref(projectId, baseline.number)} style={LINK}>
                  {baseline.label}
                </Link>
              </td>
              <td style={{ ...CELL, whiteSpace: "nowrap" }}>{new Date(baseline.agreed_at).toLocaleString("ja-JP")}</td>
              <td style={CELL}>{baseline.counterpart ?? "(記録なし)"}</td>
              <td style={{ ...CELL, whiteSpace: "pre-wrap" }}>{baseline.reason}</td>
              <td style={{ ...CELL, ...MONO }}>
                {included.length === 0
                  ? "─"
                  : included.map((cr, index) => (
                      <span key={cr.number}>
                        {index > 0 ? "、" : ""}
                        {/* Phase-88(完了後の調整)：更新
                        <Link href={changeRequestHref(projectId, cr.number)}>{cr.label}</Link>
                        ↓↓ */}
                        <Link href={changeRequestHref(projectId, cr.number)} style={LINK}>
                          {cr.label}
                        </Link>
                      </span>
                    ))}
              </td>
              <td style={{ ...CELL, whiteSpace: "nowrap" }}>
                {stages.filter((s) => s.included).length} / {stages.length} 入った
              </td>
              {/* Phase-88(完了後の調整):追記 */}
              <td style={{ ...CELL, whiteSpace: "nowrap" }}>
                <Link
                  href={baselineHref(projectId, baseline.number)}
                  style={LINK}
                  aria-label={`${baseline.label} の中身を見る`}
                >
                  中身を見る →
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
