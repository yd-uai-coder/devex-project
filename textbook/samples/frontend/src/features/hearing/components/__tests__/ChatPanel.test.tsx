// 作成：Phase-3-5｜更新：Phase-4-2,15-8,24(ゴール3後の調整),35-3,35(完了後の調整)
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ChatPanel } from "../ChatPanel";
import { useHearingStore } from "@/features/hearing/hearing-store";
import { ApiError } from "@/lib/api/client";

function renderPanel() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ChatPanel projectId="p1" />
    </TamaguiProvider>,
  );
}

describe("ChatPanel", () => {
  beforeEach(() => {
    useHearingStore.setState({
      messages: [],
      historyStatus: "idle",
      sending: false,
      streamingReply: "",
      connectionLost: false,
      // Phase-15-8:追記
      streamError: null,
      completion: null,
      // Phase-35(完了後の調整):追記
      points: null,
      generationTriggered: false,
      // Phase-35-3:追記
      cardDrafts: {},
      selectCardOption: vi.fn(),
      loadHistory: vi.fn().mockResolvedValue(undefined),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      approveAndGenerate: vi.fn().mockResolvedValue(undefined),
      dismissConnectionLost: vi.fn(),
    });
  });

  it("マウント時にloadHistory(projectId)を呼ぶ", () => {
    renderPanel();

    expect(useHearingStore.getState().loadHistory).toHaveBeenCalledWith("p1");
  });

  it("メッセージ一覧とストリーミング中の返信を表示する", () => {
    useHearingStore.setState({
      messages: [{ id: "1", sender: "user", message: "こんにちは", created_at: "" }],
      streamingReply: "考え中...",
    });

    renderPanel();

    expect(screen.getByText("こんにちは")).toBeInTheDocument();
    expect(screen.getByText("考え中...")).toBeInTheDocument();
  });

  it("sender==='attachment'のメッセージは表示しない(senderで判定、文字列内容は見ない)", () => {
    useHearingStore.setState({
      messages: [
        { id: "1", sender: "intake", message: "システム概要：s\n添付ファイル：spec.pdf", created_at: "" },
        { id: "2", sender: "attachment", message: "[添付ファイル: spec.pdf]\n本文のテキスト", created_at: "" },
      ],
    });

    renderPanel();

    expect(screen.getByText("添付ファイル：spec.pdf", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("本文のテキスト", { exact: false })).not.toBeInTheDocument();
  });

  it("sender==='others'(自己診断結果)のメッセージは表示しない(チャットに戻るたびに再表示されないようにする)", () => {
    useHearingStore.setState({
      messages: [
        { id: "1", sender: "user", message: "こんにちは", created_at: "" },
        { id: "2", sender: "others", message: "## 自己診断\n最重要: 特になし", created_at: "" },
      ],
    });

    renderPanel();

    expect(screen.getByText("こんにちは")).toBeInTheDocument();
    expect(screen.queryByText("自己診断", { exact: false })).not.toBeInTheDocument();
  });

  it("送信ボタン押下でsendMessage(projectId, テキスト)を呼び、入力欄をクリアする", async () => {
    const user = userEvent.setup();
    renderPanel();

    const textarea = screen.getByPlaceholderText("メッセージを入力");
    await user.type(textarea, "予約管理システムを作りたい");
    await user.click(screen.getByRole("button", { name: "送信" }));

    expect(useHearingStore.getState().sendMessage).toHaveBeenCalledWith("p1", "予約管理システムを作りたい");
    expect(textarea).toHaveValue("");
  });

  // Phase-35-3:追記
  it("最新のAIの発言のカードだけを選べ、選んでいれば文が空でも送れる", async () => {
    const card = (id: string) => ({
      id,
      point_key: "availability",
      label: id,
      question: `${id}の問い`,
      options: [
        { label: `${id}-A`, result: "" },
        { label: `${id}-B`, result: "" },
      ],
      recommended: 0,
      reason: "",
      selected: null,
    });
    useHearingStore.setState({
      messages: [
        { id: "a1", sender: "ai", message: "古い", cards: [card("old")], created_at: "" },
        { id: "a2", sender: "ai", message: "新しい", cards: [card("new")], created_at: "" },
      ],
    });
    const user = userEvent.setup();
    const { rerender } = renderPanel();

    expect(screen.getByRole("button", { name: "送信" })).toHaveAttribute("aria-disabled", "true");
    // Phase-35(完了後の調整)：更新(選択肢はラジオボタン)
    // expect(screen.getByRole("button", { name: /old-A/ })).toHaveAttribute("aria-disabled", "true");
    // await user.click(screen.getByRole("button", { name: /new-B/ }));
    // ↓↓
    expect(screen.getByRole("radio", { name: /old-A/ })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /new-B/ }));
    expect(useHearingStore.getState().selectCardOption).toHaveBeenCalledWith("new", 1);

    useHearingStore.setState({ cardDrafts: { new: 1 } });
    rerender(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <ChatPanel projectId="p1" />
      </TamaguiProvider>,
    );
    await user.click(screen.getByRole("button", { name: "送信(カード 1 件の選択を含む)" }));
    expect(useHearingStore.getState().sendMessage).toHaveBeenCalledWith("p1", "");
  });

  // Phase-35(完了後の調整):追記
  it("カードごとの「この回答を送る」は、そのカードだけを入力欄の文と一緒に送る", async () => {
    const card = {
      id: "new",
      point_key: "availability",
      label: "可用性",
      question: "問い",
      options: [
        { label: "A", result: "" },
        { label: "B", result: "" },
      ],
      recommended: 0,
      reason: "",
      selected: null,
    };
    useHearingStore.setState({
      messages: [{ id: "a1", sender: "ai", message: "質問", cards: [card], created_at: "" }],
      cardDrafts: { new: 1 },
    });
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByPlaceholderText("メッセージを入力"), "補足");
    await user.click(screen.getByRole("button", { name: "この回答を送る" }));

    expect(useHearingStore.getState().sendMessage).toHaveBeenCalledWith("p1", "補足", { cardIds: ["new"] });
  });

  // Phase-35(完了後の調整):追記
  it("バナーの「任意項目についてヒアリングを続ける」で、continueOptional 付きで送る", async () => {
    useHearingStore.setState({
      completion: { is_sufficient: true, summary: "", missing_points: [] },
      points: {
        scale: "personal",
        legacy: false,
        stale: false,
        is_sufficient: true,
        points: [
          {
            key: "schedule",
            kind: "function",
            label: "体制・期間",
            question: "何人で作りますか",
            required: false,
            status: "open",
            summary: "",
            evidence: [],
          },
        ],
      },
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "任意項目についてヒアリングを続ける" }));

    // Phase-35(完了後の調整)：更新(文は送らない。サーバーが決まった文を利用者の発言として残し、判定の LLM は呼ばない)
    // expect(useHearingStore.getState().sendMessage).toHaveBeenCalledWith(
    //   "p1",
    //   "任意の項目についてもヒアリングを続けてください",
    //   { continueOptional: true },
    // );
    // ↓↓
    expect(useHearingStore.getState().sendMessage).toHaveBeenCalledWith("p1", "", { continueOptional: true });
  });

  it("connectionLostがtrueなら警告バナーを表示し、閉じるボタンでdismissConnectionLostを呼ぶ", async () => {
    useHearingStore.setState({ connectionLost: true });
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent("接続が切れました");
    await user.click(screen.getByRole("button", { name: "閉じる" }));

    expect(useHearingStore.getState().dismissConnectionLost).toHaveBeenCalled();
  });

  it("completionがあり生成未トリガーならHearingCompletionBannerを表示する", () => {
    useHearingStore.setState({
      completion: { is_sufficient: true, summary: "要約です", missing_points: [] },
    });

    renderPanel();

    // Phase-24：更新
    // expect(screen.getByText("要約です")).toBeInTheDocument();
    // ↓↓
    expect(screen.getByRole("button", { name: "この内容で設計書を生成する" })).toBeInTheDocument();
  });

  // Phase-4-2:追記 ── approveAndGenerate失敗時にボタンが固まったまま
  // (setApproving(false)未到達)になり、失敗理由も表示されない不具合の回帰テスト。
  it("生成トリガーが失敗したらエラーを表示し、承認ボタンを再度押せる状態に戻す", async () => {
    const approveAndGenerate = vi.fn().mockRejectedValue(new ApiError(500, "生成の開始に失敗しました"));
    useHearingStore.setState({
      completion: { is_sufficient: true, summary: "要約です", missing_points: [] },
      approveAndGenerate,
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "この内容で設計書を生成する" }));
    // Phase-15-8:追記 ── 確認ダイアログで確定する(ダイアログ内のボタンは aria-label で取る)
    await user.click(screen.getByLabelText("生成する"));

    expect(await screen.findByRole("alert")).toHaveTextContent("生成の開始に失敗しました");
    expect(screen.getByRole("button", { name: "この内容で設計書を生成する" })).not.toBeDisabled();
  });
  // Phase-15-8:追記
  it("バックエンドが伝えた失敗の理由を表示し、保存されていないことを伝える", () => {
    useHearingStore.setState({ streamError: "本日の利用上限に達しました。" });

    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "本日の利用上限に達しました。 送信したメッセージは保存されていません。",
    );
  });
});
