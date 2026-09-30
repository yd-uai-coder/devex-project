// 作成：Phase-11-5
// 写経レベル: 定型 ── カスタムノード(表示のみ)。
"use client";

import type { NodeProps } from "@xyflow/react";
import type { UmlFlowNode } from "@/features/uml/adapters/reactFlowAdapter";
import type { ComponentElement } from "@/features/uml/api/types";
import { NodeHandles } from "@/features/uml/components/nodes/NodeHandles";
import { nodeBoxStyle } from "@/features/uml/components/nodes/nodeStyles";

// コンポーネント図のモジュール。名前と、あれば layer を小さく表示する。
export function ComponentNode({ data, selected }: NodeProps<UmlFlowNode>) {
  const element = data.element as ComponentElement;
  return (
    <div style={nodeBoxStyle(selected, { borderRadius: 4 })}>
      <NodeHandles />
      <strong>{element.name}</strong>
      {element.layer ? <div style={{ fontSize: 11, opacity: 0.7 }}>{element.layer}</div> : null}
    </div>
  );
}
