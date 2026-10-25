// 作成：Phase-107-1
"use client";

import { Text, YStack } from "tamagui";
import type { ChangeRequestExplanationRead, ScaleCountRead, ScaleKind } from "@/features/change-requests/api/types";
import { scaleCell, scaleColumns, scaleRemarkLines } from "@/features/change-requests/changeRequestOps";
import { CELL, HEAD, TABLE } from "@/features/detailed-design/components/tableStyles";

const NUM = { ...CELL, textAlign: "right", whiteSpace: "nowrap" } as const;
const UNCOUNTABLE = { ...CELL, color: "var(--orange10)", whiteSpace: "nowrap" } as const;

// 変更の規模の表(説明書の規模の節と同じ数)。合意の前で案があれば種類 × 案、それ以外は1列と内訳。
// 数えられない種類は0件と書かず「数えられない」と出し、表の下に理由と注記をまとめる
// (docs/external_design.md 2.16節「変更の規模」)
export function ScaleTable({ explanation }: { explanation: ChangeRequestExplanationRead }) {
  const columns = scaleColumns(explanation);
  const single = columns.length === 1;
  const kinds = columns[0]?.scale ?? [];
  const remarks = scaleRemarkLines(columns);
  const countOf = (scale: ScaleCountRead[], kind: ScaleKind) => scale.find((c) => c.kind === kind);

  return (
    <YStack gap="$2">
      <table style={TABLE} aria-label="変更の規模">
        <thead>
          <tr>
            <th style={HEAD}>種類</th>
            {columns.map((column) => (
              <th key={column.key} style={HEAD}>
                {column.recommended ? `${column.title}(おすすめ)` : column.title}
              </th>
            ))}
            {single ? <th style={HEAD}>内訳</th> : null}
          </tr>
        </thead>
        <tbody>
          {kinds.map((row) => (
            <tr key={row.kind}>
              <td style={CELL}>{row.label}</td>
              {columns.map((column) => {
                const count = countOf(column.scale, row.kind)?.count ?? null;
                return (
                  <td key={column.key} style={count === null ? UNCOUNTABLE : NUM}>
                    {scaleCell(count)}
                  </td>
                );
              })}
              {single ? <td style={CELL}>{row.names.join("、")}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      {remarks.length > 0 ? (
        <ul aria-label="規模の理由と注記" style={{ margin: 0, paddingLeft: "1.5em", fontSize: 13 }}>
          {remarks.map((line) => (
            <li key={line.text} style={{ color: line.uncountable ? "var(--orange10)" : "var(--color11)" }}>
              {line.text}
            </li>
          ))}
        </ul>
      ) : null}
      <Text fontSize="$2" color="$color11">
        合意済みの版の設計から決まった規則で数えた、手を入れる量の目安です(工数や費用ではありません)。
      </Text>
    </YStack>
  );
}
