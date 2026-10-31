// 作成：Phase-118-2
import { beforeEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { useAuthStore } from "@/components/auth/auth-store";
import { GUIDE_FEATURES } from "@/features/guide/guide-flow";
import { renderGuide } from "@/features/guide/test-utils/renderGuide";
import { TOP_CATCH, TOP_PROBLEMS } from "../../top-content";
import { TopPageContent } from "../TopPageContent";

describe("TopPageContent", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, status: "idle", error: null });
  });

  it("キャッチと8つの節を出す", () => {
    renderGuide(<TopPageContent />);

    expect(screen.getByRole("heading", { level: 1, name: TOP_CATCH })).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual([
      "こんな悩みに",
      "全体の流れ",
      "できること",
      "2つのモード",
      "はじめるまで4ステップ",
      "大切にしていること",
      "このアプリについて",
    ]);
    expect(screen.getByText(TOP_PROBLEMS[0].problem)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Devex の全体の流れ" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "詳細設計モード" })).toBeInTheDocument();
  });

  it("未ログインなら「はじめる」は登録へ、「使い方を見る」は目次へ", () => {
    renderGuide(<TopPageContent />);

    expect(screen.getByRole("link", { name: "はじめる" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "使い方を見る" })).toHaveAttribute("href", "/guide");
  });

  it("ログイン中なら「はじめる」はダッシュボードへ", () => {
    useAuthStore.setState({ accessToken: "token", status: "idle", error: null });
    renderGuide(<TopPageContent />);

    expect(screen.getByRole("link", { name: "はじめる" })).toHaveAttribute("href", "/dashboard");
  });

  it("機能カードごとに、使い方のページへのリンクを出す", () => {
    renderGuide(<TopPageContent />);

    const section = screen.getByRole("heading", { name: "できること" }).closest("section");
    expect(section).not.toBeNull();
    const links = within(section as HTMLElement).getAllByRole("link");
    expect(links).toHaveLength(GUIDE_FEATURES.length);
    expect(screen.getByRole("link", { name: "合意と変更管理の使い方" })).toHaveAttribute("href", "/guide/agreement");
    expect(screen.getByRole("link", { name: "devex-ui" })).toHaveAttribute("href", "https://github.com/yd-uai-coder/devex-ui");
  });
});
