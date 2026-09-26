// 作成：Phase-3-2
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import RegisterPage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("RegisterPage", () => {
  it("登録フォームとログイン画面へのリンクを表示する", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <RegisterPage />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("button", { name: "登録する" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "こちらからログイン" })).toHaveAttribute("href", "/login");
  });
});
