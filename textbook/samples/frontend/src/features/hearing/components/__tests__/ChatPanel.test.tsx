// 作成：Phase-3-5
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ChatPanel } from "../ChatPanel";
import { useHearingStore } from "@/features/hearing/hearing-store";

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
      completion: null,
      generationTriggered: false,
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

    expect(screen.getByText("要約です")).toBeInTheDocument();
  });
});
