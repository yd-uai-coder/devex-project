// 作成：Phase-3-6｜更新：Phase-11-4,15-7,15-8,24(完了後の調整),31-5,53-4,53(完了後の調整),54-2
// Phase-53-4:追記 ── @testing-library/react.act
// Phase-54-2:追記 ── @/features/design-review/review-store.useReviewStore, @/features/design-review/test-utils/reviewFixtures.as, @/features/design-review/test-utils/reviewFixtures.finding, @/features/design-review/test-utils/reviewFixtures.gate, @/features/design-review/test-utils/reviewFixtures.reviewUser, @/features/design-review/test-utils/reviewFixtures.run, @/features/design-review/test-utils/reviewFixtures.user
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DocumentsPageContent } from "../DocumentsPageContent";
import { useDocumentsStore } from "@/features/documents/documents-store";
// Phase-54-2:追記
import { useReviewStore } from "@/features/design-review/review-store";
import { finding, gate, run, user as reviewUser } from "@/features/design-review/test-utils/reviewFixtures";

const useGenerationPollingMock = vi.fn();
vi.mock("@/hooks/useGenerationPolling", () => ({
  // Phase-53(完了後の調整):追記
  POLL_INTERVAL_MS: 5000,
  useGenerationPolling: (...args: unknown[]) => useGenerationPollingMock(...args),
}));

// DocumentTabs自体はDocumentTabs.test.tsxで別途検証済みのため、ここでは
// DocumentsPageContent自身の配線(取得・再生成・状態表示の出し分け)だけを見る。
// Phase-53-4:追記
const tabsProps = vi.fn();
vi.mock("@/features/documents/components/DocumentTabs", () => ({
  // Phase-53-4：更新
  // DocumentTabs: () => null,
  // ↓↓
  DocumentTabs: (props: unknown) => {
    tabsProps(props);
    return null;
  },
}));

// Phase-53-4:追記
// レビューのパネル自体は ReviewPanel.test.tsx で検証済み。ここでは渡す区切り・対象から飛ぶ操作だけを見る
const panelProps = vi.fn();
vi.mock("@/features/design-review/components/ReviewPanel", () => ({
  ReviewPanel: (props: unknown) => {
    panelProps(props);
    return null;
  },
}));

function renderContent() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DocumentsPageContent projectId="p1" />
    </TamaguiProvider>,
  );
}

describe("DocumentsPageContent", () => {
  beforeEach(() => {
    useGenerationPollingMock.mockReset().mockReturnValue({ timedOut: false });
    useDocumentsStore.setState({
      documents: [],
      status: "idle",
      error: null,
      fetchedAt: null,
      regenerating: false,
      // Phase-15-8:追記
      regenerateError: null,
      // Phase-15-7:追記
      projectMode: "simple",
      fetchDocuments: vi.fn().mockResolvedValue(undefined),
      // Phase-15-7:追記
      fetchProjectMode: vi.fn().mockResolvedValue(undefined),
      regenerate: vi.fn().mockResolvedValue(undefined),
      onRegenerationCompleted: vi.fn(),
      // Phase-53(完了後の調整):追記
      progress: null,
      fetchProgress: vi.fn().mockResolvedValue(undefined),
    });
    // Phase-54-2:追記
    useReviewStore.setState({ me: null, gates: [] });
  });

  // Phase-15-7：更新
  // it("マウント時にfetchDocuments(projectId)を呼ぶ", () => {
  // ↓↓
  it("マウント時にfetchDocuments(projectId)とfetchProjectMode(projectId)を呼ぶ", () => {
    renderContent();

    expect(useDocumentsStore.getState().fetchDocuments).toHaveBeenCalledWith("p1");
    // Phase-15-7:追記
    expect(useDocumentsStore.getState().fetchProjectMode).toHaveBeenCalledWith("p1");
  });

  // Phase-15-8：更新(押すと確認ダイアログを開き、確定してから再生成する)
  // it("再生成ボタン押下でregenerate(projectId)を呼ぶ", async () => {
  //   const user = userEvent.setup();
  //   renderContent();
  //
  //   await user.click(screen.getByRole("button", { name: "再生成する" }));
  //
  //   expect(useDocumentsStore.getState().regenerate).toHaveBeenCalledWith("p1");
  // });
  // ↓↓
  it("再生成ボタン押下で確認ダイアログを開き、確定するとregenerate(projectId)を呼ぶ", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByRole("button", { name: "再生成する" }));
    expect(useDocumentsStore.getState().regenerate).not.toHaveBeenCalled();
    // ダイアログ内のボタンは jsdom ではロールのクエリで「隠れている」扱いになるため、aria-label で取る
    await user.click(screen.getByLabelText("再生成する"));

    // Phase-53(完了後の調整)：更新
    // expect(useDocumentsStore.getState().regenerate).toHaveBeenCalledWith("p1");
    // ↓↓
    // 既定の起点は最初の文書(全部を作り直す。起点は送らない)
    // Phase-54-2：更新
    // expect(useDocumentsStore.getState().regenerate).toHaveBeenCalledWith("p1", undefined);
    // ↓↓
    expect(useDocumentsStore.getState().regenerate).toHaveBeenCalledWith("p1", undefined, []);
  });

  it("未対応の採用した指摘を選んだ状態で開き、関連する最も上流の文書を起点にする", async () => {
    useReviewStore.setState({
      me: reviewUser(),
      gates: [
        gate({
          status: "reviewed",
          run: run({
            findings: [
              finding({ id: "ext", decision: "adopted", followup: "unaddressed", documents: ["external_design"], problem: "認可が無い" }),
              finding({ id: "done", decision: "adopted", followup: "changed", documents: ["requirements"], problem: "直した" }),
              finding({ id: "hear", decision: "adopted", cause: "hearing", followup: "unaddressed", documents: ["requirements"] }),
            ],
          }),
        }),
      ],
    });
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByRole("button", { name: "再生成する" }));
    // ヒアリングの指摘は聞き直しで直すので、再生成の指示には出さない
    expect(screen.getByLabelText(/認可が無い/)).toBeChecked();
    expect(screen.getByLabelText(/直した/)).not.toBeChecked();
    expect(screen.getByLabelText(/外部設計以降を再生成/)).toBeChecked();
    await user.click(screen.getByLabelText(/直した/));
    await user.click(screen.getByLabelText("再生成する"));

    expect(useDocumentsStore.getState().regenerate).toHaveBeenCalledWith("p1", "external_design", ["ext", "done"]);
  });

  it("再生成の起点を選ぶと、その文書から下流を作り直す", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByRole("button", { name: "再生成する" }));
    expect(screen.getByText("(内部設計・実装計画)")).toBeInTheDocument();
    await user.click(screen.getByLabelText(/内部設計以降を再生成/));
    await user.click(screen.getByLabelText("再生成する"));

    // Phase-54-2：更新
    // expect(useDocumentsStore.getState().regenerate).toHaveBeenCalledWith("p1", "internal_design");
    // ↓↓
    expect(useDocumentsStore.getState().regenerate).toHaveBeenCalledWith("p1", "internal_design", []);
  });

  it("再生成中は文書ごとの進み具合を出し、取り直す", () => {
    useDocumentsStore.setState({
      regenerating: true,
      progress: { targets: ["external_design", "internal_design", "implementation_plan"], done: ["external_design"], current: "internal_design" },
    });
    renderContent();

    expect(useDocumentsStore.getState().fetchProgress).toHaveBeenCalledWith("p1");
    expect(screen.getByLabelText("再生成の進み具合")).toHaveTextContent(
      "要件定義：対象外 外部設計：生成完了 内部設計：生成中 実装計画：待ち",
    );
  });

  // Phase-15-8:追記
  it("再生成の受け付けの失敗を表示する", () => {
    useDocumentsStore.setState({ regenerateError: "設計書を生成しています。" });

    renderContent();

    expect(screen.getByRole("alert")).toHaveTextContent("設計書を生成しています。");
  });

  it("useGenerationPollingへregeneratingを渡し、完了時にonRegenerationCompletedを呼ぶ", () => {
    useDocumentsStore.setState({ regenerating: true });

    renderContent();

    expect(useGenerationPollingMock).toHaveBeenCalledWith("p1", true, expect.any(Function));
    const onCompleted = useGenerationPollingMock.mock.calls[0][2] as () => void;
    onCompleted();
    expect(useDocumentsStore.getState().onRegenerationCompleted).toHaveBeenCalledWith("p1");
  });

  // Phase-11-4:追記
  // Phase-24：更新
  // it("設計図の生成・一覧画面へのリンクを表示する", () => {
  // ↓↓
  it("簡易ドキュメントモードでは、詳細設計へ進むリンクを出さない", () => {
    useDocumentsStore.setState({ projectMode: "simple" });

    renderContent();

    // Phase-24：更新
    // expect(screen.getByRole("link", { name: "設計図を生成する →" })).toHaveAttribute(
    //   "href",
    //   "/projects/p1/uml",
    // );
    // ↓↓
    expect(screen.queryByRole("link", { name: "詳細設計へ進む →" })).not.toBeInTheDocument();
  });

  // Phase-15-7:追記
  // Phase-24：更新
  // it("詳細設計モードでは、設計図の生成ではなく詳細設計へ進むリンクを表示する", () => {
  // ↓↓
  it("詳細設計モードでは、詳細設計へ進むリンクを表示する", () => {
    useDocumentsStore.setState({ projectMode: "detailed" });

    renderContent();

    expect(screen.getByRole("link", { name: "詳細設計へ進む →" })).toHaveAttribute(
      "href",
      "/projects/p1/detailed-design",
    );
    // Phase-24：削除
    // expect(screen.queryByRole("link", { name: "設計図を生成する →" })).not.toBeInTheDocument();
  });

  it("ドキュメントが無ければ空状態メッセージを表示する", () => {
    useDocumentsStore.setState({ status: "success", documents: [] });

    renderContent();

    expect(screen.getByText("まだ生成されたドキュメントがありません。")).toBeInTheDocument();
  });

  // Phase-31-5:追記
  it("簡易ドキュメントモードでは、実装手順書へ進むリンクを表示する(同じ詳細設計画面を段階8だけで開く)", () => {
    useDocumentsStore.setState({ projectMode: "simple" });

    renderContent();

    expect(screen.getByRole("link", { name: "実装手順書へ進む →" })).toHaveAttribute(
      "href",
      "/projects/p1/detailed-design",
    );
  });

  // Phase-53-4:追記
  it("レビューのパネルに文書の区切りを渡し、指摘の対象から文書のタブへ移る", () => {
    useDocumentsStore.setState({
      documents: [
        { id: "d1", doc_type: "requirements", content: "#", version: 2, created_at: "", is_current: true },
        { id: "d2", doc_type: "external_design", content: "#", version: 1, created_at: "", is_current: true },
      ],
      status: "success",
    });
    renderContent();

    const props = panelProps.mock.lastCall?.[0] as {
      gates: string[];
      refreshKey: string;
      targetAction: (target: string) => { onPress: () => void } | null;
    };
    expect(props.gates).toEqual(["documents"]);
    expect(props.refreshKey).toBe("requirements:2,external_design:1");
    // 無い文書・推定できない対象は押せない
    expect(props.targetAction("DF-1")).toBeNull();
    expect(props.targetAction("観点 セキュリティ")).toBeNull();
    act(() => props.targetAction("SCR-004")?.onPress());
    expect(tabsProps.mock.lastCall?.[0]).toMatchObject({ activeType: "external_design" });
  });

  // Phase-53(完了後の調整):追記
  it("待つ時間の上限を過ぎたら、再生成中の文の代わりに読み込み直しを促す", () => {
    useGenerationPollingMock.mockReturnValue({ timedOut: true });
    useDocumentsStore.setState({ regenerating: true });
    renderContent();

    expect(screen.getByRole("alert")).toHaveTextContent("再生成に時間がかかっています");
    expect(screen.queryByText("再生成しています。しばらくお待ちください...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再生成中..." })).toHaveAttribute("aria-disabled", "true");
  });
});
