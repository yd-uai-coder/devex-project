// 作成：Phase-15-7｜更新：Phase-87-4
// 写経レベル: 定型 ── params の受け渡しだけを確かめる。
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import DetailedDesignPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/p1/detailed-design",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock(
  "@/features/detailed-design/components/DetailedDesignPageContent",
  () => ({
    // Phase-87-4：更新
    // DetailedDesignPageContent: ({ projectId }: { projectId: string }) => (
    //   <div>detailed design for {projectId}</div>
    // ↓↓
    DetailedDesignPageContent: ({ projectId, initialStage }: { projectId: string; initialStage?: number }) => (
      <div>
        detailed design for {projectId} at {initialStage ?? "none"}
      </div>
    ),
  }),
);

describe("DetailedDesignPage", () => {
  it("paramsのidをDetailedDesignPageContentへ渡し、RequireAuthでガードする", async () => {
    useAuthStore.setState({
      accessToken: "header.payload.sig",
      status: "success",
      error: null,
    });

    const element = await DetailedDesignPage({
      params: Promise.resolve({ id: "p1" }),
      // Phase-87-4:追記
      searchParams: Promise.resolve({}),
    });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    // Phase-87-4：更新
    // expect(screen.getByText("detailed design for p1")).toBeInTheDocument();
    // ↓↓
    expect(screen.getByText("detailed design for p1 at none")).toBeInTheDocument();
  });

  it("?stage=N を開く段階として渡す(段階で無い値は渡さない)", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    const element = await DetailedDesignPage({
      params: Promise.resolve({ id: "p1" }),
      searchParams: Promise.resolve({ stage: "3" }),
    });
    const ignored = await DetailedDesignPage({
      params: Promise.resolve({ id: "p1" }),
      searchParams: Promise.resolve({ stage: "9" }),
    });

    expect((element.props as { children: { props: { initialStage?: number } } }).children.props.initialStage).toBe(3);
    expect((ignored.props as { children: { props: { initialStage?: number } } }).children.props.initialStage).toBeUndefined();
  });
});
