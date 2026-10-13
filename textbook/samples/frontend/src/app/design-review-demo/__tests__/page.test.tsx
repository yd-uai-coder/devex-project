// 作成：Phase-51-3
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DesignReviewDemoPage from "../page";

vi.mock("@/features/design-review/demo/DesignReviewDemoPageContent", () => ({
  DesignReviewDemoPageContent: () => <div>design review demo</div>,
}));

describe("DesignReviewDemoPage", () => {
  it("ログイン不要でデモの本体を表示する", () => {
    render(<DesignReviewDemoPage />);

    expect(screen.getByText("design review demo")).toBeInTheDocument();
  });
});
