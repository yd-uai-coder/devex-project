// 作成：Phase-18-8
// 写経レベル: コア ── 下書きのセルと DFD 由来のセルを見た目で区別する。
"use client";

import type { CSSProperties } from "react";
import { Paragraph, Text, YStack } from "tamagui";
import type {
  CrudModel,
  DfdAccess,
  FunctionRow,
} from "@/features/detailed-design/api/types";
import { CELL, HEAD, INPUT, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import { accessOf, cellOf, countDrafts, setCellOps } from "@/features/detailed-design/crudOps";

// AI の下書きのまま(人が確定していない)セルの背景
const DRAFT_CELL: CSSProperties = { background: "var(--yellow4, #fdf3c4)" };
// DFD の線から決まっている(外せない)読み書きのセルの枠
const FIXED_CELL: CSSProperties = { boxShadow: "inset 0 0 0 2px var(--blue8, #5b9bd5)" };

// 段階3の CRUD 図(処理 × テーブル)。行は段階1の機能一覧、列は ER のテーブル。
// セルには C・R・U・D を書く(並びは自動で C→R→U→D にそろえる)。DFD に読みの線があるセルの R は
// 外せない。人が書き換えたセルは AI の下書きの印が外れ、段階3の承認で残りの印も外れる(Phase 18)。
export function CrudMatrix({
  functions,
  tables,
  model,
  accesses,
  disabled,
  onChange,
}: {
  functions: FunctionRow[];
  tables: string[];
  model: CrudModel;
  accesses: DfdAccess[];
  disabled: boolean;
  onChange: (model: CrudModel) => void;
}) {
  const drafts = countDrafts(model);

  return (
    <YStack gap="$2">
      <Text fontWeight="700">CRUD 図</Text>
      <Paragraph color="$color11" fontSize="$2">
        黄色のセルは AI の下書き(未確定)、青い枠のセルは DFD の線から決まる読み書きです(R は外せません)。
        セルを書き換えると確定になり、段階を承認すると残りの下書きも確定します。
        {drafts > 0 ? ` 下書きのセル: ${drafts}個。` : ""}
      </Paragraph>
      {tables.length === 0 ? (
        <Text color="$color11">ER にテーブルがありません。</Text>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label="CRUD 図">
            <thead>
              <tr>
                <th style={HEAD}>処理ID</th>
                <th style={HEAD}>名称</th>
                {tables.map((table) => (
                  <th key={table} style={{ ...HEAD, ...MONO }}>
                    {table}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {functions.map((fn) => (
                <tr key={fn.id}>
                  <td style={{ ...CELL, ...MONO, whiteSpace: "nowrap" }}>{fn.id}</td>
                  <td style={{ ...CELL, minWidth: 140 }}>{fn.name}</td>
                  {tables.map((table) => {
                    const cell = cellOf(model, fn.id, table);
                    const access = accessOf(accesses, fn.id, table);
                    const fixed = access.read || access.write;
                    return (
                      <td
                        key={table}
                        style={{
                          ...CELL,
                          ...(cell?.draft ? DRAFT_CELL : {}),
                          ...(fixed ? FIXED_CELL : {}),
                        }}
                        data-draft={cell?.draft ? "true" : undefined}
                        data-dfd={fixed ? "true" : undefined}
                        title={
                          fixed
                            ? `DFD: ${[access.read ? "読み" : "", access.write ? "書き込み" : ""].filter(Boolean).join("・")}`
                            : undefined
                        }
                      >
                        <input
                          style={{ ...INPUT, ...MONO, width: "4.5em" }}
                          aria-label={`${fn.id} × ${table}`}
                          value={cell?.ops ?? ""}
                          disabled={disabled}
                          onChange={(e) =>
                            onChange(setCellOps(model, fn.id, table, e.target.value, accesses))
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </YStack>
  );
}
