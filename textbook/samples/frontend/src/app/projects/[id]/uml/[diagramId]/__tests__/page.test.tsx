// 作成：Phase-11-5
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import ProjectUmlDiagramPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/p1/uml/d1",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/uml/components/UmlDiagramPageContent", () => ({
  UmlDiagramPageContent: ({ projectId, diagramId }: { projectId: string; diagramId: string }) => (
    <div>{`diagram ${diagramId} of ${projectId}`}</div>
  ),
}));

describe("ProjectUmlDiagramPage", () => {
  it("params の id と diagramId を UmlDiagramPageContent へ渡し、RequireAuth でガードする", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    const element = await ProjectUmlDiagramPage({
      params: Promise.resolve({ id: "p1", diagramId: "d1" }),
    });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("diagram d1 of p1")).toBeInTheDocument();
  });
});
