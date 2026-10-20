// 作成：Phase-88-3
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import BaselinesPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/p1/baselines",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/baselines/components/BaselinesPageContent", () => ({
  BaselinesPageContent: ({ projectId }: { projectId: string }) => <div>baselines for {projectId}</div>,
}));

describe("BaselinesPage", () => {
  it("paramsのidをBaselinesPageContentへ渡し、RequireAuthでガードする", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    const element = await BaselinesPage({ params: Promise.resolve({ id: "p1" }) });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("baselines for p1")).toBeInTheDocument();
  });
});
