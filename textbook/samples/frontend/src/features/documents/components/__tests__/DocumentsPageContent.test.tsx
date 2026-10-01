// 作成：Phase-3-6｜更新：Phase-11-4,15-7,15-8
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DocumentsPageContent } from "../DocumentsPageContent";
import { useDocumentsStore } from "@/features/documents/documents-store";

const useGenerationPollingMock = vi.fn();
vi.mock("@/hooks/useGenerationPolling", () => ({
  useGenerationPolling: (...args: unknown[]) => useGenerationPollingMock(...args),
}));

// DocumentTabs自体はDocumentTabs.test.tsxで別途検証済みのため、ここでは
// DocumentsPageContent自身の配線(取得・再生成・状態表示の出し分け)だけを見る。
vi.mock("@/features/documents/components/DocumentTabs", () => ({
  DocumentTabs: () => null,
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
    });
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

    expect(useDocumentsStore.getState().regenerate).toHaveBeenCalledWith("p1");
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
  it("設計図の生成・一覧画面へのリンクを表示する", () => {
    renderContent();

    expect(screen.getByRole("link", { name: "設計図を生成する →" })).toHaveAttribute(
      "href",
      "/projects/p1/uml",
    );
  });

  // Phase-15-7:追記
  it("詳細設計モードでは、設計図の生成ではなく詳細設計へ進むリンクを表示する", () => {
    useDocumentsStore.setState({ projectMode: "detailed" });

    renderContent();

    expect(screen.getByRole("link", { name: "詳細設計へ進む →" })).toHaveAttribute(
      "href",
      "/projects/p1/detailed-design",
    );
    expect(screen.queryByRole("link", { name: "設計図を生成する →" })).not.toBeInTheDocument();
  });

  it("ドキュメントが無ければ空状態メッセージを表示する", () => {
    useDocumentsStore.setState({ status: "success", documents: [] });

    renderContent();

    expect(screen.getByText("まだ生成されたドキュメントがありません。")).toBeInTheDocument();
  });
});
