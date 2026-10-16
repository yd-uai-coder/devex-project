// 作成：Phase-62-1
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "../../../../tamagui.config";

// @tamagui/next-theme は next/script を読むため jsdom で解決できない(テーマの切り替えボタンが使う)
vi.mock("@tamagui/next-theme", () => ({
  useThemeSetting: () => ({ resolvedTheme: "light", toggle: () => {} }),
}));

import { Header } from "../Header";

describe("Header", () => {
  it("タイトルはトップページへのリンク", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Header />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("link", { name: "Devex" })).toHaveAttribute("href", "/");
  });
});
