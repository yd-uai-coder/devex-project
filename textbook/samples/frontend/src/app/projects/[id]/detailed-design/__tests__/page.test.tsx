// 作成：Phase-15-7
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
    DetailedDesignPageContent: ({ projectId }: { projectId: string }) => (
      <div>detailed design for {projectId}</div>
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
    });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {element}
      </TamaguiProvider>,
    );

    expect(screen.getByText("detailed design for p1")).toBeInTheDocument();
  });
});
