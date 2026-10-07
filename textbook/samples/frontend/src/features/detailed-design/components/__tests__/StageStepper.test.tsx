// 作成：Phase-15-7｜更新：Phase-16-6,27-3
// 写経レベル: 定型
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { StageStepper } from "../StageStepper";
import { makeStages } from "../../test-utils/stageFixtures";

describe("StageStepper", () => {
  // Phase-27-3：更新
  // it("段階1〜7を状態つきで並べ、選んでいる段階を示す", () => {
  // ↓↓
  it("段階1〜8を状態つきで並べ、選んでいる段階を示す", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <StageStepper
          stages={makeStages({
            // Phase-16-6：更新
            // 1: { state: "approved" },
            // ↓↓
            1: { state: "regenerated" },
            2: { state: "outdated" },
          })}
          selectedStage={2}
          onSelect={vi.fn()}
        />
      </TamaguiProvider>,
    );

    // Phase-27-3：更新
    // expect(screen.getAllByRole("button")).toHaveLength(7);
    // ↓↓
    expect(screen.getAllByRole("button")).toHaveLength(8);
    expect(
      // Phase-16-6：更新
      // screen.getByRole("button", { name: "段階1 機能一覧(承認済み)" }),
      // ↓↓
      // 作り直した段階(Phase 16)
      screen.getByRole("button", { name: "段階1 機能一覧(再生成済(未承認))" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "段階2 データフロー(古い)" }),
    ).toHaveAttribute("aria-current", "step");
  });

  it("段階を押すとonSelectを呼ぶ", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <StageStepper
          stages={makeStages()}
          selectedStage={1}
          onSelect={onSelect}
        />
      </TamaguiProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: "段階3 データモデル(未着手)" }),
    );

    expect(onSelect).toHaveBeenCalledWith(3);
  });
});
