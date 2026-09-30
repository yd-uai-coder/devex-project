// 作成：Phase-7-3｜更新：Phase-11-4
// Phase-11-4：更新(スパイクの描画確認を、本実装の配線のテストに置き換えた)
// import { describe, expect, it } from "vitest";
// import { render, screen } from "@testing-library/react";
// import { TamaguiProvider } from "tamagui";
// import tamaguiConfig from "@/tamagui.config";
// import { UmlPageContent } from "../UmlPageContent";
//
// // Phase 7の技術検証スパイク用テスト。React Flow自体の描画ロジックは検証せず、
// // Tamagui配下でコンポーネントが例外なくマウントできること・受け取ったprojectIdを
// // 表示することだけを見る(意味モデル連携はPhase 11以降のテストで検証する)。
// describe("UmlPageContent", () => {
//   it("プロジェクトIDとスパイクである旨を表示する", () => {
//     render(
//       <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
//         <UmlPageContent projectId="p1" />
//       </TamaguiProvider>,
//     );
//
//     expect(screen.getByText("UML設計図レビュー(Phase 7 技術検証スパイク)")).toBeInTheDocument();
//     expect(screen.getByText(/プロジェクトID: p1/)).toBeInTheDocument();
//   });
// });
// ↓↓
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { UmlPageContent } from "../UmlPageContent";
import { useUmlStore } from "@/features/uml/uml-store";
import { makeDiagram } from "@/features/uml/test-utils/umlFixtures";

const pollingMock = vi.fn();
vi.mock("@/features/uml/hooks/useUmlGenerationPolling", () => ({
  useUmlGenerationPolling: (...args: unknown[]) => pollingMock(...args),
}));

// 子コンポーネントはそれぞれのテストで検証済み。ここでは配線(取得・ポーリング・状態表示)だけを見る。
vi.mock("@/features/uml/components/GenerationPanel", () => ({ GenerationPanel: () => null }));
vi.mock("@/features/uml/components/DiagramList", () => ({ DiagramList: () => null }));
vi.mock("@/features/uml/components/GenerationRunHistory", () => ({
  GenerationRunHistory: () => null,
}));

function renderContent() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <UmlPageContent projectId="p1" />
    </TamaguiProvider>,
  );
}

describe("UmlPageContent", () => {
  const resetTimeout = vi.fn();

  beforeEach(() => {
    resetTimeout.mockReset();
    pollingMock.mockReset().mockReturnValue({ timedOut: false, resetTimeout });
    useUmlStore.setState({
      diagrams: [],
      status: "idle",
      error: null,
      fetchAll: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("マウント時に fetchAll(projectId) を呼び、生成中の図が無ければポーリングしない", () => {
    renderContent();

    expect(useUmlStore.getState().fetchAll).toHaveBeenCalledWith("p1");
    expect(pollingMock).toHaveBeenCalledWith("p1", false);
  });

  it("生成中の図があればポーリングし、生成中の表示を出す", () => {
    useUmlStore.setState({ diagrams: [makeDiagram({ generation_status: "generating" })] });
    renderContent();

    expect(pollingMock).toHaveBeenCalledWith("p1", true);
    expect(screen.getByText(/設計図を生成しています/)).toBeInTheDocument();
  });

  it("打ち切り後は再読み込みボタンで打ち切りを解除して取り直す", async () => {
    const user = userEvent.setup();
    pollingMock.mockReturnValue({ timedOut: true, resetTimeout });
    useUmlStore.setState({ diagrams: [makeDiagram({ generation_status: "generating" })] });
    renderContent();

    await user.click(screen.getByRole("button", { name: "再読み込み" }));

    expect(resetTimeout).toHaveBeenCalled();
    expect(useUmlStore.getState().fetchAll).toHaveBeenCalledWith("p1", { force: true });
  });

  it("取得に失敗したらエラーを表示する", () => {
    useUmlStore.setState({ status: "error", error: "取得失敗" });
    renderContent();

    expect(screen.getByRole("alert")).toHaveTextContent("取得失敗");
  });
});
