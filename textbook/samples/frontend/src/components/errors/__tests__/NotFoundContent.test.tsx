// 作成：Phase-62-2
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "../../../../tamagui.config";
import { NotFoundContent } from "../NotFoundContent";
import { useAuthStore } from "@/components/auth/auth-store";


function renderNotFound() {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <NotFoundContent />
    </TamaguiProvider>,
  );
}

describe("NotFoundContent", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, status: "idle", error: null });
  });

  it("TOP は見出しをトップページへのリンクにし、ほかのグループの項目を並べる", () => {
    renderNotFound();

    expect(screen.getByRole("link", { name: "TOP" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "ダッシュボード" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute("href", "/login");
  });

  it("ログイン中はログアウトを出し、ログイン・ユーザー登録を出さない", () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });
    renderNotFound();

    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ログイン" })).toBeNull();
  });
});
