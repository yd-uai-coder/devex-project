// 作成：Phase-3-5
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import ProjectChatPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/p1/chat",
  useRouter: () => ({ push: vi.fn() }),
}));

// ChatPageContent自体は別ファイルで検証済みのため、ここではparams解決+RequireAuthの
// 配線だけを見る。
vi.mock("@/features/hearing/components/ChatPageContent", () => ({
  ChatPageContent: ({ projectId }: { projectId: string }) => <div>chat for {projectId}</div>,
}));

describe("ProjectChatPage", () => {
  it("paramsのidをChatPageContentへ渡し、RequireAuthでガードする", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    const element = await ProjectChatPage({ params: Promise.resolve({ id: "p1" }) });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("chat for p1")).toBeInTheDocument();
  });
});
