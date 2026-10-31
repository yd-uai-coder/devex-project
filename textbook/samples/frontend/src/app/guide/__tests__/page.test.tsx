// 作成：Phase-118-1
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import GuidePage, { metadata } from "../page";

vi.mock("@/features/guide/components/GuideIndexContent", () => ({
  GuideIndexContent: () => <div>guide index</div>,
}));

describe("GuidePage", () => {
  it("ログインを求めずに使い方ガイドの目次を出し、題と説明を持つ", () => {
    render(<GuidePage />);

    expect(screen.getByText("guide index")).toBeInTheDocument();
    expect(metadata.title).toBe("使い方ガイド | Devex");
    expect(metadata.description).toContain("使い方");
  });
});
