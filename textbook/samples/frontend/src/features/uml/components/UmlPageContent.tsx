// 作成：Phase-7-3｜更新：Phase-11-4
// 写経レベル: 定型 ── 取得・ポーリング・子コンポーネントの配線のみ(設計判断は各子コンポーネントとフックにある)。
// Phase-11-4：更新(Phase 7 の使い捨てスパイクを、生成・一覧画面の本実装に丸ごと置き換えた)
// "use client";
//
// import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
// import "@xyflow/react/dist/style.css";
// import { H2, Text, YStack } from "tamagui";
//
// // Phase 7の技術検証スパイク(使い捨て): Next.js 16 + React 19 + Tamagui 2.6の組み合わせで
// // @xyflow/react(React Flow)が問題なく描画できるかを確認するためだけのコンポーネント。
// // UML意味モデルとの連携・編集機能は持たず、ダミーノードを固定表示するのみ。
// // Phase 11でSemantic Model ⇄ React Flowのアダプタを持つ本実装に置き換える。
// const SPIKE_NODES: Node[] = [
//   { id: "api", position: { x: 0, y: 0 }, data: { label: "API Server" } },
//   { id: "db", position: { x: 260, y: 120 }, data: { label: "PostgreSQL" } },
// ];
//
// const SPIKE_EDGES: Edge[] = [{ id: "api-db", source: "api", target: "db", label: "SQL" }];
//
// export function UmlPageContent({ projectId }: { projectId: string }) {
//   return (
//     <YStack paddingVertical="$4" gap="$4">
//       <H2>UML設計図レビュー(Phase 7 技術検証スパイク)</H2>
//       <Text color="$color11">
//         プロジェクトID: {projectId}。このキャンバスはReact Flow×Tamaguiの動作確認用の暫定表示であり、
//         Phase 11で意味モデル連携の本実装に置き換えます。
//       </Text>
//       <div style={{ height: 480, border: "1px solid var(--borderColor)" }}>
//         <ReactFlow nodes={SPIKE_NODES} edges={SPIKE_EDGES} fitView>
//           <Background />
//           <Controls />
//         </ReactFlow>
//       </div>
//     </YStack>
//   );
// }
// ↓↓
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, H2, Separator, Text, XStack, YStack } from "tamagui";
import { DiagramList } from "@/features/uml/components/DiagramList";
import { GenerationPanel } from "@/features/uml/components/GenerationPanel";
import { GenerationRunHistory } from "@/features/uml/components/GenerationRunHistory";
import { useUmlGenerationPolling } from "@/features/uml/hooks/useUmlGenerationPolling";
import { isGenerating, useUmlStore } from "@/features/uml/uml-store";

// 生成・一覧画面(SCR-007 の前半)。生成の受け付け・ポーリング・生成履歴・図の一覧を並べる。
export function UmlPageContent({ projectId }: { projectId: string }) {
  const diagrams = useUmlStore((s) => s.diagrams);
  const status = useUmlStore((s) => s.status);
  const error = useUmlStore((s) => s.error);
  const fetchAll = useUmlStore((s) => s.fetchAll);

  useEffect(() => {
    void fetchAll(projectId);
  }, [projectId, fetchAll]);

  const generating = isGenerating(diagrams);
  const { timedOut, resetTimeout } = useUmlGenerationPolling(projectId, generating);

  return (
    <YStack paddingVertical="$4" gap="$4">
      <XStack justifyContent="space-between" alignItems="center">
        <H2>UML設計図</H2>
        <Link href={`/projects/${projectId}/documents`}>
          <Text color="$blue10">ドキュメントに戻る</Text>
        </Link>
      </XStack>

      {status === "loading" && diagrams.length === 0 ? (
        <Text color="$color11">読み込み中...</Text>
      ) : null}
      {status === "error" ? (
        <Text role="alert" color="$color9">
          {error}
        </Text>
      ) : null}
      {generating && !timedOut ? (
        <Text color="$color11">設計図を生成しています。しばらくお待ちください...</Text>
      ) : null}
      {generating && timedOut ? (
        <XStack gap="$3" alignItems="center">
          <Text role="alert" color="$color9">
            生成に時間がかかっています。自動更新を止めました。
          </Text>
          <Button
            size="$2"
            onPress={() => {
              resetTimeout();
              void fetchAll(projectId, { force: true });
            }}
          >
            再読み込み
          </Button>
        </XStack>
      ) : null}

      <GenerationPanel projectId={projectId} />
      <Separator />
      <DiagramList projectId={projectId} />
      <Separator />
      <GenerationRunHistory />
    </YStack>
  );
}
