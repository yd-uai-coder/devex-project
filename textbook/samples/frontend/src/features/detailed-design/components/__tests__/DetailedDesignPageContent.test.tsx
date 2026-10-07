// 作成：Phase-15-7｜更新：Phase-16-6,18-9,22-6,23-6,27-3
// 写経レベル: 定型
// Phase-16-6:追記 ── ../../test-utils/stageFixtures.makeFunctionList
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DetailedDesignPageContent } from "../DetailedDesignPageContent";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { makeFunctionList, makeStages } from "../../test-utils/stageFixtures";

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
      // Phase-16-6：更新
      // stages: makeStages({ 1: { state: "reviewing", version: 1 } }),
      // ↓↓
      stages: makeStages({
        1: { state: "reviewing", version: 1, model: makeFunctionList() },
      }),
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

  // Phase-22-6:追記
  it("詳細設計書のダウンロードを上部に出す", () => {
    renderContent();

    expect(
      // Phase-23-6：更新
      // screen.getByRole("button", { name: "詳細設計書をダウンロード(.zip)" }),
      // ↓↓
      screen.getByRole("button", { name: "詳細設計書と実装計画をダウンロード(.zip)" }),
    ).toBeInTheDocument();
    // Phase-23-6：更新
    // expect(screen.getByRole("status")).toHaveTextContent("6 件が未承認");
    // ↓↓
    expect(screen.getByRole("status")).toHaveTextContent("7 件が未承認");
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

  // Phase-18-9:追記
  // ダイアログ内のボタンは jsdom ではロールのクエリで「隠れている」扱いになるため、aria-label で取る
  it("承認できたら完了のダイアログを出し、「次の段階へ進む」で次の段階を選ぶ", async () => {
    const user = userEvent.setup();
    useDetailedDesignStore.setState({ approve: vi.fn().mockResolvedValue(true) });
    renderContent();

    await user.click(screen.getByRole("button", { name: "承認する" }));

    expect(await screen.findByText("段階1-機能一覧を承認しました。")).toBeInTheDocument();
    expect(screen.getByLabelText("閉じる")).toBeInTheDocument();
    await user.click(screen.getByLabelText("次の段階へ進む"));
    expect(useDetailedDesignStore.getState().selectStage).toHaveBeenCalledWith(2);
  });

  it("承認できなかったときはダイアログを出さない", async () => {
    const user = userEvent.setup();
    renderContent();
    await user.click(screen.getByRole("button", { name: "承認する" }));
    expect(screen.queryByText(/を承認しました。/)).not.toBeInTheDocument();
  });

  // Phase-27-3：更新
  // it("段階7の承認では次の段階が無いので、「閉じる」だけを出す", async () => {
  // ↓↓
  it("段階8の承認では次の段階が無いので、「閉じる」だけを出す", async () => {
    const user = userEvent.setup();
    useDetailedDesignStore.setState({
      stages: makeStages({
        // Phase-27-3：更新
        // 7: { is_open: true, missing_inputs: [], state: "reviewing", version: 1, model: { x: 1 } },
        // ↓↓
        8: { is_open: true, missing_inputs: [], state: "reviewing", version: 1, model: { units: [] } },
      }),
      // Phase-27-3：更新
      // selectedStage: 7,
      // ↓↓
      selectedStage: 8,
      approve: vi.fn().mockResolvedValue(true),
    });
    renderContent();

    await user.click(screen.getByRole("button", { name: "承認する" }));

    // Phase-23-6：更新
    // expect(await screen.findByText("段階7-実装計画を承認しました。")).toBeInTheDocument();
    // ↓↓
    // Phase-27-3：更新
    // expect(await screen.findByText("段階7-横断事項と実装計画を承認しました。")).toBeInTheDocument();
    // ↓↓
    expect(await screen.findByText("段階8-実装手順書を承認しました。")).toBeInTheDocument();
    expect(screen.queryByLabelText("次の段階へ進む")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("閉じる"));
    expect(useDetailedDesignStore.getState().selectStage).not.toHaveBeenCalled();
  });
});
