// 作成：Phase-17-6｜更新：Phase-17-7,17-8,18-9,21-7(画面確認後の修正)
// 写経レベル: コア ── 段階1の内容をストアに置き、グループの選択 → 保存 → 生成の順を確かめる。
import { beforeEach, describe, expect, it, vi } from "vitest";
// Phase-17-7：更新
// import { render, screen } from "@testing-library/react";
// ↓↓
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DataFlowPanel } from "../DataFlowPanel";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import {
  makeDataFlow,
  makeFunctionList,
  makeStages,
} from "../../test-utils/stageFixtures";
import type { DesignStageRead } from "@/features/detailed-design/api/types";

// Phase-17-7:追記(DataDictionaryTable の差し替えは Phase-17-8:追記)
// DFD のタブ(一覧の取得とエディタ)は DfdEditorTabs.test.tsx で検証する。ここでは渡す値と、
// DFD の未保存の編集を段階の dirty に合わせることだけを見る。
const tabsProps = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }));
// Phase-17-8:追記
vi.mock("@/features/detailed-design/components/DataDictionaryTable", () => ({
  DataDictionaryTable: ({ disabled }: { disabled: boolean }) => (
    <div>data-dictionary{disabled ? "(disabled)" : ""}</div>
  ),
}));
// Phase-17-7:追記
vi.mock("@/features/detailed-design/components/DfdEditorTabs", () => ({
  DfdEditorTabs: (props: Record<string, unknown>) => {
    tabsProps.last = props;
    return <div>dfd-tabs</div>;
  },
}));

function renderPanel(stage: DesignStageRead, onDirtyChange = vi.fn()) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DataFlowPanel projectId="p1" stage={stage} onDirtyChange={onDirtyChange} />
    </TamaguiProvider>,
  );
  return onDirtyChange;
}

// 段階1を承認し、段階2が開いた一覧(段階2の内容は引数で上書きする)
function stagesWith(stage2: Partial<DesignStageRead>) {
  return makeStages({
    1: { state: "approved", version: 2, approved_version: 2, model: makeFunctionList() },
    2: { is_open: true, missing_inputs: [], ...stage2 },
  });
}

function setup(stage2: Partial<DesignStageRead>) {
  const stages = stagesWith(stage2);
  useDetailedDesignStore.setState({ stages });
  return stages[1];
}

describe("DataFlowPanel", () => {
  beforeEach(() => {
    useDetailedDesignStore.setState({
      saving: false,
      requestingGeneration: false,
      fetchStages: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(true),
      generate: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("グループを選ぶと保存できるようになり、保存するまで生成できない", async () => {
    const user = userEvent.setup();
    const onDirtyChange = renderPanel(setup({ state: "not_started" }));

    await user.click(screen.getByRole("checkbox", { name: /reservations/ }));

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: "下書きを生成する" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // Phase-21-7：更新(画面確認後の修正。保存の操作が上下2つになったので先頭を取る)
    // await user.click(screen.getByRole("button", { name: "保存する" }));
    // ↓↓
    await user.click(screen.getAllByRole("button", { name: "保存する" })[0]);
    // ── ここから Phase-17-6 の作成分 ──
    const [, stage, model] = vi.mocked(useDetailedDesignStore.getState().save).mock.calls[0];
    expect(stage).toBe(2);
    expect(model).toEqual({ dfd_groups: ["reservations"], summaries: [] });
  });

  it("グループの選択だけを保存した状態からは、確認なしで生成する", async () => {
    const user = userEvent.setup();
    renderPanel(
      setup({ state: "reviewing", version: 1, model: { dfd_groups: ["reservations"], summaries: [] } }),
    );

    await user.click(screen.getByRole("button", { name: "下書きを生成する" }));

    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 2);
  });

  it("処理概要表があれば作り直す前に確認し、機能一覧の処理ごとに行を出す", async () => {
    const user = userEvent.setup();
    renderPanel(setup({ state: "draft", version: 2, model: makeDataFlow() }));

    expect(screen.getByRole("textbox", { name: "F-01 の入力" })).toHaveValue("予約の内容");
    await user.click(screen.getByRole("button", { name: "下書きを作り直す" }));
    expect(useDetailedDesignStore.getState().generate).not.toHaveBeenCalled();
    expect(await screen.findByText("下書きを作り直しますか?")).toBeInTheDocument();
  });

  it("処理概要表を編集して保存する", async () => {
    const user = userEvent.setup();
    renderPanel(setup({ state: "draft", version: 2, model: makeDataFlow() }));

    const output = screen.getByRole("textbox", { name: "F-01 の出力" });
    await user.clear(output);
    await user.type(output, "予約ID");
    // Phase-21-7：更新(画面確認後の修正。保存の操作が上下2つになったので先頭を取る)
    // await user.click(screen.getByRole("button", { name: "保存する" }));
    // ↓↓
    await user.click(screen.getAllByRole("button", { name: "保存する" })[0]);
    // ── ここから Phase-17-6 の作成分 ──

    const [, , model] = vi.mocked(useDetailedDesignStore.getState().save).mock.calls[0];
    expect(model).toMatchObject({ summaries: [{ function_id: "F-01", output: "予約ID" }] });
  });

  it("生成中は、生成ボタンと処理概要表の空欄を「生成中」と表示する", () => {
    renderPanel(
      setup({
        state: "draft",
        version: 1,
        model: { dfd_groups: [], summaries: [] },
        generation_status: "generating",
      }),
    );

    expect(screen.getByRole("button", { name: "生成中" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    const input = screen.getByRole("textbox", { name: "F-01 の入力" });
    expect(input).toHaveAttribute("placeholder", "生成中");
    expect(input).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "F-01 の処理内容" })).toHaveAttribute(
      "placeholder",
      "生成中",
    );
  });

  it("生成の失敗の理由と、検証の結果を表示する", () => {
    renderPanel(
      setup({
        state: "draft",
        version: 2,
        model: makeDataFlow(["reservations"]),
        generation_status: "failed",
        generation_error: "AIの利用上限に達したため、下書きを作れませんでした。",
        issues: [
          {
            severity: "error",
            code: "DFD_NOT_APPROVED",
            message: "DFD が承認されていません",
            target: "reservations",
          },
          // Phase-18-9:追記
          { severity: "error", code: "MISSING_SUMMARY", message: "F-02 が処理概要表にありません。", target: "F-02" },
        ],
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("利用上限");
    // Phase-18-9：更新
    // expect(screen.getByText("エラー: DFD が承認されていません")).toBeInTheDocument();
    // ↓↓
    expect(screen.getByText("エラー: F-02 が処理概要表にありません。")).toBeInTheDocument();
    // DFD の未承認は、段階の承認を押したときに出す(Phase 18)
    expect(screen.queryByText(/DFD が承認されていません/)).not.toBeInTheDocument();
  });
});

// Phase-17-7:追記(data-dictionary の確認は Phase-17-8:追記)
describe("DataFlowPanel と DFD のタブ", () => {
  beforeEach(() => {
    useDetailedDesignStore.setState({
      saving: false,
      requestingGeneration: false,
      save: vi.fn().mockResolvedValue(true),
      generate: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("保存済みのグループを渡し、DFD の未保存の編集も段階の dirty にする", async () => {
    const onDirtyChange = renderPanel(
      setup({ state: "draft", version: 2, model: makeDataFlow(["reservations"]) }),
    );

    expect(screen.getByText("dfd-tabs")).toBeInTheDocument();
    // Phase-17-8:追記
    expect(screen.getByText("data-dictionary")).toBeInTheDocument();
    expect(tabsProps.last).toMatchObject({ groups: ["reservations"], generating: false });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    const report = tabsProps.last?.onDirtyChange as (dirty: boolean) => void;
    await act(async () => report(true));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });
});
