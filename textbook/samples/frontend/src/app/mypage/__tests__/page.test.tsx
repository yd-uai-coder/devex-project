// 作成：Phase-66-3
// SUT: マイページ(RequireAuth の中にアカウントの節)
// ドライバ: 各テスト(描画)
// スタブ: fetch(stubFetch。GET /users/me)と next/navigation(vi.mock)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { useAuthStore } from "@/components/auth/auth-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import MyPage from "../page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mypage",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe("MyPage", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("ログイン済みならアカウントの節を出す", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });
    stub.queue({ body: { id: "u1", email: "gil@example.com", user_name: "Gil" } });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <MyPage />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("heading", { name: "マイページ" })).toBeInTheDocument();
    expect(await screen.findByText("今のメールアドレス: gil@example.com")).toBeInTheDocument();
  });

  it("未ログインならアカウントを読みに行かない", () => {
    useAuthStore.setState({ accessToken: null, status: "idle", error: null });

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <MyPage />
      </TamaguiProvider>,
    );

    expect(screen.queryByRole("heading", { name: "マイページ" })).not.toBeInTheDocument();
    expect(stub.requests).toHaveLength(0);
  });
});
