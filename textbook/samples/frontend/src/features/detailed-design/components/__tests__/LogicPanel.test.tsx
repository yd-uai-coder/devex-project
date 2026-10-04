// 作成：Phase-21-7｜更新：Phase-21-8,21-7(画面確認後の修正)
// 写経レベル: コア ── 候補・生成の対象・飛ばす操作(保存 → 承認)・段階またぎを確かめる。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { LogicPanel } from "../LogicPanel";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import type { DesignStageRead, ProcedureModel } from "@/features/detailed-design/api/types";
import {
  makeBranch,
  makeLogic,
  makeStages,
  makeStep,
} from "../../test-utils/stageFixtures";

// SUT: LogicPanel / ドライバ: render と操作 / スタブ: 段階のストアの save・generate・fetchStages と
// onApprove(飛ばす操作の承認の開始を受け取る)。1関数の詳細(LogicSpecEditor)と編集操作(logicOps)は
// 本物を使い、候補・生成の対象・逆引き・タブ・飛ばす操作が、保存した内容と編集中の内容のどちらから
// 作られるかを見る。

const ROUTE = "app/api/routes/reservations.py";
const SERVICE = "app/services/reservation.py";
const CREATE = { module: SERVICE, function: "ReservationService.create" };

// F-01 がルーターとサービスの関数を呼ぶ手順(段階5。承認済み)
function procedures(): ProcedureModel {
  return {
    procedures: [
      {
        function_id: "F-01",
        reason: "",
        note: "",
        steps: [
          makeStep(),
          makeBranch(),
          makeStep({ caller: ROUTE, callee: SERVICE, call: "ReservationService.create" }),
        ],
      },
    ],
  };
}

// Phase-21-7:追記(画面確認後の修正。タブの保持)
function renderPanelWithUnmount(stage: DesignStageRead) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <LogicPanel projectId="p1" stage={stage} onDirtyChange={vi.fn()} onApprove={vi.fn()} />
    </TamaguiProvider>,
  );
}

// ── ここから Phase-21-7 の作成分 ──
function renderPanel(stage: DesignStageRead, onApprove = vi.fn(), onDirtyChange = vi.fn()) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <LogicPanel
        projectId="p1"
        stage={stage}
        onDirtyChange={onDirtyChange}
        onApprove={onApprove}
      />
    </TamaguiProvider>,
  );
  return { onApprove, onDirtyChange };
}

// 段階1〜5を承認し、段階6が開いた一覧(段階6の内容は引数で上書きする)
function setup(stage6: Partial<DesignStageRead>) {
  const stages = makeStages({
    5: { state: "approved", version: 2, approved_version: 2, model: procedures() },
    6: { is_open: true, missing_inputs: [], ...stage6 },
  });
  useDetailedDesignStore.setState({ stages });
  return stages[5];
}

describe("LogicPanel", () => {
  beforeEach(() => {
    useDetailedDesignStore.setState({
      saving: false,
      requestingGeneration: false,
      fetchStages: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(true),
      generate: vi.fn().mockResolvedValue(undefined),
      // Phase-21-8:追記
      focus: null,
      selectedStage: 6,
      // Phase-21-7:追記(画面確認後の修正。タブの保持)
      tabs: {},
    });
  });

  // Phase-21-7：更新(画面確認後の修正。全体の生成ボタンをなくし、タブのボタンを「生成前に保存する」にした)
  // it("段階5の手順が呼ぶ関数を候補に出し、選ぶと保存でき、保存するまで生成できない", async () => {
  // ↓↓
  it("段階5の手順が呼ぶ関数を候補に出し、選ぶと保存でき、保存するまでは「生成前に保存する」になる", async () => {
  // ── ここから Phase-21-7 の作成分 ──
    const user = userEvent.setup();
    const { onDirtyChange } = renderPanel(setup({ state: "not_started" }));

    // Phase-21-7：更新(画面確認後の修正。案内の文言を処理のタブ単位にした)
    // expect(screen.getByText("詳細を書く関数はまだ選ばれていません。")).toBeInTheDocument();
    // ↓↓
    expect(screen.getByText("このタブで詳細を書く関数はまだ選ばれていません。")).toBeInTheDocument();
    // ── ここから Phase-21-7 の作成分 ──
    expect(screen.getByText("F-01#2")).toBeInTheDocument(); // 候補の呼ばれる手順
    await user.click(screen.getByLabelText(`${SERVICE} の ReservationService.create`));

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    // Phase-21-7：更新(画面確認後の修正)
    // expect(
    //   screen.getByRole("button", { name: "詳細の無い関数の下書きを生成する(0件)" }),
    // ).toHaveAttribute("aria-disabled", "true");
    // ↓↓
    expect(screen.getByRole("button", { name: "生成前に保存する" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /このタブの未生成を生成する/ })).toBeNull();
    // ── ここから Phase-21-7 の作成分 ──
    // Phase-21-7：更新(画面確認後の修正。保存の操作が上下2つになったので先頭を取る)
    // await user.click(screen.getByRole("button", { name: "保存する" }));
    // ↓↓
    await user.click(screen.getAllByRole("button", { name: "保存する" })[0]);
    // ── ここから Phase-21-7 の作成分 ──
    const [, stage, model] = vi.mocked(useDetailedDesignStore.getState().save).mock.calls[0];
    expect(stage).toBe(6);
    expect(model).toEqual({
      logics: [
        { ...CREATE, signature: "", args: "", returns: "", raises: "", pre: "", post: "", pseudo: [] },
      ],
    });
  });

  // Phase-21-7：更新(画面確認後の修正。全体の生成ボタンをなくしたので、タブの生成で確かめる)
  // it("保存した詳細の無い関数をまとめて生成し、上限を超えたらタブごとに促す", async () => {
  //   const user = userEvent.setup();
  //   const empty = { ...makeLogic({ ...CREATE }), signature: "", pseudo: [] };
  //   renderPanel(setup({ state: "reviewing", version: 1, model: { logics: [empty] } }));
  //
  //   await user.click(
  //     screen.getByRole("button", { name: "詳細の無い関数の下書きを生成する(1件)" }),
  //   );
  //   expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 6);
  // });
  // ↓↓
  it("保存済みでタブに未生成があれば、そのタブの未生成を生成する", async () => {
    const user = userEvent.setup();
    const empty = { ...makeLogic({ ...CREATE }), signature: "", pseudo: [] };
    renderPanel(setup({ state: "reviewing", version: 1, model: { logics: [empty] } }));

    await user.click(screen.getByRole("button", { name: "このタブの未生成を生成する(1件)" }));
    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 6, undefined, [
      expect.objectContaining(CREATE),
    ]);
  });
  // ── ここから Phase-21-7 の作成分 ──

  it("逆引き・タブを出し、詳細のある関数は確認してから1関数だけ作り直す", async () => {
    const user = userEvent.setup();
    const logics = [makeLogic(), makeLogic({ ...CREATE })];
    renderPanel(setup({ state: "reviewing", version: 3, model: { logics } }));

    const reverse = screen.getByRole("table", { name: "処理ロジックの逆引き" });
    expect(reverse).toHaveTextContent("L-02");
    expect(reverse).toHaveTextContent("F-01#2");
    await user.click(screen.getByRole("tab", { name: "L-02 ReservationService.create" }));
    expect(screen.getByLabelText("L-02 のシグネチャ")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "この関数の詳細を作り直す" }));
    await user.click(screen.getByLabelText("作り直す"));

    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith(
      "p1",
      6,
      undefined,
      [expect.objectContaining(CREATE)],
    );
  });

  it("段階6を飛ばすと、0件を保存して承認を始める", async () => {
    const user = userEvent.setup();
    const { onApprove } = renderPanel(
      setup({ state: "reviewing", version: 1, model: { logics: [makeLogic()] } }),
    );

    // Phase-21-7：更新(画面確認後の修正。保存の操作が上下2つになったので先頭を取る)
    // await user.click(screen.getByRole("button", { name: "段階6を飛ばす(06を書かない)" }));
    // ↓↓
    await user.click(screen.getAllByRole("button", { name: "段階6を飛ばす(06を書かない)" })[0]);
    // ── ここから Phase-21-7 の作成分 ──
    expect(screen.getByText(/選んだ関数とその詳細は消えます/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("飛ばして承認する"));

    expect(useDetailedDesignStore.getState().save).toHaveBeenCalledWith("p1", 6, { logics: [] });
    expect(onApprove).toHaveBeenCalled();
  });

  it("保存に失敗したら承認を始めない", async () => {
    const user = userEvent.setup();
    useDetailedDesignStore.setState({ save: vi.fn().mockResolvedValue(false) });
    const { onApprove } = renderPanel(setup({ state: "not_started" }));

    // Phase-21-7：更新(画面確認後の修正。保存の操作が上下2つになったので先頭を取る)
    // await user.click(screen.getByRole("button", { name: "段階6を飛ばす(06を書かない)" }));
    // ↓↓
    await user.click(screen.getAllByRole("button", { name: "段階6を飛ばす(06を書かない)" })[0]);
    // ── ここから Phase-21-7 の作成分 ──
    await user.click(screen.getByLabelText("飛ばして承認する"));

    expect(onApprove).not.toHaveBeenCalled();
  });

  it("飛ばして承認した段階は、その旨を出し、飛ばすボタンを押せない", () => {
    renderPanel(setup({ state: "approved", version: 1, approved_version: 1, model: { logics: [] } }));

    expect(screen.getByText(/段階6は飛ばしました/)).toBeInTheDocument();
    // Phase-21-7：更新(画面確認後の修正。保存の操作が上下2つになったので先頭を取る)
    // expect(screen.getByRole("button", { name: "段階6を飛ばす(06を書かない)" })).toHaveAttribute(
    // ↓↓
    expect(screen.getAllByRole("button", { name: "段階6を飛ばす(06を書かない)" })[0]).toHaveAttribute(
    // ── ここから Phase-21-7 の作成分 ──
      "aria-disabled",
      "true",
    );
  });

  // Phase-21-7：更新(画面確認後の修正。呼ばれなくなった関数は別のタブに出す)
  // it("段階5から呼ばれなくなった関数は、印を付けて選択に残し、検証の結果を出す", () => {
  // ↓↓
  it("段階5から呼ばれなくなった関数は、別のタブに印を付けて残し、検証の結果を出す", async () => {
    const user = userEvent.setup();
    // ── ここから Phase-21-7 の作成分 ──
    const orphan = makeLogic({ module: SERVICE, function: "removed" });
    renderPanel(
      setup({
        state: "reviewing",
        version: 1,
        model: { logics: [orphan] },
        issues: [
          {
            severity: "error",
            code: "UNCALLED_LOGIC",
            message: "L-01(removed)を呼ぶ手順が、段階5にありません。",
            target: "L-01",
          },
        ],
      }),
    );

    // Phase-21-7:追記(画面確認後の修正)
    await user.click(screen.getByRole("tab", { name: "呼ばれていない関数(1)" }));
    // ── ここから Phase-21-7 の作成分 ──
    expect(screen.getByLabelText(`${SERVICE} の removed`)).toBeChecked();
    expect(screen.getByText("呼ぶ手順がありません")).toBeInTheDocument();
    expect(screen.getByText("段階5にこの関数を呼ぶ手順がありません")).toBeInTheDocument();
    expect(screen.getByText(/を呼ぶ手順が、段階5にありません/)).toBeInTheDocument();
  });

  // Phase-21-8:追記 ── 段階5との行き来
  it("呼ばれる手順のバッジから段階5のその手順へ移る", async () => {
    const user = userEvent.setup();
    renderPanel(setup({ state: "reviewing", version: 1, model: { logics: [makeLogic({ ...CREATE })] } }));

    await user.click(screen.getByRole("button", { name: "手順 F-01#2 へ移る" }));

    expect(useDetailedDesignStore.getState()).toMatchObject({
      selectedStage: 5,
      focus: { stage: 5, target: "F-01#2" },
    });
  });

  it("保存していない編集があれば、移る前に確かめる", async () => {
    const user = userEvent.setup();
    renderPanel(setup({ state: "reviewing", version: 1, model: { logics: [makeLogic()] } }));

    await user.type(screen.getByLabelText("L-01 の事前条件"), "追記");
    await user.click(screen.getByRole("button", { name: "手順 F-01#1 へ移る" }));
    expect(useDetailedDesignStore.getState().selectedStage).toBe(6);
    await user.click(screen.getByLabelText("移る"));

    expect(useDetailedDesignStore.getState().selectedStage).toBe(5);
  });

  it("段階5から移ってきたときは、その関数のタブを開いて強調し、移動先を消す", () => {
    const logics = [makeLogic(), makeLogic({ ...CREATE })];
    const stage = setup({ state: "reviewing", version: 1, model: { logics } });
    useDetailedDesignStore.setState({
      focus: { stage: 6, target: `${SERVICE}::ReservationService.create` },
    });
    renderPanel(stage);

    expect(screen.getByRole("tab", { name: "L-02 ReservationService.create" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("L-02 のシグネチャ").closest("[aria-current]")).not.toBeNull();
    expect(useDetailedDesignStore.getState().focus).toBeNull();
  });

  // Phase-21-7:追記(画面確認後の修正) ── 処理ごとのタブ
  describe("処理ごとのタブ", () => {
    // F-01 と F-02 が共通の関数(ReservationService.create)を呼び、F-02 は自分だけの関数を3つ呼ぶ
    function twoProcedures(): ProcedureModel {
      const call = (fn: string) => makeStep({ caller: ROUTE, callee: SERVICE, call: fn });
      return {
        procedures: [
          {
            function_id: "F-01",
            reason: "",
            note: "",
            steps: [makeStep(), call("ReservationService.create")],
          },
          {
            function_id: "F-02",
            reason: "",
            note: "",
            steps: [call("ReservationService.create"), call("a"), call("b"), call("c")],
          },
        ],
      };
    }

    function setupTwo(stage6: Partial<DesignStageRead>) {
      const stages = makeStages({
        5: { state: "approved", version: 2, approved_version: 2, model: twoProcedures() },
        6: { is_open: true, missing_inputs: [], ...stage6 },
      });
      useDetailedDesignStore.setState({ stages });
      return stages[5];
    }

    const target = (fn: string) => ({ module: SERVICE, function: fn });
    const empty = (fn: string) => ({ ...makeLogic(target(fn)), signature: "", pseudo: [] });

    it("処理のタブで候補を切り替え、共通の印・他の処理の手順・状態を出す", async () => {
      const user = userEvent.setup();
      const logics = [makeLogic(target("ReservationService.create")), empty("a")];
      renderPanel(setupTwo({ state: "reviewing", version: 1, model: { logics } }));

      // 最初は F-01 のタブ: ルーターの関数と共通の関数だけ
      expect(screen.getByLabelText(`${ROUTE} の create_reservation`)).toBeInTheDocument();
      expect(screen.queryByLabelText(`${SERVICE} の a`)).toBeNull();
      expect(screen.getByText("共通")).toBeInTheDocument();
      // 候補の行では、他の処理(F-02)の手順のバッジを見分けられるようにする
      expect(screen.getAllByText("F-02#1").map((el) => el.getAttribute("title"))).toContain(
        "他の処理の手順",
      );
      expect(screen.getByText("生成済")).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: /^F-02/ }));
      expect(screen.getByLabelText(`${SERVICE} の a`)).toBeChecked();
      expect(screen.getByText("未生成")).toBeInTheDocument();
      // 内側のタブは、この処理から呼ばれる選んだ関数だけ(L-ID は全体の並び順)
      expect(screen.getByRole("tab", { name: "L-01 ReservationService.create(共通)" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "L-02 a" })).toBeInTheDocument();
    });

    it("タブの未選択をすべて選ぶ(選んだ関数・生成済はそのまま)", async () => {
      const user = userEvent.setup();
      const logics = [makeLogic(target("ReservationService.create"))];
      renderPanel(setupTwo({ state: "reviewing", version: 1, model: { logics } }));

      await user.click(screen.getByRole("tab", { name: /^F-02/ }));
      await user.click(screen.getByRole("button", { name: "このタブの未選択をすべて選ぶ(3件)" }));

      for (const fn of ["a", "b", "c"]) {
        expect(screen.getByLabelText(`${SERVICE} の ${fn}`)).toBeChecked();
      }
      await user.click(screen.getAllByRole("button", { name: "保存する" })[0]);
      const [, , model] = vi.mocked(useDetailedDesignStore.getState().save).mock.calls[0];
      const saved = model as { logics: { function: string; signature: string }[] };
      expect(saved.logics.map((row) => row.function)).toEqual([
        "ReservationService.create",
        "a",
        "b",
        "c",
      ]);
      expect(saved.logics[0].signature).toBe(makeLogic().signature);
    });

    it("タブの未生成を生成する(保存した内容から、1回5件まで)", async () => {
      const user = userEvent.setup();
      const logics = ["ReservationService.create", "a", "b", "c"].map(empty);
      renderPanel(setupTwo({ state: "reviewing", version: 1, model: { logics } }));

      await user.click(screen.getByRole("tab", { name: /^F-02/ }));
      await user.click(screen.getByRole("button", { name: "このタブの未生成を生成する(4件)" }));

      expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 6, undefined, [
        target("ReservationService.create"),
        target("a"),
        target("b"),
        target("c"),
      ]);
    });

    it("タブの未生成が6件以上なら、先頭の5件を生成して残りを案内する", async () => {
      const user = userEvent.setup();
      const fns = ["f1", "f2", "f3", "f4", "f5", "f6"];
      const stages = makeStages({
        5: {
          state: "approved",
          version: 2,
          approved_version: 2,
          model: {
            procedures: [
              {
                function_id: "F-01",
                reason: "",
                note: "",
                steps: fns.map((fn) => makeStep({ caller: ROUTE, callee: SERVICE, call: fn })),
              },
            ],
          },
        },
        6: { is_open: true, missing_inputs: [], state: "reviewing", version: 1, model: { logics: fns.map(empty) } },
      });
      useDetailedDesignStore.setState({ stages });
      renderPanel(stages[5]);

      expect(screen.getByText("1回に生成するのは 5 件までです。残り 1 件はもう一度押してください。")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "このタブの未生成を生成する(5件)" }));
      const [, , , targets] = vi.mocked(useDetailedDesignStore.getState().generate).mock.calls[0];
      expect(targets).toHaveLength(5);
    });

    it("保存の操作を作業領域の上と下の両方に置く", () => {
      renderPanel(setupTwo({ state: "not_started" }));
      expect(screen.getAllByRole("button", { name: "保存する" })).toHaveLength(2);
      expect(screen.getAllByRole("button", { name: "段階6を飛ばす(06を書かない)" })).toHaveLength(2);
    });

    it("段階5から共通の関数へ移ってきたときは、最初に呼ぶ処理のタブで開く", () => {
      const logics = [makeLogic(target("a")), makeLogic(target("ReservationService.create"))];
      const stage = setupTwo({ state: "reviewing", version: 1, model: { logics } });
      useDetailedDesignStore.setState({ focus: { stage: 6, target: `${SERVICE}::a` } });
      renderPanel(stage);

      expect(screen.getByRole("tab", { name: /^F-02/ })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: "L-01 a" })).toHaveAttribute("aria-selected", "true");
    });
    // Phase-21-7:追記(画面確認後の修正) ── タブの生成ボタンの出し分け
    it("チェック済みの未生成があって保存していなければ「生成前に保存する」を出し、押すと保存する", async () => {
      const user = userEvent.setup();
      const logics = [makeLogic(target("ReservationService.create"))];
      renderPanel(setupTwo({ state: "reviewing", version: 1, model: { logics } }));

      await user.click(screen.getByRole("tab", { name: /^F-02/ }));
      await user.click(screen.getByLabelText(`${SERVICE} の a`));
      await user.click(screen.getByRole("button", { name: "生成前に保存する" }));

      expect(useDetailedDesignStore.getState().save).toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: /このタブの未生成を生成する/ })).toBeNull();
    });

    it("タブの関数が全部生成済みなら (0件) で押せない", async () => {
      const user = userEvent.setup();
      const logics = [makeLogic(target("ReservationService.create"))];
      renderPanel(setupTwo({ state: "reviewing", version: 1, model: { logics } }));

      expect(screen.getByRole("button", { name: "このタブの未生成を生成する(0件)" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      // チェックの無い候補だけのタブも (0件)
      await user.click(screen.getByRole("tab", { name: /^F-02/ }));
      expect(screen.getByRole("button", { name: "このタブの未生成を生成する(0件)" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });
    // Phase-21-7:追記(画面確認後の修正。タブの保持)
    it("保存・生成でパネルが作り直されても、開いていた処理と関数のタブのまま", async () => {
      const user = userEvent.setup();
      const logics = [makeLogic(target("ReservationService.create")), makeLogic(target("a"))];
      const stage = setupTwo({ state: "reviewing", version: 1, model: { logics } });
      const { unmount } = renderPanelWithUnmount(stage);

      await user.click(screen.getByRole("tab", { name: /^F-02/ }));
      await user.click(screen.getByRole("tab", { name: "L-02 a" }));
      unmount(); // StageWorkArea は版・生成の状態が変わるとパネルを作り直す
      renderPanel({ ...stage, version: 2 });

      expect(screen.getByRole("tab", { name: /^F-02/ })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: "L-02 a" })).toHaveAttribute("aria-selected", "true");
    });
  });
});
