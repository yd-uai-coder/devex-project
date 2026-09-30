// 作成：Phase-11-4
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DiagramList } from "../DiagramList";
import { useUmlStore } from "@/features/uml/uml-store";
import { makeDiagram } from "@/features/uml/test-utils/umlFixtures";

function renderList() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DiagramList projectId="p1" />
    </TamaguiProvider>,
  );
}

describe("DiagramList", () => {
  beforeEach(() => {
    useUmlStore.setState({ diagrams: [] });
  });

  it("完了した図は詳細画面へのリンクにする", () => {
    useUmlStore.setState({ diagrams: [makeDiagram()] });
    renderList();

    expect(screen.getByRole("link", { name: "コンポーネント図(全体)" })).toHaveAttribute(
      "href",
      "/projects/p1/uml/d1",
    );
    expect(screen.getByText("下書き")).toBeInTheDocument();
  });

  it("生成中の図はリンクにせず、失敗した図は理由を表示する", () => {
    useUmlStore.setState({
      diagrams: [
        makeDiagram({ id: "d1", notation: "dfd", subject: "ログイン", generation_status: "generating" }),
        makeDiagram({ id: "d2", notation: "er", subject: "", generation_status: "failed", generation_error: "出力が不正" }),
      ],
    });
    renderList();

    expect(screen.queryByRole("link", { name: "データフロー図: ログイン" })).not.toBeInTheDocument();
    expect(screen.getByText("生成中...")).toBeInTheDocument();
    expect(screen.getByText("生成に失敗しました: 出力が不正")).toBeInTheDocument();
  });
});
