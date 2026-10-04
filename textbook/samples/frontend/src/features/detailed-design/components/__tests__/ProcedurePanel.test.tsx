// 作成：Phase-20-7
// 写経レベル: コア ── 生成の対象・作り直しの確認・関与表の反映を確かめる。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ProcedurePanel } from "../ProcedurePanel";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import type { DesignStageRead, FunctionListModel } from "@/features/detailed-design/api/types";
import {
  makeFunctionList,
  makeModuleList,
  makeProcedures,
  makeStages,
  makeStep,
} from "../../test-utils/stageFixtures";

// SUT: ProcedurePanel / ドライバ: render と操作 / スタブ: 段階のストアの save・generate・fetchStages。
// 手順の表(ProcedureStepTable)と編集操作(procedureOps)は本物を使い、選択・生成の対象・索引・関与表・
// タブが、保存した内容と編集中の内容のどちらから作られるかを見る。

const ROUTE = "app/api/routes/reservations.py";

function functionList(): FunctionListModel {
  const list = makeFunctionList();
  return {
    ...list,
    functions: [
      ...list.functions,
      { ...list.functions[0], id: "F-02", name: "予約を一覧する", trigger: "GET /api/v1/reservations" },
    ],
  };
}

function renderPanel(stage: DesignStageRead, onDirtyChange = vi.fn()) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ProcedurePanel projectId="p1" stage={stage} onDirtyChange={onDirtyChange} />
    </TamaguiProvider>,
  );
  return onDirtyChange;
}

// 段階1〜4を承認し、段階5が開いた一覧(段階5の内容は引数で上書きする)
function setup(stage5: Partial<DesignStageRead>) {
  const stages = makeStages({
    1: { state: "approved", version: 2, approved_version: 2, model: functionList() },
    2: { state: "approved", version: 3, approved_version: 3 },
    3: { state: "approved", version: 1, approved_version: 1 },
    4: { state: "approved", version: 1, approved_version: 1, model: makeModuleList() },
    5: { is_open: true, missing_inputs: [], ...stage5 },
  });
  useDetailedDesignStore.setState({ stages });
  return stages[4];
}

describe("ProcedurePanel", () => {
  beforeEach(() => {
    useDetailedDesignStore.setState({
      saving: false,
      requestingGeneration: false,
      fetchStages: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(true),
      generate: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("処理を選ぶと保存でき、保存するまで生成できない", async () => {
    const user = userEvent.setup();
    const onDirtyChange = renderPanel(setup({ state: "not_started" }));

    expect(screen.getByText("手順を書く処理はまだ選ばれていません。")).toBeInTheDocument();
    await user.click(screen.getByLabelText("F-02 予約を一覧する"));

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(
      screen.getByRole("button", { name: "手順の無い処理の下書きを生成する(0件)" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("保存すると、この処理の下書きを生成できます。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存する" }));
    const [, stage, model] = vi.mocked(useDetailedDesignStore.getState().save).mock.calls[0];
    expect(stage).toBe(5);
    expect(model).toEqual({
      procedures: [{ function_id: "F-02", reason: "", note: "", steps: [] }],
    });
  });

  it("保存した選択のうち手順の無い処理をまとめて生成する(対象の指定なし)", async () => {
    const user = userEvent.setup();
    const model = {
      procedures: [
        ...makeProcedures().procedures,
        { function_id: "F-02", reason: "", note: "", steps: [] },
      ],
    };
    renderPanel(setup({ state: "draft", version: 2, model }));

    await user.click(
      screen.getByRole("button", { name: "手順の無い処理の下書きを生成する(1件)" }),
    );

    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 5);
  });

  it("索引・関与表・タブを出し、手順のある処理は確認してから1処理だけ作り直す", async () => {
    const user = userEvent.setup();
    renderPanel(setup({ state: "approved", version: 3, model: makeProcedures() }));

    const index = screen.getByRole("table", { name: "手順の索引" });
    expect(within(index).getByText("予約を登録する")).toBeInTheDocument();
    const involvement = screen.getByRole("table", { name: "処理 × モジュールの関与表" });
    expect(within(involvement).getByText(ROUTE)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "F-01 予約を登録する" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "この処理の手順を作り直す" }));
    expect(useDetailedDesignStore.getState().generate).not.toHaveBeenCalled();
    expect(await screen.findByText(/F-01 の手順を作り直します/)).toBeInTheDocument();
    expect(screen.getByText(/段階の承認はやり直しになります/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("作り直す"));

    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 5, ["F-01"]);
  });

  it("手順の編集は関与表にすぐ反映し、手順のある処理を外すときは確認する", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPanel(setup({ state: "draft", version: 2, model: makeProcedures() }));

    await user.click(screen.getByRole("button", { name: "手順を足す" }));
    await user.type(screen.getByLabelText("F-01#2 の呼び出し先"), ROUTE);
    const involvement = screen.getByRole("table", { name: "処理 × モジュールの関与表" });
    expect(within(involvement).getByText("1, 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この処理の手順を作り直す" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await user.click(screen.getByLabelText("F-01 予約を登録する"));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText("F-01 予約を登録する")).toBeChecked();
    confirm.mockRestore();
  });

  it("6件以上の未生成はまとめて生成できず、タブごとに生成する", async () => {
    const user = userEvent.setup();
    const many = {
      procedures: Array.from({ length: 6 }, (_, i) => ({
        function_id: `F-0${i + 1}`,
        reason: "",
        note: "",
        steps: [],
      })),
    };
    renderPanel(setup({ state: "draft", version: 2, model: many }));

    expect(
      screen.getByRole("button", { name: "手順の無い処理の下書きを生成する(6件)" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/5 件までです/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "この処理の下書きを生成する" }));
    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 5, ["F-01"]);
  });

  it("生成中は手順の表を出さない", () => {
    renderPanel(
      setup({
        state: "draft",
        version: 2,
        generation_status: "generating",
        model: { procedures: [{ function_id: "F-01", reason: "", note: "", steps: [makeStep()] }] },
      }),
    );
    expect(screen.getByText("手順: 生成中")).toBeInTheDocument();
    expect(screen.queryByLabelText("F-01#1 の呼び出し先")).not.toBeInTheDocument();
  });

  it("失敗の理由と検証の結果を出す", () => {
    renderPanel(
      setup({
        state: "draft",
        version: 2,
        generation_status: "failed",
        generation_error: "AIの利用上限に達しました",
        model: makeProcedures(),
        issues: [
          { severity: "error", code: "UNKNOWN_CALLEE", message: "呼び出し先が無い", target: "F-01#1" },
        ],
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("AIの利用上限に達しました");
    expect(screen.getByText("エラー: 呼び出し先が無い")).toBeInTheDocument();
  });
});
