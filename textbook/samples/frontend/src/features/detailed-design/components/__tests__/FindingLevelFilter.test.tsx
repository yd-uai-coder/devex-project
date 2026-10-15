// 作成：Phase-57-2
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { FindingLevelFilter } from "../FindingLevelFilter";

// SUT: FindingLevelFilter / ドライバ: render と操作 / スタブ: onChange(親の状態の代わり)。

describe("FindingLevelFilter", () => {
  it("すべて・重要度ごとの件数を出し、押した絞り込みを伝える", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <FindingLevelFilter filter="all" counts={{ critical: 1, major: 2, minor: 0 }} onChange={onChange} />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("button", { name: "すべて(3)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "軽微(0)" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "中程度(2)" }));
    expect(onChange).toHaveBeenCalledWith("major");
  });
});
