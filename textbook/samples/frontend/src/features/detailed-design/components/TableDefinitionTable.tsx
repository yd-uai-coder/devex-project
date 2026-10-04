// 作成：Phase-18-7
// 写経レベル: コア ── テーブル定義は ER から組み立てる表示だけにし、編集は ER の属性パネルに寄せる(二重に持たない)。
"use client";

import { Paragraph, Text, YStack } from "tamagui";
import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import type { ErSemanticModel } from "@/features/uml/api/types";

const mark = (on: boolean) => (on ? "○" : "");

// 段階3のテーブル定義の表。ER(テーブル定義の正本)から組み立てる表示だけで、ここでは編集しない。
// 制約・説明は ER のエディタの属性パネルで直す(二重に持たないため。Phase 18)。
// 渡す ER はエディタで編集中の内容なので、保存していない手直しもすぐ表に出る。
export function TableDefinitionTable({ model }: { model: ErSemanticModel | null }) {
  if (model === null) return null;

  return (
    <YStack gap="$2">
      <Text fontWeight="700">テーブル定義</Text>
      <Paragraph color="$color11" fontSize="$2">
        ER から組み立てた表です。列の制約・説明とテーブルの説明は、上の ER でテーブルを選び、属性パネルで直します。
      </Paragraph>
      {model.elements.length === 0 ? (
        <Text color="$color11">ER にテーブルがありません。</Text>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label="テーブル定義">
            <thead>
              <tr>
                <th style={HEAD}>列</th>
                <th style={HEAD}>型</th>
                <th style={HEAD}>PK</th>
                <th style={HEAD}>FK</th>
                <th style={HEAD}>NULL可</th>
                <th style={HEAD}>制約</th>
                <th style={HEAD}>説明</th>
              </tr>
            </thead>
            {model.elements.map((table) => (
              <tbody key={table.id}>
                <tr>
                  <th colSpan={7} scope="rowgroup" style={{ ...CELL, background: "var(--color2)" }}>
                    <span style={MONO}>{table.name}</span>
                    {table.description ? `  ${table.description}` : ""}
                  </th>
                </tr>
                {table.columns.map((column, index) => (
                  <tr key={index}>
                    <td style={{ ...CELL, ...MONO }}>{column.name}</td>
                    <td style={{ ...CELL, ...MONO }}>{column.type}</td>
                    <td style={CELL}>{mark(column.is_primary_key)}</td>
                    <td style={CELL}>{mark(column.is_foreign_key)}</td>
                    <td style={CELL}>{mark(column.nullable)}</td>
                    <td style={CELL}>{column.constraints ?? ""}</td>
                    <td style={CELL}>{column.description ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </YStack>
  );
}
