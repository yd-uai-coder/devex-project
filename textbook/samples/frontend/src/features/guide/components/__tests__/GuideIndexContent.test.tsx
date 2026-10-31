// 作成：Phase-118-1
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { GUIDE_FLOW } from "../../guide-flow";
import { renderGuide } from "../../test-utils/renderGuide";
import { GuideIndexContent } from "../GuideIndexContent";

describe("GuideIndexContent", () => {
  it("目的別の入口・全体の流れ図・流れの順のページの一覧を出す", () => {
    renderGuide(<GuideIndexContent />);

    expect(screen.getByRole("heading", { level: 1, name: "使い方ガイド" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "目的から探す" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Devex の全体の流れ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "クライアントの方へ →" })).toHaveAttribute(
      "href",
      "/guide/for-clients",
    );
    expect(screen.getByRole("link", { name: "1. はじめに" })).toHaveAttribute("href", "/guide/getting-started");
    expect(screen.getByRole("link", { name: `${GUIDE_FLOW.length}. 資料の取り込み` })).toHaveAttribute(
      "href",
      "/guide/materials",
    );
    expect(screen.getByRole("link", { name: "用語集とよくある質問" })).toHaveAttribute("href", "/guide/glossary");
  });
});
