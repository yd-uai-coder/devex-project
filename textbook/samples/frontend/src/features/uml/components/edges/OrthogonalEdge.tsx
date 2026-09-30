// 作成：Phase-11-5
// 写経レベル: コア ── エンジンの折れ線をそのまま描く辺と、smoothstep への切り替え(D2)の受け皿。
"use client";

import { BaseEdge, type EdgeProps } from "@xyflow/react";
import type { UmlFlowEdge } from "@/features/uml/adapters/reactFlowAdapter";

// レイアウトエンジン(Phase 9)が計算した直交折れ線(points)をそのまま描く辺。
// points は絶対座標で、ノードの位置が配置と一致している間だけ正しい。
// ノードを手で動かすと Adapter が points を空にし、辺の type が smoothstep に替わる(D2)。
export function OrthogonalEdge({ id, data, label, markerEnd, style }: EdgeProps<UmlFlowEdge>) {
  const points = data?.points ?? [];
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const [labelX, labelY] = midpointOf(points);
  return (
    <BaseEdge
      id={id}
      path={path}
      label={label}
      labelX={labelX}
      labelY={labelY}
      markerEnd={markerEnd}
      style={style}
    />
  );
}

// ラベルは折れ線の中央の線分の中点に置く
export function midpointOf(points: [number, number][]): [number, number] {
  if (points.length === 0) return [0, 0];
  const i = Math.max(0, Math.floor((points.length - 1) / 2));
  const [x1, y1] = points[i];
  const [x2, y2] = points[Math.min(i + 1, points.length - 1)];
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}
