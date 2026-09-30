// 作成：Phase-11-3
// 写経レベル: コア ── 「正本は意味モデル、React Flow から戻すのは位置だけ」という非対称な変換と、手動移動で折れ点を捨てる規則(D2)そのもの。
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type {
  LayoutBox,
  LayoutModel,
  NotationType,
  SemanticModel,
  UmlElement,
  UmlRelation,
} from "@/features/uml/api/types";

// 意味モデル(正本)+ 配置 ⇄ React Flow の nodes/edges の変換。
// React Flow 固有の型(Node/Edge)はこのファイルと描画コンポーネントの中に閉じ込め、
// 意味モデル・配置の型には混ぜない(appendix 2.7「React Flow 固有のプロパティを
// UML Domain Model に混入させない」)。
//
// 変換は非対称である。
// - 意味モデル → React Flow(toReactFlow): 表示のたびに全体を作り直す。
// - React Flow → 配置(applyMovedPositions): React Flow から戻すのは「ノードの位置」だけ。
//   要素・関係の追加や属性の編集は React Flow を経由せず、意味モデルへの操作として行う。

export type UmlNodeType = "component" | "erTable" | "dfdProcess" | "dfdExternal" | "dfdStore";

// data に要素そのものを載せ、カスタムノードが記法ごとの表示に使う。
export type UmlNodeData = { element: UmlElement };
export type UmlFlowNode = Node<UmlNodeData, UmlNodeType>;

// points はエンジンが計算した直交折れ線(絶対座標)。
export type UmlEdgeData = { points: [number, number][] };
export type UmlFlowEdge = Edge<UmlEdgeData>;

export type Position = { x: number; y: number };

export const EMPTY_LAYOUT: LayoutModel = {
  width: 0,
  height: 0,
  nodes: {},
  edges: {},
  metrics: { crossings: 0, overlaps: 0, collisions: 0 },
};

const ER_RELATION_LABELS = {
  one_to_one: "1:1",
  one_to_many: "1:N",
  many_to_many: "N:M",
} as const;

export function nodeTypeOf(notation: NotationType, element: UmlElement): UmlNodeType {
  if (notation === "er") return "erTable";
  if (notation === "dfd" && "element_type" in element) {
    if (element.element_type === "external_entity") return "dfdExternal";
    if (element.element_type === "data_store") return "dfdStore";
    return "dfdProcess";
  }
  return "component";
}

// 辺のラベル。DFD はデータ項目名(フローは名前を持たず DataItem の id を参照する)、
// ER は多重度、component は無し。
export function edgeLabelOf(
  relation: UmlRelation,
  dataItemNames: Record<string, string>,
): string | undefined {
  if ("data_item_id" in relation) {
    return dataItemNames[relation.data_item_id] ?? "(不明なデータ項目)";
  }
  if (relation.relation_type === "depends_on") return undefined;
  return ER_RELATION_LABELS[relation.relation_type];
}

export function toReactFlow(
  model: SemanticModel,
  layout: LayoutModel,
  options: { dataItemNames: Record<string, string> },
): { nodes: UmlFlowNode[]; edges: UmlFlowEdge[] } {
  const nodes: UmlFlowNode[] = model.elements.map((element) => {
    const box = layout.nodes[element.id];
    return {
      id: element.id,
      type: nodeTypeOf(model.notation, element),
      position: { x: box?.x ?? 0, y: box?.y ?? 0 },
      width: box?.w,
      height: box?.h,
      data: { element },
    };
  });
  const edges: UmlFlowEdge[] = model.relations.map((relation) => {
    const points = layout.edges[relation.id]?.points ?? [];
    return {
      id: relation.id,
      source: relation.source_id,
      target: relation.target_id,
      // 折れ点があればエンジンの経路をそのまま描き、無ければ smoothstep に任せる(D2)
      type: points.length > 0 ? "orthogonal" : "smoothstep",
      label: edgeLabelOf(relation, options.dataItemNames),
      // 依存(component)とデータの流れ(DFD)は向きを矢印で示す。ER は多重度のラベルで表すので付けない
      markerEnd: model.notation === "er" ? undefined : { type: MarkerType.ArrowClosed },
      data: { points },
    };
  });
  return { nodes, edges };
}

// React Flow でドラッグし終えたノードの位置を配置へ戻す。
// 動かしたノードにつながる辺は、エンジンの経路が合わなくなるため折れ点を捨てる(D2)。
export function applyMovedPositions(
  layout: LayoutModel,
  model: SemanticModel,
  moved: Record<string, Position>,
): LayoutModel {
  const movedIds = new Set(Object.keys(moved).filter((id) => layout.nodes[id]));
  if (movedIds.size === 0) return layout;

  const nodes = { ...layout.nodes };
  for (const id of movedIds) {
    nodes[id] = { ...nodes[id], x: moved[id].x, y: moved[id].y };
  }
  const edges = { ...layout.edges };
  for (const relation of model.relations) {
    if (movedIds.has(relation.source_id) || movedIds.has(relation.target_id)) {
      edges[relation.id] = { points: [] };
    }
  }
  return { ...layout, nodes, edges, ...extentOf(nodes, layout) };
}

// 配置に無い要素の既定サイズ。高さはエンジンの式(app/uml/layout/geometry.py の size_nodes:
// 1行 20px、上下の余白 9px ずつ、ER は +6px)に合わせ、ER はカラム数で変わる。
// 幅はエンジンの文字幅推定(app/uml/layout/text.py)を使わない目安値で、自動レイアウトを
// 再実行すればエンジンの寸法に置き換わる。
export function estimateSize(element: UmlElement): { w: number; h: number } {
  if ("columns" in element) return { w: 200, h: 20 * (element.columns.length + 1) + 24 };
  return { w: 160, h: 38 };
}

const GRID_COLUMNS = 4;
const GRID_GAP = 40;

// 配置に無い要素(編集で追加した要素、30件超で自動レイアウトできない図の全要素)を、
// 既存の配置の下へ格子状に並べる。既に配置のある要素は動かさない(M6)。
// lane/row は自動レイアウトの結果ではないため 0 にする(意味を持たない)。
export function placeMissingNodes(model: SemanticModel, layout: LayoutModel | null): LayoutModel {
  const base = layout ?? EMPTY_LAYOUT;
  const missing = model.elements.filter((element) => !base.nodes[element.id]);
  if (missing.length === 0 && layout) return layout;

  const existing = Object.values(base.nodes);
  const top = existing.length > 0 ? Math.max(...existing.map((b) => b.y + b.h)) + GRID_GAP : GRID_GAP;
  const nodes: Record<string, LayoutBox> = { ...base.nodes };
  let rowTop = top;
  let rowHeight = 0;
  missing.forEach((element, index) => {
    const column = index % GRID_COLUMNS;
    if (column === 0 && index > 0) {
      rowTop += rowHeight + GRID_GAP;
      rowHeight = 0;
    }
    const size = estimateSize(element);
    nodes[element.id] = {
      x: GRID_GAP + column * (200 + GRID_GAP),
      y: rowTop,
      ...size,
      lane: 0,
      row: 0,
    };
    rowHeight = Math.max(rowHeight, size.h);
  });
  return { ...base, nodes, ...extentOf(nodes, base) };
}

function extentOf(
  nodes: Record<string, LayoutBox>,
  base: LayoutModel,
): { width: number; height: number } {
  const boxes = Object.values(nodes);
  return {
    width: Math.max(base.width, ...boxes.map((b) => b.x + b.w)),
    height: Math.max(base.height, ...boxes.map((b) => b.y + b.h)),
  };
}
