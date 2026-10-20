// 作成：Phase-88(完了後の調整)
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import NewChangeRequestPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/p1/baselines/3/change-requests/new",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/change-requests/components/ChangeRequestCreateContent", () => ({
  ChangeRequestCreateContent: ({ projectId, baselineNumber }: { projectId: string; baselineNumber: number }) => (
    <div>
      new on baseline {typeof baselineNumber} {baselineNumber} for {projectId}
    </div>
  ),
}));

describe("NewChangeRequestPage", () => {
  it("paramsのidと版の番号(数にして)をChangeRequestCreateContentへ渡し、RequireAuthでガードする", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    const element = await NewChangeRequestPage({ params: Promise.resolve({ id: "p1", number: "3" }) });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("new on baseline number 3 for p1")).toBeInTheDocument();
  });
});
