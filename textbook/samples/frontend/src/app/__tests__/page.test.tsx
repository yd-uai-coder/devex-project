// 作成：Phase-62-2
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import Home from "../page";
import { useAuthStore } from "@/components/auth/auth-store";


describe("Home(トップページ)", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, status: "idle", error: null });
  });

  it("TOP 以外のグループをカードにする(自分へのリンクは出さない)", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Home />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("heading", { name: "CONTENTS" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Authentication" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Guide" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "TOP" })).toBeNull();
    expect(screen.queryByRole("link", { name: "TOP" })).toBeNull();
  });
});
