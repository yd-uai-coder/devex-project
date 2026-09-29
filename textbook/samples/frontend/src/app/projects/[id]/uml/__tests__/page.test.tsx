// 作成：Phase-7-3
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import ProjectUmlPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/p1/uml",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/uml/components/UmlPageContent", () => ({
  UmlPageContent: ({ projectId }: { projectId: string }) => <div>uml for {projectId}</div>,
}));

describe("ProjectUmlPage", () => {
  it("paramsのidをUmlPageContentへ渡し、RequireAuthでガードする", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    const element = await ProjectUmlPage({ params: Promise.resolve({ id: "p1" }) });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("uml for p1")).toBeInTheDocument();
  });
});
