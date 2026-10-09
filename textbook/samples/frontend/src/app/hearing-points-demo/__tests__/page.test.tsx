// 作成：Phase-33-3
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HearingPointsDemoPage from "../page";

vi.mock("@/features/hearing-points/demo/HearingPointsDemoPageContent", () => ({
  HearingPointsDemoPageContent: () => <div>hearing points demo</div>,
}));

describe("HearingPointsDemoPage", () => {
  it("ログイン不要でデモの本体を表示する", () => {
    render(<HearingPointsDemoPage />);

    expect(screen.getByText("hearing points demo")).toBeInTheDocument();
  });
});
