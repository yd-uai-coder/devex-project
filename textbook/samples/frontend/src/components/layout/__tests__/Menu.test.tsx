// 更新：Phase-51-3,60-3
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "../../../../tamagui.config";
import { Menu } from "../Menu";
import { useMenuStore } from "../menu-store";

function renderMenu() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <Menu />
    </TamaguiProvider>,
  );
}

describe("Menu", () => {
  afterEach(() => {
    useMenuStore.setState({ isOpen: false });
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

  it("renders the Devex group links (MENU_TREE)", async () => {
    const user = userEvent.setup();
    renderMenu();

    // アコーディオンは現在のpathnameに一致するグループのみ自動展開する仕様のため
    // (HierarchicalMenu.tsx参照)、テスト環境では一致するpathnameが無く既定で閉じている。
    // 明示的にトリガーをクリックして展開してからリンクを検証する。
    await user.click(screen.getByRole("button", { name: "Devex" }));

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);

    expect(screen.getByRole("link", { name: "ダッシュボード" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "新規プロジェクト作成" })).toHaveAttribute(
      "href",
      "/projects/new",
    );
    expect(screen.getByRole("link", { name: "ユーザー登録" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute(
      "href",
      "/login",
    );
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
