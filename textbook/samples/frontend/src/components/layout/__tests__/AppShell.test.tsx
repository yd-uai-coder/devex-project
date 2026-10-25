// 作成：Phase-108-1
// SUT: AppShell(client-page の isClientPage・Header の plain を通る)
// ドライバ: React Testing Library
// スタブ: next/navigation の usePathname(開いたページを決める)・@tamagui/next-theme(jsdom で解決できない)
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "../../../../tamagui.config";

let pathname = "/dashboard";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@tamagui/next-theme", () => ({
  useThemeSetting: () => ({ resolvedTheme: "light", toggle: () => {} }),
}));

import { AppShell } from "../AppShell";
import { isClientPage } from "../client-page";

const renderShell = () =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppShell>
        <p>本文</p>
      </AppShell>
    </TamaguiProvider>,
  );

describe("AppShell", () => {
  it("開発者のページは、メニュー・トップへのリンク・フッターを出す", () => {
    pathname = "/dashboard";
    renderShell();

    expect(screen.getByTestId("menu")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Devex" })).toHaveAttribute("href", "/");
    expect(screen.getByText("github")).toBeInTheDocument();
  });

  it("共有リンクのページは、メニュー・開閉ボタン・トップへのリンク・フッターを出さない", () => {
    pathname = "/share/tok-1";
    renderShell();

    expect(screen.getByText("本文")).toBeInTheDocument();
    expect(screen.queryByTestId("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "メニューを開く" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Devex" })).not.toBeInTheDocument();
    expect(screen.queryByText("github")).not.toBeInTheDocument();
  });

  it("共有リンクのページかを、パスの頭で判定する", () => {
    expect(isClientPage("/share/abc")).toBe(true);
    expect(isClientPage("/share")).toBe(false);
    expect(isClientPage("/projects/1")).toBe(false);
    expect(isClientPage(null)).toBe(false);
  });
});
