// 作成：Phase-62-2｜更新：Phase-118-2
// Phase-118-2:追記 ── vitest.vi, ../page.metadata
// Phase-118-2：削除 ── vitest.beforeEach, tamagui.TamaguiProvider, @/tamagui.config.tamaguiConfig, @/components/auth/auth-store.useAuthStore
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Home, { metadata } from "../page";

// Phase-118-2:追記
vi.mock("@/features/top/components/TopPageContent", () => ({
  TopPageContent: () => <div>top content</div>,
}));

describe("Home(トップページ)", () => {
  // Phase-118-2：更新
  // beforeEach(() => {
  //   useAuthStore.setState({ accessToken: null, status: "idle", error: null });
  // });
  // ↓↓
  it("ログインを求めずに TOP の本文を出し、題と説明を持つ", () => {
    render(<Home />);

    // Phase-118-2：更新
    // it("TOP 以外のグループをカードにする(自分へのリンクは出さない)", () => {
    // render(
    //   <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
    //     <Home />
    //   </TamaguiProvider>,
    // );
    //
    // expect(screen.getByRole("heading", { name: "CONTENTS" })).toBeInTheDocument();
    // expect(screen.getByRole("heading", { name: "Authentication" })).toBeInTheDocument();
    // expect(screen.getByRole("heading", { name: "Guide" })).toBeInTheDocument();
    // expect(screen.queryByRole("heading", { name: "TOP" })).toBeNull();
    // expect(screen.queryByRole("link", { name: "TOP" })).toBeNull();
    // ↓↓
    expect(screen.getByText("top content")).toBeInTheDocument();
    expect(String(metadata.title)).toContain("Devex");
    expect(metadata.description).toContain("合意");
  });
});
