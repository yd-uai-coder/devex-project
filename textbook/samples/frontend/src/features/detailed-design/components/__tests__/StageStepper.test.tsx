// 作成：Phase-15-7
// 写経レベル: 定型
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { StageStepper } from "../StageStepper";
import { makeStages } from "../../test-utils/stageFixtures";

describe("StageStepper", () => {
  it("段階1〜7を状態つきで並べ、選んでいる段階を示す", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <StageStepper
          stages={makeStages({
            1: { state: "approved" },
            2: { state: "outdated" },
          })}
          selectedStage={2}
          onSelect={vi.fn()}
        />
      </TamaguiProvider>,
    );

    expect(screen.getAllByRole("button")).toHaveLength(7);
    expect(
      screen.getByRole("button", { name: "段階1 機能一覧(承認済み)" }),
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
