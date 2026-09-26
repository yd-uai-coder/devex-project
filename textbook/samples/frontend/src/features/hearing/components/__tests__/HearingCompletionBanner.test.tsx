// 作成：Phase-3-5
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { HearingCompletionBanner } from "../HearingCompletionBanner";

function renderBanner(overrides: { approving?: boolean; onApprove?: () => void } = {}) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <HearingCompletionBanner
        completion={{ is_sufficient: true, summary: "要約テキスト", missing_points: [] }}
        onApprove={overrides.onApprove ?? vi.fn()}
        approving={overrides.approving ?? false}
      />
    </TamaguiProvider>,
  );
}

describe("HearingCompletionBanner", () => {
  it("is_sufficient=falseなら何も表示しない", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <HearingCompletionBanner
          completion={{ is_sufficient: false, summary: "", missing_points: ["x"] }}
          onApprove={vi.fn()}
          approving={false}
        />
      </TamaguiProvider>,
    );

    expect(screen.queryByText("ヒアリング内容の確認")).not.toBeInTheDocument();
  });

  it("is_sufficient=trueなら要約とボタンを表示する", () => {
    renderBanner();

    expect(screen.getByText("要約テキスト")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この内容で設計書を生成する" })).toBeInTheDocument();
  });

  it("ボタン押下でonApproveを呼ぶ", async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    renderBanner({ onApprove });

    await user.click(screen.getByRole("button", { name: "この内容で設計書を生成する" }));

    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("approving=trueならボタンが無効化され文言が変わる", () => {
    renderBanner({ approving: true });

    expect(screen.getByRole("button", { name: "生成を開始しています..." })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
