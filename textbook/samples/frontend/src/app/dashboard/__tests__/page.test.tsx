// 作成：Phase-3-3
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import DashboardPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";
import { useDashboardStore } from "@/features/dashboard/dashboard-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("DashboardPage", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });
    useDashboardStore.setState({ projects: [], status: "idle", error: null, fetchedAt: null });
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("ログイン済みなら新規プロジェクト作成リンクとプロジェクト一覧を表示する", async () => {
    stub.queue({ status: 200, body: [] });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <DashboardPage />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("link", { name: "新規プロジェクトを作成" })).toHaveAttribute(
      "href",
      "/projects/new",
    );
    expect(await screen.findByText(/まだプロジェクトがありません/)).toBeInTheDocument();
  });
});
