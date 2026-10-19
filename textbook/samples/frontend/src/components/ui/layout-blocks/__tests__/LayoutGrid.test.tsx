// 作成：Phase-79(本番確認後の調整)
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { LayoutGrid } from "../LayoutGrid";

function renderGrid(props: Partial<Parameters<typeof LayoutGrid>[0]> = {}) {
  const { container } = render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <LayoutGrid {...props}>
        <span>A</span>
        <span>B</span>
        <span>C</span>
      </LayoutGrid>
    </TamaguiProvider>,
  );
  const grid = screen.getByText("A").closest("[style*='--layout-grid']") as HTMLElement;
  return { container, grid };
}

describe("LayoutGrid", () => {
  it("グリッドの入れ物は素の div で、Tamagui の View のクラスを持たない", () => {
    const { grid } = renderGrid();

    expect(grid.tagName).toBe("DIV");
    // .is_View の display:flex が本番で CSS Module の display:grid に勝つのを防ぐ
    expect(grid.className).not.toContain("is_View");
  });

  it("列数を CSS 変数で渡す(既定は 2 / 4)", () => {
    const { grid } = renderGrid();

    expect(grid.style.getPropertyValue("--layout-grid-mobile-columns")).toBe("2");
    expect(grid.style.getPropertyValue("--layout-grid-desktop-columns")).toBe("4");
  });

  it("columns を渡すとその列数になる", () => {
    const { grid } = renderGrid({ columns: { base: 1, md: 3 } });

    expect(grid.style.getPropertyValue("--layout-grid-mobile-columns")).toBe("1");
    expect(grid.style.getPropertyValue("--layout-grid-desktop-columns")).toBe("3");
  });

  it("子ごとにセルのラッパーを1つ作る", () => {
    const { grid } = renderGrid();

    expect(grid.children).toHaveLength(3);
    expect(grid.children[0]).toHaveTextContent("A");
    expect(grid.children[2]).toHaveTextContent("C");
  });
});
