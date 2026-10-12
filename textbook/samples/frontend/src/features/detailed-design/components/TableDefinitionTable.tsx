// 作成：Phase-18-7｜更新：Phase-44-3
// 写経レベル: コア ── テーブル定義は ER から組み立てる表示だけにし、編集は ER の属性パネルに寄せる(二重に持たない)。
"use client";

// Phase-44-3:追記 ── @/features/detailed-design/components/ImpactBadge.ImpactBadge, @/features/detailed-design/hooks/useStageImpact.useStageImpact, @/features/detailed-design/impactOps.elementKey
import { Paragraph, Text, YStack } from "tamagui";
import { ImpactBadge } from "@/features/detailed-design/components/ImpactBadge";
import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import { useStageImpact } from "@/features/detailed-design/hooks/useStageImpact";
import { elementKey } from "@/features/detailed-design/impactOps";
import type { ErSemanticModel } from "@/features/uml/api/types";

const mark = (on: boolean) => (on ? "○" : "");

// 段階3のテーブル定義の表。ER(テーブル定義の正本)から組み立てる表示だけで、ここでは編集しない。
// 制約・説明は ER のエディタの属性パネルで直す(二重に持たないため。Phase 18)。
// 渡す ER はエディタで編集中の内容なので、保存していない手直しもすぐ表に出る。
// Phase-44-3:追記
// テーブルの見出しの行に、変更の影響の印と「表で見る」の強調を付ける。
export function TableDefinitionTable({ model }: { model: ErSemanticModel | null }) {
  // Phase-44-3:追記
  const impact = useStageImpact(3);
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
                {/* Phase-44-3：更新
                <tr>
                  <th colSpan={7} scope="rowgroup" style={{ ...CELL, background: "var(--color2)" }}>
                ↓↓ */}
                <tr {...impact.row(elementKey.table(table.name))}>
                  <th
                    colSpan={7}
                    scope="rowgroup"
                    style={{ ...CELL, background: "var(--color2)", ...impact.row(elementKey.table(table.name)).style }}
                  >
                    <span style={MONO}>{table.name}</span>
                    {/* Phase-44-3：更新
                    {table.description ? `  ${table.description}` : ""}
                    ↓↓ */}
                    {table.description ? `  ${table.description}` : ""}{" "}
                    <ImpactBadge mark={impact.mark(elementKey.table(table.name))} />
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
