// 作成：Phase-88-3
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import BaselineDetailPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/p1/baselines/3",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/baselines/components/BaselineDetailContent", () => ({
  BaselineDetailContent: ({ projectId, number }: { projectId: string; number: number }) => (
    <div>
      baseline {typeof number} {number} for {projectId}
    </div>
  ),
}));

describe("BaselineDetailPage", () => {
  it("paramsのidと番号(数にして)をBaselineDetailContentへ渡し、RequireAuthでガードする", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    const element = await BaselineDetailPage({ params: Promise.resolve({ id: "p1", number: "3" }) });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("baseline number 3 for p1")).toBeInTheDocument();
  });
});
