// 作成：Phase-3-6
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
      fetchDocuments: vi.fn().mockResolvedValue(undefined),
      regenerate: vi.fn().mockResolvedValue(undefined),
      onRegenerationCompleted: vi.fn(),
    });
  });

  it("マウント時にfetchDocuments(projectId)を呼ぶ", () => {
    renderContent();

    expect(useDocumentsStore.getState().fetchDocuments).toHaveBeenCalledWith("p1");
  });

  it("再生成ボタン押下でregenerate(projectId)を呼ぶ", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByRole("button", { name: "再生成する" }));

    expect(useDocumentsStore.getState().regenerate).toHaveBeenCalledWith("p1");
  });

  it("useGenerationPollingへregeneratingを渡し、完了時にonRegenerationCompletedを呼ぶ", () => {
    useDocumentsStore.setState({ regenerating: true });

    renderContent();

    expect(useGenerationPollingMock).toHaveBeenCalledWith("p1", true, expect.any(Function));
    const onCompleted = useGenerationPollingMock.mock.calls[0][2] as () => void;
    onCompleted();
    expect(useDocumentsStore.getState().onRegenerationCompleted).toHaveBeenCalledWith("p1");
  });

  it("ドキュメントが無ければ空状態メッセージを表示する", () => {
    useDocumentsStore.setState({ status: "success", documents: [] });

    renderContent();

    expect(screen.getByText("まだ生成されたドキュメントがありません。")).toBeInTheDocument();
  });
});
