// 更新：Phase-51-3,60-3,62-2
// Phase-62-2:追記 ── beforeEach・vi(vitest), useAuthStore(@/components/auth/auth-store), stubFetch(@/lib/api/test-utils/fetch-stub)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "../../../../tamagui.config";
import { Menu } from "../Menu";
import { useMenuStore } from "../menu-store";
import { useAuthStore } from "@/components/auth/auth-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

// Phase-62-2:追記
vi.mock("next/navigation", () => ({ usePathname: () => "/somewhere" }));

function renderMenu() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <Menu />
    </TamaguiProvider>,
  );
}

// Phase-62-2:追記
function signedIn() {
  useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });
}

function signedOut() {
  useAuthStore.setState({ accessToken: null, status: "idle", error: null });
}

describe("Menu", () => {
  // Phase-62-2:追記
  let stub: ReturnType<typeof stubFetch>;

  // Phase-62-2:追記
  beforeEach(() => {
    stub = stubFetch();
    signedOut();
  });

  afterEach(() => {
    useMenuStore.setState({ isOpen: false });
    // Phase-62-2:追記
    stub.restore();
  });

  it("starts closed and opens/closes via its own toggle button", async () => {
    const user = userEvent.setup();
    renderMenu();

    const menu = screen.getByTestId("menu");
    expect(menu).toHaveAttribute("data-open", "false");

    await user.click(screen.getByRole("button", { name: "メニューを開く" }));
    expect(menu).toHaveAttribute("data-open", "true");

    await user.click(screen.getByRole("button", { name: "メニューを閉じる" }));
    expect(menu).toHaveAttribute("data-open", "false");
  });

  // Phase-62-2：更新
  // it("renders the Devex group links (MENU_TREE)", async () => {
  // ↓↓
  it("TOP はトップページへのリンクで、CONTENTS と Guide の項目を持つ", async () => {
    const user = userEvent.setup();
    renderMenu();

    // Phase-62-2:追記
    expect(screen.getByRole("link", { name: "TOP" })).toHaveAttribute("href", "/");

    // アコーディオンは現在のpathnameに一致するグループのみ自動展開する仕様のため
    // Phase-62-2：更新
    // // (HierarchicalMenu.tsx参照)、テスト環境では一致するpathnameが無く既定で閉じている。
    // ↓↓
    // (HierarchicalMenu.tsx参照)、一致しないpathnameでは既定で閉じている。
    // 明示的にトリガーをクリックして展開してからリンクを検証する。
    // Phase-62-2：更新
    // await user.click(screen.getByRole("button", { name: "Devex" }));
    //
    // const links = screen.getAllByRole("link");
    // expect(links).toHaveLength(4);
    //
    // expect(screen.getByRole("link", { name: "ダッシュボード" })).toHaveAttribute(
    //   "href",
    //   "/dashboard",
    // );
    // ↓↓
    await user.click(screen.getByRole("button", { name: "CONTENTS" }));
    expect(screen.getByRole("link", { name: "ダッシュボード" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "新規プロジェクト作成" })).toHaveAttribute(
      "href",
      "/projects/new",
    );
    // Phase-62-2：削除(認証の項目は、ログインの状態ごとのテストへ移した)
    // expect(screen.getByRole("link", { name: "ユーザー登録" })).toHaveAttribute(
    //   "href",
    //   "/register",
    // );
    // expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute(
    //   "href",
    //   "/login",
    // );

    // Phase-62-2:追記
    await user.click(screen.getByRole("button", { name: "Guide" }));
    expect(screen.getByRole("link", { name: "作成予定" })).toHaveAttribute("href", "/guide");
  });

  // Phase-62-2:追記
  it("未ログインなら Authentication にログイン・ユーザー登録を出す", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Authentication" }));
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "ユーザー登録" })).toHaveAttribute("href", "/register");
    expect(screen.queryByRole("button", { name: "ログアウト" })).toBeNull();
  });

  // Phase-62-2:追記
  it("ログイン中ならログアウトだけを出し、押すとログアウトしてトップページを読み込み直す", async () => {
    signedIn();
    stub.queue({ status: 204 });
    const assign = vi.fn();
    const originalLocation = window.location;
    // jsdom は画面の遷移(location.assign)を実装していないため差し替える
    Object.defineProperty(window, "location", { configurable: true, value: { assign } });
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "メニューを開く" }));
    await user.click(screen.getByRole("button", { name: "Authentication" }));
    expect(screen.queryByRole("link", { name: "ログイン" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "ログアウト" }));
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
    expect(stub.requests[0].url).toContain("/api/v1/auth/logout");
    // 押したらメニューを閉じる
    expect(screen.getByTestId("menu")).toHaveAttribute("data-open", "false");
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  // Phase-62-2:追記
  it("セッションの復元中は Authentication を出さない", () => {
    useAuthStore.setState({ accessToken: null, status: "loading", error: null });
    renderMenu();

    expect(screen.queryByRole("button", { name: "Authentication" })).toBeNull();
  });

  // Phase-60-3：更新
  // it("開発用のグループに AI 設計レビューデモへのリンクを置く", async () => {
  //   const user = userEvent.setup();
  //   renderMenu();
  //
  //   await user.click(screen.getByRole("button", { name: "開発用" }));
  //
  //   expect(screen.getByRole("link", { name: "AI 設計レビューデモ" })).toHaveAttribute(
  //     "href",
  //     "/design-review-demo",
  //   );
  // });
  // ↓↓
  it("開発用のグループを置かない(デモのページは URL を直接開けば見られる)", () => {
    renderMenu();

    expect(screen.queryByRole("button", { name: "開発用" })).toBeNull();
    expect(screen.queryByRole("link", { name: "AI 設計レビューデモ" })).toBeNull();
  });
});
