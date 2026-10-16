// 作成：Phase-62-2｜更新：Phase-66-3
import { describe, expect, it } from "vitest";
import { MENU_TREE, menuItemKey, visibleMenuTree, type MenuGroup } from "../menu-tree";

function labels(tree: MenuGroup[]) {
  return tree.map((group) => [group.label, group.children.map((item) => item.label)]);
}

describe("MENU_TREE", () => {
  it("TOP / CONTENTS / Authentication / Guide の順に並ぶ", () => {
    expect(MENU_TREE.map((group) => group.label)).toEqual(["TOP", "CONTENTS", "Authentication", "Guide"]);
    expect(MENU_TREE[0]).toEqual({ label: "TOP", href: "/", children: [] });
  });

  // Phase-66-3:追記
  it("CONTENTS の最後にマイページ(/mypage)がある", () => {
    const contents = MENU_TREE.find((group) => group.label === "CONTENTS");
    expect(contents?.children.at(-1)).toEqual({ kind: "link", label: "マイページ", href: "/mypage" });
  });
});

describe("visibleMenuTree", () => {
  it("未ログインならログイン・ユーザー登録を出し、ログアウトを出さない", () => {
    expect(labels(visibleMenuTree(MENU_TREE, "guest"))).toEqual([
      ["TOP", []],
      // Phase-66-3：更新
      // ["CONTENTS", ["ダッシュボード", "新規プロジェクト作成"]],
      // ↓↓
      ["CONTENTS", ["ダッシュボード", "新規プロジェクト作成", "マイページ"]],
      ["Authentication", ["ログイン", "ユーザー登録"]],
      ["Guide", ["作成予定"]],
    ]);
  });

  it("ログイン中ならログアウトだけを出す", () => {
    const auth = visibleMenuTree(MENU_TREE, "user").find((group) => group.label === "Authentication");
    expect(auth?.children.map((item) => item.label)).toEqual(["ログアウト"]);
  });

  it("状態の確認中は認証の項目を出さず、空になったグループを除く(リンクのグループは残す)", () => {
    expect(visibleMenuTree(MENU_TREE, null).map((group) => group.label)).toEqual(["TOP", "CONTENTS", "Guide"]);
  });
});

describe("menuItemKey", () => {
  it("link は href、action は処理の名前を key にする", () => {
    expect(menuItemKey({ kind: "link", label: "ダッシュボード", href: "/dashboard" })).toBe("/dashboard");
    expect(menuItemKey({ kind: "action", label: "ログアウト", action: "logout" })).toBe("action:logout");
  });
});
