// 作成：Phase-3-2
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import LoginPage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("LoginPage", () => {
  it("ログインフォームと登録画面へのリンクを表示する", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <LoginPage />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("button", { name: "ログイン" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "こちらから登録" })).toHaveAttribute("href", "/register");
  });
});
