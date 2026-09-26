// 作成：Phase-3-5｜更新：Phase-3-6
// Phase-3-6：更新(ポーリングの詳細な挙動はuseGenerationPolling.test.tsへ移動したため、
// ここではChatPageContent自身の配線(見出し・状態メッセージの出し分け・フックへ正しい
// 引数を渡すか)だけを見る形に書き換えた)
// import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// import { act, render } from "@testing-library/react";
// import { TamaguiProvider } from "tamagui";
// import tamaguiConfig from "@/tamagui.config";
// import { ChatPageContent } from "../ChatPageContent";
// import { useHearingStore } from "@/features/hearing/hearing-store";
// import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
//
// const push = vi.fn();
//
// vi.mock("next/navigation", () => ({
//   useRouter: () => ({ push }),
// }));
//
// // ChatPanel自体はChatPanel.test.tsxで別途検証済みのため、ここではポーリングのみを見る。
// vi.mock("@/features/hearing/components/ChatPanel", () => ({
//   ChatPanel: () => null,
// }));
//
// function renderContent() {
//   return render(
//     <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
//       <ChatPageContent projectId="p1" />
//     </TamaguiProvider>,
//   );
// }
//
// describe("ChatPageContent", () => {
//   let stub: ReturnType<typeof stubFetch>;
//
//   beforeEach(() => {
//     push.mockClear();
//     useHearingStore.setState({ generationTriggered: false });
//     stub = stubFetch();
//   });
//
//   afterEach(() => {
//     stub.restore();
//     vi.useRealTimers();
//   });
//
//   it("generationTriggeredがfalseの間はポーリングしない", () => {
//     vi.useFakeTimers();
//     renderContent();
//
//     vi.advanceTimersByTime(20000);
//
//     expect(stub.requests).toHaveLength(0);
//   });
//
//   it("生成トリガー後は5秒ごとにstatusをポーリングし、completedになったらドキュメント画面へ遷移する", async () => {
//     useHearingStore.setState({ generationTriggered: true });
//     stub.queue({
//       status: 200,
//       body: { id: "p1", title: "t", status: "generating", created_at: "", updated_at: "" },
//     });
//     stub.queue({
//       status: 200,
//       body: { id: "p1", title: "t", status: "completed", created_at: "", updated_at: "" },
//     });
//     vi.useFakeTimers();
//     renderContent();
//
//     await act(async () => {
//       await vi.advanceTimersByTimeAsync(5000);
//     });
//     expect(stub.requests).toHaveLength(1);
//     expect(push).not.toHaveBeenCalled();
//
//     await act(async () => {
//       await vi.advanceTimersByTimeAsync(5000);
//     });
//     expect(stub.requests).toHaveLength(2);
//     expect(push).toHaveBeenCalledWith("/projects/p1/documents");
//   });
// });
// ↓↓
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ChatPageContent } from "../ChatPageContent";
import { useHearingStore } from "@/features/hearing/hearing-store";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// ChatPanelはChatPanel.test.tsx、ポーリングの詳細な挙動はuseGenerationPolling.test.tsで
// 別途検証済みのため、ここではChatPageContent自身の配線(見出し・状態メッセージの出し分け・
// フックへ正しい引数を渡すか)だけを見る。
vi.mock("@/features/hearing/components/ChatPanel", () => ({
  ChatPanel: () => null,
}));

const useGenerationPollingMock = vi.fn();
vi.mock("@/hooks/useGenerationPolling", () => ({
  useGenerationPolling: (...args: unknown[]) => useGenerationPollingMock(...args),
}));

function renderContent() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ChatPageContent projectId="p1" />
    </TamaguiProvider>,
  );
}

describe("ChatPageContent", () => {
  beforeEach(() => {
    push.mockClear();
    useGenerationPollingMock.mockReset().mockReturnValue({ timedOut: false });
    useHearingStore.setState({ generationTriggered: false, projectStatus: null });
  });

  it("useGenerationPollingへprojectIdとgenerationTriggeredを渡す", () => {
    useHearingStore.setState({ generationTriggered: true });

    renderContent();

    expect(useGenerationPollingMock).toHaveBeenCalledWith("p1", true, expect.any(Function));
  });

  it("completed検知時のコールバックはドキュメント画面へ遷移する", () => {
    renderContent();

    const onCompleted = useGenerationPollingMock.mock.calls[0][2] as () => void;
    onCompleted();

    expect(push).toHaveBeenCalledWith("/projects/p1/documents");
  });

  it("generationTriggered中は生成中メッセージを表示する", () => {
    useHearingStore.setState({ generationTriggered: true });

    renderContent();

    expect(screen.getByText("設計書を生成しています。しばらくお待ちください...")).toBeInTheDocument();
  });

  it("timedOut=trueならタイムアウトメッセージを表示する", () => {
    useGenerationPollingMock.mockReturnValue({ timedOut: true });

    renderContent();

    expect(screen.getByRole("alert")).toHaveTextContent("生成に時間がかかっています");
  });

  it.each(["completed", "revising"] as const)(
    "projectStatus==='%s'なら生成済みドキュメントへの常設リンクを表示する(自動遷移はしない)",
    (projectStatus) => {
      useHearingStore.setState({ projectStatus });

      renderContent();

      expect(screen.getByRole("link", { name: /生成済みのドキュメントを見る/ })).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    },
  );

  it.each(["interviewing", "generating", null] as const)(
    "projectStatus==='%s'なら常設リンクを表示しない",
    (projectStatus) => {
      useHearingStore.setState({ projectStatus });

      renderContent();

      expect(screen.queryByRole("link", { name: /生成済みのドキュメントを見る/ })).not.toBeInTheDocument();
    },
  );
});
