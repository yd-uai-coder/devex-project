// 作成：Phase-11-5｜更新：Phase-18-9
import { beforeEach, describe, expect, it } from "vitest";
// Phase-18-9:追記 ── @testing-library/react.act
import { act, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { EDGE_TYPES, NODE_TYPES, UmlCanvas } from "../UmlCanvas";
import { ComponentNode } from "../nodes/ComponentNode";
import { DfdNode } from "../nodes/DfdNode";
import { ErTableNode } from "../nodes/ErTableNode";
import { NodeHandles } from "../nodes/NodeHandles";
import { OrthogonalEdge } from "../edges/OrthogonalEdge";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";
import {
  COMPONENT_LAYOUT,
  COMPONENT_MODEL,
  DATA_ITEM,
  DFD_MODEL,
  ER_MODEL,
} from "@/features/uml/test-utils/umlFixtures";
import { placeMissingNodes } from "@/features/uml/adapters/reactFlowAdapter";

function renderCanvas() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <UmlCanvas />
    </TamaguiProvider>,
  );
}

// jsdom には描画エンジンが無いため、座標や辺の形までは見ない。
// 記法ごとのカスタムノードが要素の内容を描くこと(nodeTypes の登録漏れが無いこと)を確かめる。
describe("NODE_TYPES / EDGE_TYPES", () => {
  it("Adapter が付ける全ての type にカスタム部品を登録している", () => {
    expect(NODE_TYPES).toEqual({
      component: ComponentNode,
      erTable: ErTableNode,
      dfdProcess: DfdNode,
      dfdExternal: DfdNode,
      dfdStore: DfdNode,
    });
    // smoothstep は React Flow 組み込みの type なので登録しない
    expect(EDGE_TYPES).toEqual({ orthogonal: OrthogonalEdge });
    expect(typeof NodeHandles).toBe("function");
  });
});

describe("UmlCanvas", () => {
  beforeEach(() => {
    useUmlEditorStore.setState({ model: null, layout: null, dataItems: [] });
  });

  it("コンポーネント図のモジュール名と layer を描く", () => {
    useUmlEditorStore.setState({ model: COMPONENT_MODEL, layout: COMPONENT_LAYOUT });
    renderCanvas();

    expect(screen.getByText("認証API")).toBeInTheDocument();
    expect(screen.getByText("Service層")).toBeInTheDocument();
  });

  it("ER 図のテーブル名と、PK/FK の印つきカラムを描く", () => {
    useUmlEditorStore.setState({ model: ER_MODEL, layout: placeMissingNodes(ER_MODEL, null) });
    renderCanvas();

    expect(screen.getByText("projects")).toBeInTheDocument();
    expect(screen.getByText("FK user_id: uuid")).toBeInTheDocument();
  });

  it("DFD の3種類の要素と処理の説明を描く", () => {
    useUmlEditorStore.setState({
      model: DFD_MODEL,
      layout: placeMissingNodes(DFD_MODEL, null),
      dataItems: [DATA_ITEM],
    });
    renderCanvas();

    expect(screen.getByText("利用者")).toBeInTheDocument();
    // 処理の説明は枠に入れず、ツールチップで見せる(エンジンは名前だけで寸法を決めるため)
    expect(screen.getByTitle("認証する")).toBeInTheDocument();
    expect(screen.getByText("users")).toBeInTheDocument();
  });

  // Phase-18-9:追記
  it("要素を選んだ状態で要素を追加しても、選択が往復せず新しい要素が選ばれる(Phase 18)", () => {
    // onSelectionChange の参照がレンダーごとに変わると、React Flow が古い選択を通知し直し、
    // ストアの選択と往復して Maximum update depth exceeded になっていた
    useUmlEditorStore.setState({
      model: ER_MODEL,
      layout: placeMissingNodes(ER_MODEL, null),
      selection: { kind: "element", id: "t1" },
    });
    renderCanvas();

    act(() => useUmlEditorStore.getState().addElement());

    expect(screen.getByText("new_table")).toBeInTheDocument();
    expect(useUmlEditorStore.getState().selection).toEqual({ kind: "element", id: "t3" });
  });
});
