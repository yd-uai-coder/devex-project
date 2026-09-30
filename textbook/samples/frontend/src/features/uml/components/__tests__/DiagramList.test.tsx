// 作成：Phase-11-4｜更新：Phase-13-6
// Phase-13-6:追記 ── umlFixtures.makeCandidates
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DiagramList } from "../DiagramList";
import { useUmlStore } from "@/features/uml/uml-store";
import { makeCandidates, makeDiagram } from "@/features/uml/test-utils/umlFixtures";

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

  // Phase-13-6:追記
  it("図の元になった内部設計書の版が今の版と違えば、再生成を促す", () => {
    useUmlStore.setState({
      diagrams: [
        makeDiagram({ id: "d1", source_doc_versions: { internal_design: 1 } }),
        makeDiagram({ id: "d2", notation: "er", source_doc_versions: { internal_design: 2 } }),
      ],
      candidates: makeCandidates({ internal_design_version: 2 }),
    });
    renderList();

    expect(screen.getAllByText("内部設計書が更新されています(再生成を検討してください)")).toHaveLength(1);
  });
});
