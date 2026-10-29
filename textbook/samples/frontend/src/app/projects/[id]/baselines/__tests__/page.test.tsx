// 作成：Phase-88-3｜更新：Phase-116-4
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
  // Phase-116-4：更新
  // BaselinesPageContent: ({ projectId }: { projectId: string }) => <div>baselines for {projectId}</div>,
  // ↓↓
  BaselinesPageContent: ({ projectId, initialCreate }: { projectId: string; initialCreate: boolean }) => (
    <div>
      baselines for {projectId}
      {initialCreate ? " (create)" : ""}
    </div>
  ),
}));

describe("BaselinesPage", () => {
  it("paramsのidをBaselinesPageContentへ渡し、RequireAuthでガードする", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    // Phase-116-4：更新
    // const element = await BaselinesPage({ params: Promise.resolve({ id: "p1" }) });
    // ↓↓
    const element = await BaselinesPage({ params: Promise.resolve({ id: "p1" }), searchParams: Promise.resolve({}) });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("baselines for p1")).toBeInTheDocument();
  });

  // Phase-116-4:追記
  it("?create=1 なら作成のフォームを開いて始める", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    const element = await BaselinesPage({ params: Promise.resolve({ id: "p1" }), searchParams: Promise.resolve({ create: "1" }) });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("baselines for p1 (create)")).toBeInTheDocument();
  });
});
