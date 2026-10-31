// 作成：Phase-118-1
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { PRODUCT_FLOW } from "../../guide-flow";
import { renderGuide } from "../../test-utils/renderGuide";
import { GuideFlowDiagram } from "../GuideFlowDiagram";

describe("GuideFlowDiagram", () => {
  it("全体の流れの各段を順に並べ、使い方のページへリンクする", () => {
    renderGuide(<GuideFlowDiagram />);

    const list = screen.getByRole("list", { name: "Devex の全体の流れ" });
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(PRODUCT_FLOW.length);
    expect(links[0]).toHaveTextContent("ヒアリング");
    expect(links[0]).toHaveAttribute("href", "/guide/hearing");
    expect(links.at(-1)).toHaveTextContent("反映・再検証");
    expect(links[6]).toHaveTextContent("クライアントと合意");
    expect(links[6]).toHaveAttribute("href", "/guide/for-clients");
  });
});
