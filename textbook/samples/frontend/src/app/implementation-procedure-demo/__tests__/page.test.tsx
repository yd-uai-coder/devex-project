// 作成：Phase-25-2
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ImplementationProcedureDemoPage from "../page";

vi.mock("@/features/implementation-procedure/demo/ImplementationProcedureDemoPageContent", () => ({
  ImplementationProcedureDemoPageContent: () => <div>implementation procedure demo</div>,
}));

describe("ImplementationProcedureDemoPage", () => {
  it("ログイン不要でデモの本体を表示する", () => {
    render(<ImplementationProcedureDemoPage />);

    expect(screen.getByText("implementation procedure demo")).toBeInTheDocument();
  });
});
