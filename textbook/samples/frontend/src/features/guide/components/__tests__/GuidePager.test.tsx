// 作成：Phase-118-1｜更新：Phase-118(完了後の調整2)
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderGuide } from "../../test-utils/renderGuide";
import { GuidePager } from "../GuidePager";

describe("GuidePager", () => {
  it("流れの順の前へ / 次へと、あわせて読むページ・目次へのリンクを出す", () => {
    renderGuide(<GuidePager current="hearing" />);

    expect(screen.getByRole("link", { name: /^← 前へ/ })).toHaveAttribute("href", "/guide/projects");
    expect(screen.getByRole("link", { name: /^次へ/ })).toHaveAttribute("href", "/guide/documents");
    expect(screen.getByRole("link", { name: "合意と変更管理" })).toHaveAttribute("href", "/guide/agreement");
    expect(screen.getByRole("link", { name: "目次へ戻る" })).toHaveAttribute("href", "/guide");
  });

  it("最初の段には前へを出さない", () => {
    renderGuide(<GuidePager current="getting-started" />);

    expect(screen.queryByRole("link", { name: /^← 前へ/ })).toBeNull();
    // Phase-118(完了後の調整2)：更新
    // expect(screen.getByRole("link", { name: /^次へ/ })).toHaveAttribute("href", "/guide/projects");
    // ↓↓
    expect(screen.getByRole("link", { name: /^次へ/ })).toHaveAttribute("href", "/guide/modes");
  });
});
