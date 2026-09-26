// 作成：Phase-3-6
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import ProjectDocumentsPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/p1/documents",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/documents/components/DocumentsPageContent", () => ({
  DocumentsPageContent: ({ projectId }: { projectId: string }) => <div>documents for {projectId}</div>,
}));

describe("ProjectDocumentsPage", () => {
  it("paramsのidをDocumentsPageContentへ渡し、RequireAuthでガードする", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    const element = await ProjectDocumentsPage({ params: Promise.resolve({ id: "p1" }) });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("documents for p1")).toBeInTheDocument();
  });
});
