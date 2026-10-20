// 作成：Phase-87-3
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import ChangeRequestDetailPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/p1/change-requests/3",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/change-requests/components/ChangeRequestDetailContent", () => ({
  ChangeRequestDetailContent: ({ projectId, number }: { projectId: string; number: number }) => (
    <div>
      change request {typeof number} {number} for {projectId}
    </div>
  ),
}));

describe("ChangeRequestDetailPage", () => {
  it("paramsのidと番号(数にして)をChangeRequestDetailContentへ渡し、RequireAuthでガードする", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    const element = await ChangeRequestDetailPage({ params: Promise.resolve({ id: "p1", number: "3" }) });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("change request number 3 for p1")).toBeInTheDocument();
  });
});
