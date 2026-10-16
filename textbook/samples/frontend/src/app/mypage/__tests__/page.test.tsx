// 作成：Phase-66-3｜更新：Phase-67-4,67(完了後の調整)
// Phase-67-4：更新
// // SUT: マイページ(RequireAuth の中にアカウントの節)
// ↓↓
// Phase-67(完了後の調整)：更新
// // SUT: マイページ(RequireAuth の中にアカウント・モデル・API キーの節)
// // ドライバ: 各テスト(描画)
// ↓↓
// SUT: マイページ(RequireAuth の中に、アカウント・モデル・API キーの節を排他のアコーディオンで並べる)
// ドライバ: 各テスト(描画と見出しの操作)
// Phase-67-4：更新
// // スタブ: fetch(stubFetch。GET /users/me)と next/navigation(vi.mock)
// ↓↓
// スタブ: fetch(stubFetch。GET /users/me・カタログ・モデル・キーの一覧)と next/navigation(vi.mock)
// Phase-67-4:追記 ── @/features/mypage/test-utils/llmFixtures
// Phase-67(完了後の調整):追記 ── @testing-library/user-event
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { useAuthStore } from "@/components/auth/auth-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { CATALOG, DEFAULT_SETTINGS } from "@/features/mypage/test-utils/llmFixtures";
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

  // Phase-67-4：更新
  // it("ログイン済みならアカウントの節を出す", async () => {
  // ↓↓
  // Phase-67(完了後の調整)：更新
  // it("ログイン済みならアカウント・モデル・API キーの節を出す", async () => {
  // ↓↓
  it("ログイン済みなら初めはアカウントだけを開く。1つを開くとほかが閉じ、開いた節を読む", async () => {
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });
    stub.queue({ body: { id: "u1", email: "gil@example.com", user_name: "Gil" } });
    // Phase-67-4:追記
    // Phase-67(完了後の調整)：更新
    // stub.queue({ body: CATALOG });
    // stub.queue({ body: { settings: DEFAULT_SETTINGS } });
    // stub.queue({ body: { encryption_available: true, keys: [] } });
    // ↓↓
    const user = userEvent.setup();

    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <MyPage />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("heading", { name: "マイページ" })).toBeInTheDocument();
    expect(await screen.findByText("今のメールアドレス: gil@example.com")).toBeInTheDocument();
    // Phase-67-4:追記
    // Phase-67(完了後の調整):追記
    const account = screen.getByRole("button", { name: "アカウント" });
    const models = screen.getByRole("button", { name: "モデル" });
    const keys = screen.getByRole("button", { name: "API キー" });
    expect(account).toHaveAttribute("aria-expanded", "true");
    expect(models).toHaveAttribute("aria-expanded", "false");
    // 閉じた節は読まない
    expect(stub.requests).toHaveLength(1);

    stub.queue({ body: CATALOG });
    stub.queue({ body: { settings: DEFAULT_SETTINGS } });
    await user.click(models);
    expect(models).toHaveAttribute("aria-expanded", "true");
    expect(account).toHaveAttribute("aria-expanded", "false");
    expect(await screen.findByRole("button", { name: "モデルを保存する" })).toBeInTheDocument();

    // Phase-67(完了後の調整):追記
    stub.queue({ body: { encryption_available: true, keys: [] } });
    await user.click(keys);
    expect(keys).toHaveAttribute("aria-expanded", "true");
    expect(models).toHaveAttribute("aria-expanded", "false");
    expect(await screen.findByRole("button", { name: "Claude のキーを保存する" })).toBeInTheDocument();

    // Phase-67(完了後の調整):追記
    // 開いた節をもう一度押すと、すべて閉じる
    await user.click(keys);
    expect(keys).toHaveAttribute("aria-expanded", "false");
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
