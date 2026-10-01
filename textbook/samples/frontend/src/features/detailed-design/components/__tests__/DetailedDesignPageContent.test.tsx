// 作成：Phase-15-7
// 写経レベル: 定型
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DetailedDesignPageContent } from "../DetailedDesignPageContent";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { makeStages } from "../../test-utils/stageFixtures";

function renderContent() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DetailedDesignPageContent projectId="p1" />
    </TamaguiProvider>,
  );
}

describe("DetailedDesignPageContent", () => {
  beforeEach(() => {
    useDetailedDesignStore.setState({
      projectId: "p1",
      stages: makeStages({ 1: { state: "reviewing", version: 1 } }),
      selectedStage: 1,
      status: "success",
      error: null,
      actionError: null,
      approving: false,
      fetchStages: vi.fn().mockResolvedValue(undefined),
      selectStage: vi.fn(),
      approve: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("マウント時にfetchStages(projectId)を呼び、ステッパーと選んだ段階を表示する", () => {
    renderContent();

    expect(useDetailedDesignStore.getState().fetchStages).toHaveBeenCalledWith(
      "p1",
    );
    expect(
      screen.getByRole("navigation", { name: "段階" }),
    ).toBeInTheDocument();
    expect(screen.getByText("段階1 機能一覧")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "← ドキュメントに戻る" }),
    ).toHaveAttribute("href", "/projects/p1/documents");
  });

  it("承認ボタンでapprove(projectId, 段階)を呼ぶ", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByRole("button", { name: "承認する" }));

    expect(useDetailedDesignStore.getState().approve).toHaveBeenCalledWith(
      "p1",
      1,
    );
  });

  it("取得に失敗したらエラーを表示する", () => {
    useDetailedDesignStore.setState({
      status: "error",
      stages: [],
      error: "詳細設計モードではありません",
    });

    renderContent();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "詳細設計モードではありません",
    );
  });
});
