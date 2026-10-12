// 作成：Phase-44-2｜更新：Phase-44-4,44(完了後の調整)
// Phase-44(完了後の調整):追記 ── @testing-library/react.act
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ChangeImpactPanel } from "../ChangeImpactPanel";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { makeElementChange, makeImpact, makeStages } from "../../test-utils/stageFixtures";

function renderPanel() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ChangeImpactPanel projectId="p1" />
    </TamaguiProvider>,
  );
}

describe("ChangeImpactPanel", () => {
  beforeEach(() => {
    useDetailedDesignStore.setState({
      stages: makeStages(),
      impact: makeImpact(),
      impactError: null,
      reviewing: false,
      reviewMarks: vi.fn().mockResolvedValue(true),
      showInTable: vi.fn(),
      // Phase-44-4:追記
      requestingGeneration: false,
      regenerate: vi.fn().mockResolvedValue(undefined),
      selectStage: vi.fn(),
      // Phase-44(完了後の調整):追記
      selectedStage: 5,
    });
  });

  // Phase-44(完了後の調整):追記
  // 段階の絞り込みを外す(初めは選んでいる段階だけを出すため)
  async function showAllStages(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "全段階" }));
  }

  it("印も変わったものも無ければ出さない", () => {
    useDetailedDesignStore.setState({ impact: null });
    renderPanel();
    expect(screen.queryByRole("region", { name: "変更の影響" })).not.toBeInTheDocument();
  });

  // Phase-44(完了後の調整)：更新
  // it("未確認があれば開いて、変わったもの(重複なし)と段階ごとの印を出す", () => {
  // ↓↓
  it("未確認があれば開いて、全段階では変わったもの(重複なし)と段階ごとの印を出す", async () => {
    const user = userEvent.setup();
    renderPanel();
    // Phase-44(完了後の調整):追記
    await showAllStages(user);

    expect(screen.getByText("変更の影響(未確認 2)")).toBeInTheDocument();
    const changes = screen.getByRole("table", { name: "変わったもの" });
    // 段階5・6・8 に記録された同じ変更は1行、承認していない編集の差分は別の行
    expect(within(changes).getAllByRole("row")).toHaveLength(3);
    expect(within(changes).getByText("(承認すると届く)")).toBeInTheDocument();
    expect(screen.getByText("段階5 主要処理の手順(見直し 1 / 確認済み 0)")).toBeInTheDocument();
    expect(screen.getByText("この単位が、変わったモジュールに依存する")).toBeInTheDocument();
    expect(screen.getAllByLabelText("変更の影響: 承認すると付く")).toHaveLength(1);
  });

  it("文書の変更には文書の画面へのリンクを添える", () => {
    const impact = makeImpact();
    impact.stages[4].changes = [
      makeElementChange({ source: "doc:external_design", key: "screen:SCR-001", stage: 0 }),
    ];
    useDetailedDesignStore.setState({ impact });
    renderPanel();

    expect(screen.getByText("外部設計書")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /文書を開く/ })).toHaveAttribute(
      "href",
      "/projects/p1/documents",
    );
  });

  it("確認済み・未確認に戻す・段階まとめての確認済みで reviewMarks を呼ぶ", async () => {
    const user = userEvent.setup();
    renderPanel();
    // Phase-44(完了後の調整):追記
    await showAllStages(user);
    const reviewMarks = useDetailedDesignStore.getState().reviewMarks;

    await user.click(screen.getByRole("button", { name: "proc:F-01 を確認済みにする" }));
    expect(reviewMarks).toHaveBeenCalledWith("p1", 5, ["proc:F-01"], true);

    await user.click(
      screen.getByRole("button", {
        name: "logic:app/api/routes/reservations.py::create_reservation を未確認に戻す",
      }),
    );
    expect(reviewMarks).toHaveBeenCalledWith(
      "p1",
      6,
      ["logic:app/api/routes/reservations.py::create_reservation"],
      false,
    );

    const stage8 = screen.getByLabelText("段階8 実装手順書の印");
    await user.click(
      within(stage8).getByRole("button", { name: "この段階の未確認をすべて確認済みにする" }),
    );
    expect(reviewMarks).toHaveBeenCalledWith("p1", 8, ["unit:U-002"], true);
    // pending の印は確認済みにできない
    expect(
      screen.queryByRole("button", { name: "task:U-002 を確認済みにする" }),
    ).not.toBeInTheDocument();
  });

  it("「表で見る」で showInTable(段階, キー) を呼ぶ", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "proc:F-01 を段階の表で見る" }));
    expect(useDetailedDesignStore.getState().showInTable).toHaveBeenCalledWith(5, "proc:F-01");
  });

  it("たためて、取得の失敗を出す", async () => {
    const user = userEvent.setup();
    useDetailedDesignStore.setState({ impactError: "変更の影響の取得に失敗しました" });
    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent("変更の影響の取得に失敗しました");
    await user.click(screen.getByRole("button", { name: "たたむ" }));
    expect(screen.queryByRole("table", { name: "変わったもの" })).not.toBeInTheDocument();
  });

  // Phase-44-4:追記
  it("再生成の候補を段階ごとに並べ、選んだ候補でその段階へ移って部分再生成を呼ぶ", async () => {
    const user = userEvent.setup();
    useDetailedDesignStore.setState({
      stages: makeStages({ 5: { is_open: true }, 8: { is_open: true } }),
    });
    renderPanel();
    // Phase-44(完了後の調整):追記
    await showAllStages(user);
    const { regenerate, selectStage } = useDetailedDesignStore.getState();

    const stage5 = screen.getByLabelText("段階5の再生成の候補");
    await user.click(within(stage5).getByRole("button", { name: "選んだ候補を再生成する(1件)" }));
    expect(selectStage).toHaveBeenCalledWith(5);
    expect(regenerate).toHaveBeenCalledWith("p1", 5, ["proc:F-01"]);

    // 外すと押せない
    const stage8 = screen.getByLabelText("段階8の再生成の候補");
    await user.click(within(stage8).getByRole("checkbox", { name: "M-01-T02 の手順書" }));
    expect(within(stage8).getByRole("button", { name: "選んだ候補を再生成する(0件)" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  // Phase-44(完了後の調整)：更新
  // it("開いていない段階・生成中の段階の候補は再生成できない", () => {
  // ↓↓
  it("開いていない段階・生成中の段階の候補は再生成できない", async () => {
    const user = userEvent.setup();
    useDetailedDesignStore.setState({
      stages: makeStages({ 5: { is_open: true, generation_status: "generating" } }),
    });
    renderPanel();
    // Phase-44(完了後の調整):追記
    await showAllStages(user);

    expect(
      within(screen.getByLabelText("段階5の再生成の候補")).getByRole("button", { name: /再生成する/ }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(within(screen.getByLabelText("段階8の再生成の候補")).getByText(/まだ開いていません/)).toBeInTheDocument();
  });

  // Phase-44(完了後の調整):追記
  it("初めは選んでいる段階の印・変わったもの・再生成の候補だけを出し、段階が変わると追従する", () => {
    renderPanel();

    expect(screen.getByText("段階5 主要処理の手順(見直し 1 / 確認済み 0)")).toBeInTheDocument();
    expect(screen.queryByLabelText("段階8 実装手順書の印")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "変わったもの" })).getAllByRole("row")).toHaveLength(2);
    expect(screen.getByLabelText("段階5の再生成の候補")).toBeInTheDocument();
    expect(screen.queryByLabelText("段階8の再生成の候補")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "段階5(未確認 1)" })).toHaveAttribute("aria-pressed", "true");

    act(() => useDetailedDesignStore.setState({ selectedStage: 8 }));
    expect(screen.getByLabelText("段階8 実装手順書の印")).toBeInTheDocument();
    expect(screen.queryByLabelText("段階5 主要処理の手順の印")).not.toBeInTheDocument();

    act(() => useDetailedDesignStore.setState({ selectedStage: 2 }));
    expect(screen.getByText("この段階に届いた印はありません。")).toBeInTheDocument();
  });

  it("段階のボタンで段階を選び直し、「全段階」から戻る", async () => {
    const user = userEvent.setup();
    renderPanel();

    await showAllStages(user);
    expect(screen.getByLabelText("段階8 実装手順書の印")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "段階8(未確認 1)" }));
    expect(useDetailedDesignStore.getState().selectStage).toHaveBeenCalledWith(8);
    // selectStage はスタブなので、選んでいる段階(5)だけに戻る
    expect(screen.queryByLabelText("段階8 実装手順書の印")).not.toBeInTheDocument();
  });

  it("「未確認のみ」で確認済みと承認すると付く印を隠す", async () => {
    const user = userEvent.setup();
    renderPanel();
    await showAllStages(user);

    await user.click(screen.getByRole("checkbox", { name: "未確認のみ" }));
    expect(screen.queryByLabelText("段階6 処理ロジックの詳細(任意)の印")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("段階7 横断事項と実装計画の印")).not.toBeInTheDocument();
    expect(screen.getByLabelText("段階5 主要処理の手順の印")).toBeInTheDocument();
    expect(screen.getByLabelText("段階8 実装手順書の印")).toBeInTheDocument();

    act(() => useDetailedDesignStore.setState({ selectedStage: 6 }));
    await user.click(screen.getByRole("button", { name: "段階6" }));
    expect(screen.getByText("この段階に未確認の印はありません。")).toBeInTheDocument();
  });
});
