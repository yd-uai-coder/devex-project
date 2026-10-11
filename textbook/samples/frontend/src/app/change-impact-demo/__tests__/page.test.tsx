// 作成：Phase-41-3
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ChangeImpactDemoPage from "../page";

vi.mock("@/features/change-impact/demo/ChangeImpactDemoPageContent", () => ({
  ChangeImpactDemoPageContent: () => <div>change impact demo</div>,
}));

describe("ChangeImpactDemoPage", () => {
  it("ログイン不要でデモの本体を表示する", () => {
    render(<ChangeImpactDemoPage />);

    expect(screen.getByText("change impact demo")).toBeInTheDocument();
  });
});
