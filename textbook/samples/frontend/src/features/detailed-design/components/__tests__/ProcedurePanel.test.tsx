// 作成：Phase-20-7｜更新：Phase-21-8,21-7(画面確認後の修正),29-4
// 写経レベル: コア ── 生成の対象・作り直しの確認・関与表の反映を確かめる。
// Phase-21-8:追記 ── ../../test-utils/stageFixtures.makeLogics
// Phase-29-4:追記 ── @/features/detailed-design/api/designStagesApi.getProcedureSequence
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ProcedurePanel } from "../ProcedurePanel";
import { getProcedureSequence } from "@/features/detailed-design/api/designStagesApi";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import type { DesignStageRead, FunctionListModel } from "@/features/detailed-design/api/types";
import {
  makeFunctionList,
  makeLogics,
  makeModuleList,
  makeProcedures,
  makeStages,
  makeStep,
} from "../../test-utils/stageFixtures";

// Phase-29-4：更新
// // SUT: ProcedurePanel / ドライバ: render と操作 / スタブ: 段階のストアの save・generate・fetchStages。
// ↓↓
// SUT: ProcedurePanel / ドライバ: render と操作 / スタブ: 段階のストアの save・generate・fetchStages と、
// シーケンス図の API(getProcedureSequence。保存した手順から devex-api が導く)。
// 手順の表(ProcedureStepTable)と編集操作(procedureOps)は本物を使い、選択・生成の対象・索引・関与表・
// タブが、保存した内容と編集中の内容のどちらから作られるかを見る。

// Phase-29-4:追記
vi.mock("@/features/detailed-design/api/designStagesApi", () => ({
  getProcedureSequence: vi.fn(),
}));

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
      // Phase-21-8:追記
      focus: null,
      selectedStage: 5,
      // Phase-21-7:追記(画面確認後の修正。タブの保持)
      tabs: {},
    });
    // Phase-29-4:追記
    vi.mocked(getProcedureSequence).mockReset();
    vi.mocked(getProcedureSequence).mockResolvedValue({
      function_id: "F-01",
      svg: '<svg data-testid="sequence"></svg>',
      issues: [],
    });
  });

  it("手順のある処理のタブでは、表の下に保存した手順のシーケンス図を出す", async () => {
    renderPanel(setup({ state: "reviewing", version: 4, model: makeProcedures() }));

    expect(await screen.findByRole("img", { name: "F-01 のシーケンス図" })).toBeInTheDocument();
    expect(getProcedureSequence).toHaveBeenCalledWith("p1", "F-01");
  });

  it("手順の無い処理(保存前・未生成)には、シーケンス図を出さない", () => {
    renderPanel(
      setup({
        state: "reviewing",
        version: 1,
        model: { procedures: [{ function_id: "F-02", reason: "", note: "", steps: [] }] },
      }),
    );

    expect(screen.queryByText("シーケンス図")).not.toBeInTheDocument();
    expect(getProcedureSequence).not.toHaveBeenCalled();
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
    // Phase-21-7：更新(画面確認後の修正。保存の操作が上下2つになったので先頭を取る)
    // await user.click(screen.getByRole("button", { name: "保存する" }));
    // ↓↓
    await user.click(screen.getAllByRole("button", { name: "保存する" })[0]);
    // ── ここから Phase-20-7 の作成分 ──
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

  // Phase-21-8:追記
  // 段階6との行き来(Phase 21)
  it("段階6に詳細がある手順のバッジから段階6へ移り、保存していない編集があれば確かめる", async () => {
    const user = userEvent.setup();
    const stage = setup({ state: "reviewing", version: 2, model: makeProcedures() });
    const stages = useDetailedDesignStore.getState().stages;
    useDetailedDesignStore.setState({
      stages: stages.map((s) => (s.stage === 6 ? { ...s, model: makeLogics() } : s)),
    });
    renderPanel(stage);

    await user.type(screen.getByLabelText("F-01 の選定理由"), "追記");
    await user.click(screen.getByRole("button", { name: "F-01#1 の詳細 L-01 へ移る" }));
    expect(screen.getByText("保存していない編集は失われます。")).toBeInTheDocument();
    expect(useDetailedDesignStore.getState().selectedStage).toBe(5);
    await user.click(screen.getByLabelText("移る"));

    expect(useDetailedDesignStore.getState()).toMatchObject({
      selectedStage: 6,
      focus: { stage: 6, target: `${ROUTE}::create_reservation` },
    });
  });

  it("段階6から移ってきたときは、その処理のタブを開いて手順の行を強調し、移動先を消す", () => {
    const procedures = {
      procedures: [
        ...makeProcedures().procedures,
        { function_id: "F-02", reason: "", note: "", steps: [makeStep({ action: "一覧を返す" })] },
      ],
    };
    const stage = setup({ state: "reviewing", version: 2, model: procedures });
    useDetailedDesignStore.setState({ focus: { stage: 5, target: "F-02#1" } });
    renderPanel(stage);

    expect(screen.getByRole("tab", { name: "F-02 予約を一覧する" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("F-02#1 の処理内容").closest("tr")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(useDetailedDesignStore.getState().focus).toBeNull();
  });

  // Phase-21-7:追記(画面確認後の修正。タブの保持)
  it("保存・生成でパネルが作り直されても、開いていた処理のタブのまま", async () => {
    const user = userEvent.setup();
    const procedures = {
      procedures: [
        ...makeProcedures().procedures,
        { function_id: "F-02", reason: "", note: "", steps: [makeStep({ action: "一覧を返す" })] },
      ],
    };
    const stage = setup({ state: "reviewing", version: 2, model: procedures });
    const view = render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <ProcedurePanel projectId="p1" stage={stage} onDirtyChange={vi.fn()} />
      </TamaguiProvider>,
    );

    await user.click(screen.getByRole("tab", { name: "F-02 予約を一覧する" }));
    view.unmount();
    renderPanel({ ...stage, version: 3 });

    expect(screen.getByRole("tab", { name: "F-02 予約を一覧する" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
