// 作成：Phase-11-3
import { describe, expect, it } from "vitest";
import {
  EMPTY_LAYOUT,
  applyMovedPositions,
  edgeLabelOf,
  estimateSize,
  nodeTypeOf,
  placeMissingNodes,
  toReactFlow,
} from "../reactFlowAdapter";
import {
  COMPONENT_LAYOUT,
  COMPONENT_MODEL,
  DATA_ITEM,
  DFD_MODEL,
  ER_MODEL,
} from "@/features/uml/test-utils/umlFixtures";

describe("toReactFlow", () => {
  it("配置の座標・寸法をノードへ写し、要素を data に載せる", () => {
    const { nodes } = toReactFlow(COMPONENT_MODEL, COMPONENT_LAYOUT, { dataItemNames: {} });

    expect(nodes[0]).toEqual({
      id: "c1",
      type: "component",
      position: { x: 20, y: 20 },
      width: 120,
      height: 48,
      data: { element: COMPONENT_MODEL.elements[0] },
    });
  });

  it("折れ点がある辺は orthogonal、無い辺は smoothstep にする", () => {
    const layout = { ...COMPONENT_LAYOUT, edges: {} };

    const withPoints = toReactFlow(COMPONENT_MODEL, COMPONENT_LAYOUT, { dataItemNames: {} });
    const withoutPoints = toReactFlow(COMPONENT_MODEL, layout, { dataItemNames: {} });

    expect(withPoints.edges[0]).toMatchObject({ type: "orthogonal", source: "c1", target: "c2" });
    expect(withPoints.edges[0].data?.points).toHaveLength(2);
    expect(withoutPoints.edges[0]).toMatchObject({ type: "smoothstep", data: { points: [] } });
  });

  it("component と DFD の辺には矢印を付け、ER には付けない", () => {
    const component = toReactFlow(COMPONENT_MODEL, COMPONENT_LAYOUT, { dataItemNames: {} });
    const er = toReactFlow(ER_MODEL, placeMissingNodes(ER_MODEL, null), { dataItemNames: {} });

    expect(component.edges[0].markerEnd).toEqual({ type: "arrowclosed" });
    expect(er.edges[0].markerEnd).toBeUndefined();
  });
});

describe("nodeTypeOf / edgeLabelOf", () => {
  it("記法と DFD の element_type からノード種別を決める", () => {
    expect(nodeTypeOf("component", COMPONENT_MODEL.elements[0])).toBe("component");
    expect(nodeTypeOf("er", ER_MODEL.elements[0])).toBe("erTable");
    expect(DFD_MODEL.elements.map((el) => nodeTypeOf("dfd", el))).toEqual([
      "dfdExternal",
      "dfdProcess",
      "dfdStore",
    ]);
  });

  it("DFD はデータ項目名、ER は多重度、component はラベル無し", () => {
    const names = { [DATA_ITEM.id]: DATA_ITEM.name };

    expect(edgeLabelOf(DFD_MODEL.relations[0], names)).toBe("ログイン要求");
    expect(edgeLabelOf(DFD_MODEL.relations[0], {})).toBe("(不明なデータ項目)");
    expect(edgeLabelOf(ER_MODEL.relations[0], names)).toBe("1:N");
    expect(edgeLabelOf(COMPONENT_MODEL.relations[0], names)).toBeUndefined();
  });
});

describe("applyMovedPositions", () => {
  it("動かしたノードの座標を更新し、つながる辺の折れ点を捨てる", () => {
    const moved = applyMovedPositions(COMPONENT_LAYOUT, COMPONENT_MODEL, {
      c2: { x: 300, y: 200 },
    });

    expect(moved.nodes.c2).toMatchObject({ x: 300, y: 200, w: 120, h: 48 });
    expect(moved.nodes.c1).toEqual(COMPONENT_LAYOUT.nodes.c1);
    expect(moved.edges.r1.points).toEqual([]);
    expect(moved.height).toBe(248);
  });

  it("引数の配置を書き換えない", () => {
    applyMovedPositions(COMPONENT_LAYOUT, COMPONENT_MODEL, { c2: { x: 300, y: 200 } });

    expect(COMPONENT_LAYOUT.nodes.c2.x).toBe(240);
    expect(COMPONENT_LAYOUT.edges.r1.points).toHaveLength(2);
  });

  it("配置に無い id は無視する", () => {
    const moved = applyMovedPositions(COMPONENT_LAYOUT, COMPONENT_MODEL, { zz: { x: 1, y: 1 } });

    expect(moved).toBe(COMPONENT_LAYOUT);
  });
});

describe("placeMissingNodes", () => {
  it("配置が null なら全要素を格子状に並べる", () => {
    const layout = placeMissingNodes(ER_MODEL, null);

    expect(Object.keys(layout.nodes)).toEqual(["t1", "t2"]);
    expect(layout.nodes.t1.y).toBe(layout.nodes.t2.y);
    expect(layout.nodes.t2.x).toBeGreaterThan(layout.nodes.t1.x);
    expect(layout.nodes.t2.h).toBe(estimateSize(ER_MODEL.elements[1]).h);
    expect(layout.edges).toEqual({});
  });

  it("既に配置のある要素は動かさず、新しい要素だけを既存の配置の下へ置く", () => {
    const model = {
      ...COMPONENT_MODEL,
      elements: [
        ...COMPONENT_MODEL.elements,
        { id: "c3", name: "新規", kind: "module" as const, description: null, layer: null },
      ],
    };

    const layout = placeMissingNodes(model, COMPONENT_LAYOUT);

    expect(layout.nodes.c1).toEqual(COMPONENT_LAYOUT.nodes.c1);
    expect(layout.nodes.c3.y).toBeGreaterThanOrEqual(68);
  });

  it("欠けている要素が無ければ同じ配置を返す", () => {
    expect(placeMissingNodes(COMPONENT_MODEL, COMPONENT_LAYOUT)).toBe(COMPONENT_LAYOUT);
    expect(placeMissingNodes({ ...COMPONENT_MODEL, elements: [] }, null)).toEqual(EMPTY_LAYOUT);
  });
});
