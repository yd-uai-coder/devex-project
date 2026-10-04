// 作成：Phase-11-6｜更新：Phase-18-6
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ElementInspector } from "../ElementInspector";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";
import {
  COMPONENT_MODEL,
  DATA_ITEM,
  DFD_MODEL,
  ER_MODEL,
} from "@/features/uml/test-utils/umlFixtures";

function renderInspector() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ElementInspector />
    </TamaguiProvider>,
  );
}

const OTHER_ITEM = { ...DATA_ITEM, id: "22222222-2222-2222-2222-222222222222", name: "トークン" };

describe("ElementInspector", () => {
  const actions = {
    updateElement: vi.fn(),
    deleteElement: vi.fn(),
    updateRelation: vi.fn(),
    deleteRelation: vi.fn(),
    addColumn: vi.fn(),
    updateColumn: vi.fn(),
    deleteColumn: vi.fn(),
    // Phase-18-6:追記
    updateTableDescription: vi.fn(),
  };

  beforeEach(() => {
    Object.values(actions).forEach((fn) => fn.mockReset());
    useUmlEditorStore.setState({
      model: COMPONENT_MODEL,
      selection: null,
      dataItems: [DATA_ITEM, OTHER_ITEM],
      ...actions,
    });
  });

  it("何も選んでいなければ案内を表示する", () => {
    renderInspector();

    expect(screen.getByText(/図の要素または線を選ぶと/)).toBeInTheDocument();
  });

  it("component の要素は名前・説明・レイヤーを編集でき、削除できる", async () => {
    const user = userEvent.setup();
    useUmlEditorStore.setState({ selection: { kind: "element", id: "c1" } });
    renderInspector();

    fireEvent.change(screen.getByLabelText("名前"), { target: { value: "認証" } });
    fireEvent.change(screen.getByLabelText("レイヤー"), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "この要素を削除" }));

    expect(screen.getByLabelText("説明")).toBeInTheDocument();
    expect(actions.updateElement).toHaveBeenCalledWith("c1", { name: "認証" });
    expect(actions.updateElement).toHaveBeenCalledWith("c1", { layer: null });
    expect(actions.deleteElement).toHaveBeenCalledWith("c1");
  });

  it("ER のテーブルはカラム表を編集でき、layer の欄は出さない", async () => {
    const user = userEvent.setup();
    useUmlEditorStore.setState({ model: ER_MODEL, selection: { kind: "element", id: "t2" } });
    renderInspector();

    fireEvent.change(screen.getByLabelText("カラム2の型"), { target: { value: "bigint" } });
    await user.click(screen.getAllByRole("checkbox", { name: "NULL可" })[1]);
    await user.click(screen.getByRole("button", { name: "カラム1を削除" }));
    await user.click(screen.getByRole("button", { name: "カラムを追加" }));

    expect(screen.queryByLabelText("レイヤー")).not.toBeInTheDocument();
    expect(actions.updateColumn).toHaveBeenCalledWith("t2", 1, { type: "bigint" });
    expect(actions.updateColumn).toHaveBeenCalledWith("t2", 1, { nullable: true });
    expect(actions.deleteColumn).toHaveBeenCalledWith("t2", 0);
    expect(actions.addColumn).toHaveBeenCalledWith("t2");
  });

  // Phase-18-6:追記
  it("ER のテーブルの説明と、カラムの制約・説明を編集できる(Phase 18)", () => {
    useUmlEditorStore.setState({ model: ER_MODEL, selection: { kind: "element", id: "t2" } });
    renderInspector();

    fireEvent.change(screen.getByLabelText("テーブルの説明"), { target: { value: "記事" } });
    fireEvent.change(screen.getByLabelText("カラム2の制約"), { target: { value: "FK → users" } });
    fireEvent.change(screen.getByLabelText("カラム2の説明"), { target: { value: "書いた人" } });

    // ER では汎用の「説明」(null を入れる)を出さない
    expect(screen.queryByLabelText("説明")).not.toBeInTheDocument();
    expect(actions.updateTableDescription).toHaveBeenCalledWith("t2", "記事");
    expect(actions.updateColumn).toHaveBeenCalledWith("t2", 1, { constraints: "FK → users" });
    expect(actions.updateColumn).toHaveBeenCalledWith("t2", 1, { description: "書いた人" });
  });

  it("DFD のフローはデータ辞書の項目から選び直せる", async () => {
    const user = userEvent.setup();
    useUmlEditorStore.setState({ model: DFD_MODEL, selection: { kind: "relation", id: "f1" } });
    renderInspector();

    await user.selectOptions(screen.getByLabelText("データ項目"), "トークン");

    expect(screen.getByText("利用者 → ログイン")).toBeInTheDocument();
    expect(actions.updateRelation).toHaveBeenCalledWith("f1", { data_item_id: OTHER_ITEM.id });
  });

  it("ER の線は多重度を選べ、削除できる", async () => {
    const user = userEvent.setup();
    useUmlEditorStore.setState({ model: ER_MODEL, selection: { kind: "relation", id: "r1" } });
    renderInspector();

    await user.selectOptions(screen.getByLabelText("多重度"), "1対1");
    await user.click(screen.getByRole("button", { name: "この線を削除" }));

    expect(actions.updateRelation).toHaveBeenCalledWith("r1", { relation_type: "one_to_one" });
    expect(actions.deleteRelation).toHaveBeenCalledWith("r1");
  });
});
