// 作成：Phase-62-2｜更新：Phase-66-3,118-1
// Phase-118-1:追記 ── @/features/guide/guide-flow.GUIDE_INDEX_HREF, @/features/guide/guide-flow.GUIDE_PAGES, @/features/guide/guide-flow.guideHref
import { describe, expect, it } from "vitest";
import { GUIDE_INDEX_HREF, GUIDE_PAGES, guideHref } from "@/features/guide/guide-flow";
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

  // Phase-118-1:追記
  it("Guide は使い方ガイドの目次と、ガイドのページへのリンク", () => {
    const guide = MENU_TREE.find((group) => group.label === "Guide");
    const hrefs = guide?.children.map((item) => (item.kind === "link" ? item.href : null));
    expect(hrefs?.[0]).toBe(GUIDE_INDEX_HREF);
    const pageHrefs = Object.values(GUIDE_PAGES).map((page) => guideHref(page.slug));
    expect(hrefs?.slice(1).every((href) => href !== null && pageHrefs.includes(href))).toBe(true);
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
      // Phase-118-1：更新
      // ["Guide", ["作成予定"]],
      // ↓↓
      ["Guide", ["使い方ガイド(目次)", "はじめに", "ヒアリング", "合意と変更管理", "クライアントの方へ"]],
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
