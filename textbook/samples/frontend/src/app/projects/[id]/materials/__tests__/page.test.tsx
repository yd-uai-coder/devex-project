// 作成：Phase-116-2
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import MaterialsPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/p1/materials",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/materials/components/MaterialsPageContent", () => ({
  MaterialsPageContent: ({ projectId }: { projectId: string }) => <div>materials for {projectId}</div>,
}));

describe("MaterialsPage", () => {
  it("paramsのidをMaterialsPageContentへ渡し、RequireAuthでガードする", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    const element = await MaterialsPage({ params: Promise.resolve({ id: "p1" }) });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("materials for p1")).toBeInTheDocument();
  });
});
