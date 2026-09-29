// 作成：Phase-7-3
"use client";

import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { H2, Text, YStack } from "tamagui";

// Phase 7の技術検証スパイク(使い捨て): Next.js 16 + React 19 + Tamagui 2.6の組み合わせで
// @xyflow/react(React Flow)が問題なく描画できるかを確認するためだけのコンポーネント。
// UML意味モデルとの連携・編集機能は持たず、ダミーノードを固定表示するのみ。
// Phase 11でSemantic Model ⇄ React Flowのアダプタを持つ本実装に置き換える。
const SPIKE_NODES: Node[] = [
  { id: "api", position: { x: 0, y: 0 }, data: { label: "API Server" } },
  { id: "db", position: { x: 260, y: 120 }, data: { label: "PostgreSQL" } },
];

const SPIKE_EDGES: Edge[] = [{ id: "api-db", source: "api", target: "db", label: "SQL" }];

export function UmlPageContent({ projectId }: { projectId: string }) {
  return (
    <YStack paddingVertical="$4" gap="$4">
      <H2>UML設計図レビュー(Phase 7 技術検証スパイク)</H2>
      <Text color="$color11">
        プロジェクトID: {projectId}。このキャンバスはReact Flow×Tamaguiの動作確認用の暫定表示であり、
        Phase 11で意味モデル連携の本実装に置き換えます。
      </Text>
      <div style={{ height: 480, border: "1px solid var(--borderColor)" }}>
        <ReactFlow nodes={SPIKE_NODES} edges={SPIKE_EDGES} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </YStack>
  );
}
