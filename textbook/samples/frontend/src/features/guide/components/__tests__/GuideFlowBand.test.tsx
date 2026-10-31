// 作成：Phase-118-1｜更新：Phase-118(完了後の調整2)
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GUIDE_FLOW } from "../../guide-flow";
import { renderGuide } from "../../test-utils/renderGuide";
import { GuideFlowBand } from "../GuideFlowBand";

describe("GuideFlowBand", () => {
  it("流れの全段を並べ、今のページの段だけを aria-current で示す", () => {
    renderGuide(<GuideFlowBand current="hearing" />);

    const nav = screen.getByRole("navigation", { name: "使い方の流れ" });
    expect(nav.querySelectorAll("li")).toHaveLength(GUIDE_FLOW.length);
    expect(screen.getByRole("link", { name: /ヒアリング/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /はじめに/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /はじめに/ })).toHaveAttribute("href", "/guide/getting-started");
  });

  it("たたんだときの1行は「段 N / 全 M: 名前」で、押すと開く", async () => {
    const user = userEvent.setup();
    renderGuide(<GuideFlowBand current="documents" />);

    // Phase-118(完了後の調整2)：更新
    // const toggle = screen.getByRole("button", { name: `段 4 / 全 ${GUIDE_FLOW.length}: 文書` });
    // ↓↓
    const toggle = screen.getByRole("button", { name: `段 5 / 全 ${GUIDE_FLOW.length}: 文書` });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation")).toHaveAttribute("data-open", "true");
  });

  it("流れの外のページは分岐元の段を印にし、どの段も今のページにしない", () => {
    renderGuide(<GuideFlowBand current="for-clients" />);

    const agreement = screen.getByRole("link", { name: /合意と変更/ });
    expect(agreement).toHaveAttribute("data-branch", "true");
    expect(agreement).not.toHaveAttribute("aria-current");
  });
});
