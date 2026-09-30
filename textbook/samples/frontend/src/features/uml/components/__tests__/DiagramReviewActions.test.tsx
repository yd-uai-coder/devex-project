// 作成：Phase-12-5
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DiagramReviewActions } from "../DiagramReviewActions";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";
import { makeDiagram } from "@/features/uml/test-utils/umlFixtures";
import type { UmlDiagramRead } from "@/features/uml/api/types";

// ストアの approve / exportDiagram はスタブにし、状態ごとのボタンの出し分けと配線だけを見る。
function renderActions(diagram: Partial<UmlDiagramRead> = {}, dirty = false) {
  useUmlEditorStore.setState({ diagram: makeDiagram(diagram), dirty });
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DiagramReviewActions />
    </TamaguiProvider>,
  );
}

describe("DiagramReviewActions", () => {
  beforeEach(() => {
    useUmlEditorStore.setState({
      saving: false,
      layingOut: false,
      conflict: false,
      approving: false,
      exporting: false,
      approve: vi.fn().mockResolvedValue(undefined),
      exportDiagram: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("下書きでは状態と承認ボタンを出し、出力ボタンは出さない", async () => {
    renderActions({ status: "draft" });

    expect(screen.getByText("状態: 下書き")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /出力/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "承認" }));
    expect(useUmlEditorStore.getState().approve).toHaveBeenCalled();
  });

  it("未保存の変更があれば「保存して承認」にする", () => {
    renderActions({ status: "reviewing" }, true);

    expect(screen.getByRole("button", { name: "保存して承認" })).toBeInTheDocument();
  });

  it("承認済みでは出力ボタンと、再承認・ファイル編集の注意を出す", async () => {
    renderActions({ status: "approved" });

    expect(screen.queryByRole("button", { name: /承認/ })).toBeNull();
    expect(screen.getByText(/レビュー中に戻ります/)).toBeInTheDocument();
    expect(screen.getByText(/Devex には反映されません/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "draw.io で出力(.drawio)" }));
    await userEvent.click(screen.getByRole("button", { name: "SVG で出力(.svg)" }));
    expect(useUmlEditorStore.getState().exportDiagram).toHaveBeenNthCalledWith(1, "drawio");
    expect(useUmlEditorStore.getState().exportDiagram).toHaveBeenNthCalledWith(2, "svg");
  });

  it("承認済みでも未保存の変更があれば出力できない", () => {
    renderActions({ status: "exported" }, true);

    expect(screen.getByRole("button", { name: "SVG で出力(.svg)" })).toHaveAttribute("aria-disabled", "true");
  });

  it("生成中は承認できない", () => {
    renderActions({ status: "draft", generation_status: "generating" });

    expect(screen.getByRole("button", { name: "承認" })).toHaveAttribute("aria-disabled", "true");
  });
});
