// 作成：Phase-11-5
// 写経レベル: 定型 ── カスタムノード(element_type で形を分ける)。
"use client";

import type { NodeProps } from "@xyflow/react";
import type { UmlFlowNode } from "@/features/uml/adapters/reactFlowAdapter";
import type { DfdElement } from "@/features/uml/api/types";
import { NodeHandles } from "@/features/uml/components/nodes/NodeHandles";
import { nodeBoxStyle } from "@/features/uml/components/nodes/nodeStyles";

// DFD の3種類の要素を形で見分ける(dfdProcess / dfdExternal / dfdStore の3つの type に同じ部品を登録する)。
// - 処理: 角の丸い枠。加工の説明はツールチップ(title)と属性パネルで見せる
//   (エンジンは名前だけでノードの寸法を計算するため、説明を枠に入れるとはみ出す)
// - 外部実体: 太枠の四角
// - データストア: 上下の線だけ(左右が開いた帯)
export function DfdNode({ data, selected }: NodeProps<UmlFlowNode>) {
  const element = data.element as DfdElement;
  if (element.element_type === "process") {
    return (
      <div
        style={nodeBoxStyle(selected, { borderRadius: 16 })}
        title={element.description ?? undefined}
      >
        <NodeHandles />
        <strong>{element.name}</strong>
      </div>
    );
  }
  if (element.element_type === "external_entity") {
    return (
      <div style={nodeBoxStyle(selected, { borderWidth: selected ? 3 : 2 })}>
        <NodeHandles />
        <strong>{element.name}</strong>
      </div>
    );
  }
  return (
    <div style={nodeBoxStyle(selected, { borderLeft: "none", borderRight: "none" })}>
      <NodeHandles />
      <strong>{element.name}</strong>
    </div>
  );
}
