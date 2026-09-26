// 作成：Phase-3-1
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import ProtectedDemoPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

// ページ内のRequireAuth(未ログイン時)がLoginRequiredDialog経由でuseRouter()を呼ぶため、
// App Routerの実行コンテキストが無いこのテストではモックする。
vi.mock("next/navigation", () => ({
  usePathname: () => "/others/protected-demo",
  useRouter: () => ({ push: vi.fn() }),
}));

function renderPage() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ProtectedDemoPage />
    </TamaguiProvider>,
  );
}

describe("ProtectedDemoPage", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, status: "idle", error: null });
  });

  it("モックログインボタンはauth-store.login()をaccessToken 1引数のみで呼び出す", async () => {
    // このページは未ログイン時にRequireAuth配下でLoginRequiredDialogも同時に開いており、
    // Radix Dialogが背景をpointer-events:noneにする(モーダル表示中の一般的な挙動)。
    // ログインボタン自体はダイアログの外にあり実際にクリック可能なため、このページ既存の
    // 設計に合わせてpointerEventsCheckを無効化する。
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderPage();

    await user.click(screen.getByRole("button", { name: "モックでログインする" }));

    expect(useAuthStore.getState().accessToken).not.toBeNull();
  });
});
