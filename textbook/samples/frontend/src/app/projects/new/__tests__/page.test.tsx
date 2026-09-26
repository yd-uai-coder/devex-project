// 作成：Phase-3-4
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import NewProjectPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/new",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("NewProjectPage", () => {
  it("ログイン済みならヒアリング入力フォームを表示する", () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <NewProjectPage />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("button", { name: "ヒアリングを始める" })).toBeInTheDocument();
  });
});
