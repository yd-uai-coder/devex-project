// 作成：Phase-15-7｜更新：Phase-16-6
// 写経レベル: コア ── 状態ごとのボタンと表示。
// Phase-16-6:追記 ── ../../test-utils/stageFixtures.makeFunctionList
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { StageWorkArea } from "../StageWorkArea";
import { makeFunctionList, makeStages } from "../../test-utils/stageFixtures";
import type { DesignStageRead } from "@/features/detailed-design/api/types";

function renderArea(
  stage: DesignStageRead,
  onApprove = vi.fn(),
  actionError: string | null = null,
) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <StageWorkArea
        // Phase-16-6:追記
        projectId="p1"
        stage={stage}
        approving={false}
        actionError={actionError}
        onApprove={onApprove}
      />
    </TamaguiProvider>,
  );
  return onApprove;
}

describe("StageWorkArea", () => {
  it("開いていない段階は、足りない入力を示し、承認できない", () => {
    const [, stage2] = makeStages();
    renderArea(stage2);

    expect(screen.getByText(/段階1\(機能一覧\)の承認/)).toBeInTheDocument();
    // Tamagui の Button の disabled は aria-disabled で表される
    expect(screen.getByRole("button", { name: "承認する" })).toHaveAttribute("aria-disabled", "true");
  });

  it("レビュー中の段階は承認できる", async () => {
    // Phase-16-6：更新
    // const [stage1] = makeStages({ 1: { state: "reviewing", version: 2 } });
    // ↓↓
    const [stage1] = makeStages({
      1: { state: "reviewing", version: 2, model: makeFunctionList() },
    });
    const user = userEvent.setup();
    const onApprove = renderArea(stage1);

    await user.click(screen.getByRole("button", { name: "承認する" }));

    expect(onApprove).toHaveBeenCalled();
  });

  it("古い段階は理由を示し、「このまま承認し直す」にする", () => {
    const [stage1] = makeStages({
      // Phase-16-6：更新
      // 1: { state: "outdated", version: 2, approved_version: 2 },
      // ↓↓
      1: {
        state: "outdated",
        version: 2,
        approved_version: 2,
        model: makeFunctionList(),
      },
    });
    renderArea(stage1);

    expect(screen.getByRole("status")).toHaveTextContent(
      "入力(前の段階または文書)が変わりました",
    );
    expect(
      screen.getByRole("button", { name: "このまま承認し直す" }),
    ).toBeEnabled();
  });

  it("承認の失敗を表示する", () => {
    const [stage1] = makeStages({ 1: { state: "reviewing", version: 2 } });
    renderArea(stage1, vi.fn(), "承認に失敗しました");

    expect(screen.getByRole("alert")).toHaveTextContent("承認に失敗しました");
  });
});
