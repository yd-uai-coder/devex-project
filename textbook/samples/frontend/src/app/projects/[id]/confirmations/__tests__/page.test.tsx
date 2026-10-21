// 作成：Phase-98-1
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import ConfirmationsPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/p1/confirmations",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/confirmations/components/ConfirmationsPageContent", () => ({
  ConfirmationsPageContent: ({ projectId }: { projectId: string }) => <div>confirmations for {projectId}</div>,
}));

describe("ConfirmationsPage", () => {
  it("paramsのidをConfirmationsPageContentへ渡し、RequireAuthでガードする", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    const element = await ConfirmationsPage({ params: Promise.resolve({ id: "p1" }) });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("confirmations for p1")).toBeInTheDocument();
  });
});
