// 作成：Phase-16-6｜更新：Phase-21-7(画面確認後の修正)
// 写経レベル: コア ── 生成・確認・編集・保存の流れを画面越しに確かめる。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { FunctionListPanel } from "../FunctionListPanel";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { makeFunctionList, makeStages } from "../../test-utils/stageFixtures";
import type { DesignStageRead } from "@/features/detailed-design/api/types";

function renderPanel(stage: DesignStageRead, onDirtyChange = vi.fn()) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <FunctionListPanel projectId="p1" stage={stage} onDirtyChange={onDirtyChange} />
    </TamaguiProvider>,
  );
  return onDirtyChange;
}

const draftStage = () =>
  makeStages({
    1: { state: "draft", version: 2, model: makeFunctionList(), generation_status: "completed" },
  })[0];

describe("FunctionListPanel", () => {
  beforeEach(() => {
    useDetailedDesignStore.setState({
      saving: false,
      requestingGeneration: false,
      fetchStages: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(true),
      generate: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("内容が無ければ、確認なしで下書きの生成を始める", async () => {
    const user = userEvent.setup();
    renderPanel(makeStages()[0]);

    await user.click(screen.getByRole("button", { name: "下書きを生成する" }));

    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 1);
  });

  it("内容があれば、作り直す前に確認する", async () => {
    const user = userEvent.setup();
    renderPanel(draftStage());

    await user.click(screen.getByRole("button", { name: "下書きを作り直す" }));
    expect(useDetailedDesignStore.getState().generate).not.toHaveBeenCalled();
    expect(await screen.findByText("下書きを作り直しますか?")).toBeInTheDocument();

    // ダイアログ内のボタンは jsdom ではロールのクエリで「隠れている」扱いになるため、aria-label で取る
    await user.click(screen.getByLabelText("作り直す"));
    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 1);
  });

  it("行を編集すると保存できるようになり、編集した内容を保存する", async () => {
    const user = userEvent.setup();
    const onDirtyChange = renderPanel(draftStage());
    // Phase-21-7：更新(画面確認後の修正。保存の操作が上下2つになったので先頭を取る)
    // expect(screen.getByRole("button", { name: "保存する" })).toHaveAttribute(
    // ↓↓
    expect(screen.getAllByRole("button", { name: "保存する" })[0]).toHaveAttribute(
    // ── ここから Phase-16-6 の作成分 ──
      "aria-disabled",
      "true",
    );

    const name = screen.getByRole("textbox", { name: "F-01 の名称" });
    await user.clear(name);
    await user.type(name, "予約する");
    // Phase-21-7：更新(画面確認後の修正。保存の操作が上下2つになったので先頭を取る)
    // await user.click(screen.getByRole("button", { name: "保存する" }));
    // ↓↓
    await user.click(screen.getAllByRole("button", { name: "保存する" })[0]);
    // ── ここから Phase-16-6 の作成分 ──

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    const [, , model] = vi.mocked(useDetailedDesignStore.getState().save).mock.calls[0];
    expect(model).toMatchObject({ functions: [{ id: "F-01", name: "予約する" }] });
  });

  it("機能グループの改名は、行の機能グループも付け替える", async () => {
    const user = userEvent.setup();
    renderPanel(draftStage());

    const groupName = screen.getByRole("textbox", { name: "機能グループ「reservations」の名前" });
    await user.clear(groupName);
    await user.type(groupName, "予約{Enter}");

    expect(screen.getByRole("combobox", { name: "F-01 の機能グループ" })).toHaveValue("予約");
    expect(screen.getByText("初期値: reservations")).toBeInTheDocument();
  });

  it("処理を追加すると、次の処理IDの行ができる", async () => {
    const user = userEvent.setup();
    renderPanel(draftStage());

    await user.click(screen.getByRole("button", { name: "処理を追加" }));

    expect(screen.getByRole("textbox", { name: "F-02 の名称" })).toBeInTheDocument();
  });

  it("生成の失敗の理由と、検証の結果を表示する", () => {
    renderPanel({
      ...draftStage(),
      generation_status: "failed",
      generation_error: "AIの利用上限に達したため、下書きを作れませんでした。",
      issues: [
        { severity: "error", code: "UNKNOWN_GROUP", message: "グループが無い", target: "F-01" },
        { severity: "warning", code: "MISSING_API", message: "API の漏れ", target: null },
      ],
    });

    expect(screen.getByRole("alert")).toHaveTextContent("利用上限");
    expect(screen.getByText("エラー: グループが無い")).toBeInTheDocument();
    expect(screen.getByText("警告: API の漏れ")).toBeInTheDocument();
  });

  it("生成中は生成・保存のボタンを押せない", () => {
    renderPanel({ ...draftStage(), generation_status: "generating" });

    expect(
      screen.getByRole("button", { name: "下書きを生成しています..." }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "処理を追加" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
