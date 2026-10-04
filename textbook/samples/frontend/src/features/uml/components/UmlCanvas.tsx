// 作成：Phase-11-5｜更新：Phase-11-6,18-9
// 写経レベル: コア ── 正本から表示を作り直す一方向の流れと、ドラッグ確定時だけ位置を戻す設計。
"use client";

// Phase-11-6:追記 ── @xyflow/react(OnConnect, OnSelectionChangeFunc)
// Phase-18-9:追記 ── react.useCallback, react.CSSProperties
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeTypes,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  toReactFlow,
  type Position,
  type UmlFlowEdge,
  type UmlFlowNode,
} from "@/features/uml/adapters/reactFlowAdapter";
import { OrthogonalEdge } from "@/features/uml/components/edges/OrthogonalEdge";
import { ComponentNode } from "@/features/uml/components/nodes/ComponentNode";
import { DfdNode } from "@/features/uml/components/nodes/DfdNode";
import { ErTableNode } from "@/features/uml/components/nodes/ErTableNode";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";

// nodeTypes / edgeTypes はレンダーごとに作り直すと React Flow が警告するため、モジュールの定数にする。
export const NODE_TYPES: NodeTypes = {
  component: ComponentNode,
  erTable: ErTableNode,
  dfdProcess: DfdNode,
  dfdExternal: DfdNode,
  dfdStore: DfdNode,
};
export const EDGE_TYPES: EdgeTypes = { orthogonal: OrthogonalEdge };

// Phase-18-9:追記
// 拡大・縮小などの操作ボタンは、ライト・ダークとも白地に黒字に固定する。React Flow の既定(ライト)は
// 背景が白で文字色が inherit なので、ダークモードではページの白い文字色を受け継ぎ、白地に白になっていた
// (Phase 18 の画面確認で見つかった)。CSS 変数を上書きする。
export const CONTROLS_STYLE = {
  "--xy-controls-button-background-color": "#fefefe",
  "--xy-controls-button-background-color-hover": "#f4f4f4",
  "--xy-controls-button-color": "#1a1a1a",
  "--xy-controls-button-color-hover": "#000",
  "--xy-controls-button-border-color": "#eee",
} as CSSProperties;

// Phase-11-6：更新(選択もストアで持つようにした)
// React Flow のキャンバス。正本(意味モデル + 配置)はストアにあり、ここでは
// // Adapter で nodes/edges に変換して表示する。ドラッグ中の途中経過と選択状態だけは
// // React Flow 側のローカル state で持ち、ドラッグを離した時点でストアへ位置を戻す。
// ↓↓
// React Flow のキャンバス。正本(意味モデル + 配置 + 選択)はストアにあり、ここでは
// Adapter で nodes/edges に変換して表示する。ドラッグ中の途中経過だけは React Flow 側の
// ローカル state で持ち、ドラッグを離した時点でストアへ位置を戻す。
export function UmlCanvas() {
  const model = useUmlEditorStore((s) => s.model);
  const layout = useUmlEditorStore((s) => s.layout);
  const dataItems = useUmlEditorStore((s) => s.dataItems);
  const moveNodes = useUmlEditorStore((s) => s.moveNodes);
  // Phase-11-6:追記
  const selection = useUmlEditorStore((s) => s.selection);
  const select = useUmlEditorStore((s) => s.select);
  const addRelation = useUmlEditorStore((s) => s.addRelation);
  const deleteElement = useUmlEditorStore((s) => s.deleteElement);
  const deleteRelation = useUmlEditorStore((s) => s.deleteRelation);
  const [connectNotice, setConnectNotice] = useState<string | null>(null);

  const derived = useMemo(() => {
    if (!model || !layout) return { nodes: [], edges: [] };
    const dataItemNames = Object.fromEntries(dataItems.map((item) => [item.id, item.name]));
    // Phase-11-6：更新(選択の反映を追加)
    // return toReactFlow(model, layout, { dataItemNames });
    // }, [model, layout, dataItems]);
    // ↓↓
    const flow = toReactFlow(model, layout, { dataItemNames });
    // ストアの選択(検証パネルから選んだ場合を含む)をキャンバスの強調表示に反映する
    return {
      nodes: flow.nodes.map((n) => ({
        ...n,
        selected: selection?.kind === "element" && selection.id === n.id,
      })),
      edges: flow.edges.map((e) => ({
        ...e,
        selected: selection?.kind === "relation" && selection.id === e.id,
      })),
    };
  }, [model, layout, dataItems, selection]);

  const [nodes, setNodes] = useState<UmlFlowNode[]>(derived.nodes);
  const [edges, setEdges] = useState<UmlFlowEdge[]>(derived.edges);

  // ストアの正本が変わったら(読み込み・保存・自動レイアウト・ドラッグ確定)表示を作り直す。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes(derived.nodes);
    setEdges(derived.edges);
  }, [derived]);

  const onNodesChange: OnNodesChange<UmlFlowNode> = (changes) =>
    setNodes((current) => applyNodeChanges(changes, current));
  const onEdgesChange: OnEdgesChange<UmlFlowEdge> = (changes) =>
    setEdges((current) => applyEdgeChanges(changes, current));

  // 複数選択して動かした場合も、動いた全ノードの位置をまとめて戻す
  const onNodeDragStop: OnNodeDrag<UmlFlowNode> = (_event, _node, draggedNodes) => {
    const moved: Record<string, Position> = {};
    for (const node of draggedNodes) moved[node.id] = node.position;
    moveNodes(moved);
  };

  // Phase-11-6:追記
  // Phase-18-9：更新(onSelectionChange を useCallback で固定した)
  // // キャンバスで選んだものを属性パネルの編集対象にする。同じ対象なら更新しない
  // // (選択をストアへ戻す → 表示を作り直す → 選択イベント、の往復を止めるため)。
  // const onSelectionChange: OnSelectionChangeFunc<UmlFlowNode, UmlFlowEdge> = ({
  //   nodes: selectedNodes,
  //   edges: selectedEdges,
  // }) => {
  //   const next = selectedNodes[0]
  //     ? { kind: "element" as const, id: selectedNodes[0].id }
  //     : selectedEdges[0]
  //       ? { kind: "relation" as const, id: selectedEdges[0].id }
  //       : null;
  //   const current = useUmlEditorStore.getState().selection;
  //   if (next?.id === current?.id && next?.kind === current?.kind) return;
  //   select(next);
  // };
  // ↓↓
  // キャンバスで選んだものを属性パネルの編集対象にする。同じ対象なら更新しない
  // (選択をストアへ戻す → 表示を作り直す → 選択イベント、の往復を止めるため)。
  // useCallback で参照を固定する。React Flow は onSelectionChange が変わるたびに選択を通知し直すので、
  // レンダーごとに作り直すと、要素の追加で選択が変わったとき(表示がまだ古い選択のうちに)古い選択が
  // 通知され、ストアの選択と往復し続けた(Phase 18 の画面確認で見つかった)。
  const onSelectionChange = useCallback<OnSelectionChangeFunc<UmlFlowNode, UmlFlowEdge>>(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      const next = selectedNodes[0]
        ? { kind: "element" as const, id: selectedNodes[0].id }
        : selectedEdges[0]
          ? { kind: "relation" as const, id: selectedEdges[0].id }
          : null;
      const current = useUmlEditorStore.getState().selection;
      if (next?.id === current?.id && next?.kind === current?.kind) return;
      select(next);
    },
    [select],
  );

  // ハンドルからハンドルへドラッグして線を追加する。追加や削除は React Flow の state ではなく
  // 意味モデルへの操作として行い、表示は Adapter が作り直す。
  const onConnect: OnConnect = (connection) => {
    if (addRelation(connection.source, connection.target)) {
      setConnectNotice(null);
    } else {
      setConnectNotice(
        "データ辞書に項目が無いため、データフローを追加できません(データフローは必ずデータ項目を参照します)。",
      );
    }
  };

  return (
    // Phase-11-6：更新(線を追加できなかった理由の表示と、選択・接続・削除のハンドラを追加)
    // <div style={{ height: 560, border: "1px solid var(--borderColor)" }}>
    //   <ReactFlow ... onNodeDragStop={onNodeDragStop} fitView>
    // ↓↓
    <>
      {connectNotice ? (
        <p role="alert" style={{ color: "var(--color9)", margin: 0 }}>
          {connectNotice}
        </p>
      ) : null}
      <div style={{ height: 560, border: "1px solid var(--borderColor)" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onSelectionChange={onSelectionChange}
          onConnect={onConnect}
          // Delete / Backspace キーで選択中の要素・線を消す(要素を消すとつながる線も消える)
          onNodesDelete={(deleted) => deleted.forEach((node) => deleteElement(node.id))}
          onEdgesDelete={(deleted) => deleted.forEach((edge) => deleteRelation(edge.id))}
          deleteKeyCode={["Delete", "Backspace"]}
          fitView
        >
          <Background />
          {/* Phase-18-9：更新 */}
          {/* <Controls /> */}
          {/* ↓↓ */}
          <Controls style={CONTROLS_STYLE} />
        </ReactFlow>
      </div>
    </>
  );
}
