// 作成：Phase-87-2
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import ChangeRequestsPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/p1/change-requests",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/change-requests/components/ChangeRequestsPageContent", () => ({
  ChangeRequestsPageContent: ({ projectId }: { projectId: string }) => <div>change requests for {projectId}</div>,
}));

describe("ChangeRequestsPage", () => {
  it("paramsのidをChangeRequestsPageContentへ渡し、RequireAuthでガードする", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    const element = await ChangeRequestsPage({ params: Promise.resolve({ id: "p1" }) });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("change requests for p1")).toBeInTheDocument();
  });
});
