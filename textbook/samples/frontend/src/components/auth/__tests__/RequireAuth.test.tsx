// 作成：Phase-3-1
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { RequireAuth } from "../RequireAuth";
import { useAuthStore } from "../auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/protected",
  useRouter: () => ({ push: vi.fn() }),
}));

function renderGuarded() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <RequireAuth>
        <div>secret content</div>
      </RequireAuth>
    </TamaguiProvider>,
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, status: "idle", error: null });
  });

  it("statusがloadingの間は何も表示しない(復元完了前のダイアログのちらつきを防ぐ)", () => {
    useAuthStore.setState({ status: "loading" });

    renderGuarded();

    expect(screen.queryByText("ログインが必要です")).not.toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("復元後も未ログインならログイン必須ダイアログを表示する", () => {
    useAuthStore.setState({ status: "idle", accessToken: null });

    renderGuarded();

    expect(screen.getByText("ログインが必要です")).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("ログイン済みならchildrenを表示する", () => {
    useAuthStore.setState({ status: "success", accessToken: "header.payload.sig" });

    renderGuarded();

    expect(screen.getByText("secret content")).toBeInTheDocument();
  });
});
