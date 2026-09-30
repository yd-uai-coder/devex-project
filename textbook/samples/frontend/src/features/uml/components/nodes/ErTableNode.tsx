// 作成：Phase-11-5
// 写経レベル: 定型 ── カスタムノード(表示のみ)。
"use client";

import type { NodeProps } from "@xyflow/react";
import type { UmlFlowNode } from "@/features/uml/adapters/reactFlowAdapter";
import type { ErElement } from "@/features/uml/api/types";
import { NodeHandles } from "@/features/uml/components/nodes/NodeHandles";
import { nodeBoxStyle } from "@/features/uml/components/nodes/nodeStyles";

// エンジンの寸法(app/uml/layout/geometry.py: 1行 LINE_H=20px、上下の余白 PADY=9px)に行の高さを揃える。
// 揃えないと、エンジンが計算した高さ(h)に最後のカラムが収まらない。
const ROW_STYLE = { height: 20, lineHeight: "20px", overflow: "hidden", whiteSpace: "nowrap" } as const;

// ER 図のテーブル。1行目がテーブル名、以降がカラム(PK/FK の印つき)。
// エンジンの ER ノードのテキスト(app/uml/layout/__init__.py の _element_text)と同じ並び。
export function ErTableNode({ data, selected }: NodeProps<UmlFlowNode>) {
  const element = data.element as ErElement;
  return (
    <div
      style={nodeBoxStyle(selected, {
        justifyContent: "flex-start",
        alignItems: "stretch",
        padding: "9px 0 0",
      })}
    >
      <NodeHandles />
      <strong style={{ ...ROW_STYLE, borderBottom: "1px solid var(--borderColor)" }}>
        {element.name}
      </strong>
      {element.columns.map((column) => (
        <div key={column.name} style={{ ...ROW_STYLE, fontSize: 12, padding: "0 8px", textAlign: "left" }}>
          {`${column.is_primary_key ? "PK " : ""}${column.is_foreign_key ? "FK " : ""}${column.name}: ${column.type}`}
        </div>
      ))}
    </div>
  );
}
