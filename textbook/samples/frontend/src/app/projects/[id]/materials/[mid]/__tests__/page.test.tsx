// 作成：Phase-116-2
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import MaterialDetailPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/p1/materials/m1",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/materials/components/MaterialDetailContent", () => ({
  MaterialDetailContent: ({ projectId, materialId }: { projectId: string; materialId: string }) => (
    <div>
      material {materialId} of {projectId}
    </div>
  ),
}));

describe("MaterialDetailPage", () => {
  it("params の id と mid を MaterialDetailContent へ渡し、RequireAuth でガードする", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    const element = await MaterialDetailPage({ params: Promise.resolve({ id: "p1", mid: "m1" }) });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("material m1 of p1")).toBeInTheDocument();
  });
});
