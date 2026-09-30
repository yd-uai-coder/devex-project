// 作成：Phase-11-6
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ValidationPanel } from "../ValidationPanel";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";
import { DFD_MODEL } from "@/features/uml/test-utils/umlFixtures";

function renderPanel() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ValidationPanel />
    </TamaguiProvider>,
  );
}

describe("ValidationPanel", () => {
  const select = vi.fn();

  beforeEach(() => {
    select.mockReset();
    useUmlEditorStore.setState({ model: DFD_MODEL, validation: null, select });
  });

  it("まだ検証していなければ何も表示しない", () => {
    const { container } = renderPanel();

    expect(container.textContent).toBe("");
  });

  it("問題が無ければその旨を表示する", () => {
    useUmlEditorStore.setState({ validation: { errors: [], warnings: [] } });
    renderPanel();

    expect(screen.getByText("検証で問題は見つかりませんでした。")).toBeInTheDocument();
  });

  it("エラーと警告を並べ、押すと該当の要素・線を選ぶ", async () => {
    const user = userEvent.setup();
    useUmlEditorStore.setState({
      validation: {
        errors: [{ code: "PROCESS_MISSING_OUTPUT", message: "出力がありません", element_id: "p1" }],
        warnings: [{ code: "UNREFERENCED_DATA_ITEM", message: "未参照", element_id: "f2" }],
      },
    });
    renderPanel();

    await user.click(screen.getByText("[エラー] 出力がありません"));
    await user.click(screen.getByText("[警告] 未参照"));

    expect(select).toHaveBeenNthCalledWith(1, { kind: "element", id: "p1" });
    expect(select).toHaveBeenNthCalledWith(2, { kind: "relation", id: "f2" });
  });
});
