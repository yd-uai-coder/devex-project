// 作成：Phase-23-6
// 写経レベル: 定型 ── 生成・保存・作り直しの配線の確認。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { PlanPanel } from "../PlanPanel";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { makePlan, makeStages } from "../../test-utils/stageFixtures";
import type { DesignStageRead } from "@/features/detailed-design/api/types";

// SUT: PlanPanel / ドライバ: render と操作 / スタブ: 段階のストアの save・generate・fetchStages。
// 表(PlanTables)は本物を使い、表の編集が保存の内容になることを見る。
function renderPanel(stage: DesignStageRead, onDirtyChange = vi.fn()) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <PlanPanel projectId="p1" stage={stage} onDirtyChange={onDirtyChange} />
    </TamaguiProvider>,
  );
  return onDirtyChange;
}

// 段階1〜6を承認し、段階7が開いた一覧の段階7(内容は引数で上書きする)
function stage7(patch: Partial<DesignStageRead>): DesignStageRead {
  const stages = makeStages({ 7: { is_open: true, missing_inputs: [], ...patch } });
  useDetailedDesignStore.setState({ stages });
  return stages[6];
}

describe("PlanPanel", () => {
  beforeEach(() => {
    useDetailedDesignStore.setState({
      saving: false,
      requestingGeneration: false,
      fetchStages: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(true),
      generate: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("未着手なら下書きを生成でき、空の表を出す", async () => {
    const user = userEvent.setup();
    renderPanel(stage7({ state: "not_started" }));

    await user.click(screen.getByRole("button", { name: "下書きを生成する" }));

    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 7);
    expect(screen.getByText("横断事項はまだありません。")).toBeInTheDocument();
    expect(screen.getByText("マイルストーンはまだありません。")).toBeInTheDocument();
  });

  it("編集すると保存でき、保存するまで生成できない", async () => {
    const user = userEvent.setup();
    const onDirtyChange = renderPanel(stage7({ state: "draft", version: 1, model: makePlan() }));

    await user.clear(screen.getByLabelText("開発環境・事前準備"));
    await user.type(screen.getByLabelText("開発環境・事前準備"), "uv");

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: "下書きを作り直す" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getAllByRole("button", { name: "保存する" })[0]);
    const [, stage, model] = vi.mocked(useDetailedDesignStore.getState().save).mock.calls[0];
    expect(stage).toBe(7);
    expect(model).toEqual({ ...makePlan(), environment: "uv" });
  });

  it("内容があるときの作り直しは、確認してから生成する", async () => {
    const user = userEvent.setup();
    renderPanel(stage7({ state: "approved", version: 2, model: makePlan() }));

    await user.click(screen.getByRole("button", { name: "下書きを作り直す" }));
    expect(screen.getByText(/段階の承認もやり直しになります。/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("作り直す"));

    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 7);
  });

  it("生成中は表の代わりに「生成中」を出し、失敗したら理由を出す", () => {
    renderPanel(stage7({ generation_status: "generating", model: makePlan() }));
    expect(screen.getByText("横断事項と実装計画: 生成中")).toBeInTheDocument();
    expect(screen.queryByLabelText("M-01 の名前")).not.toBeInTheDocument();
  });

  it("生成に失敗したら理由を出す", () => {
    renderPanel(stage7({ generation_status: "failed", generation_error: "上限に達しました" }));
    expect(screen.getByRole("alert")).toHaveTextContent("上限に達しました");
  });
});
