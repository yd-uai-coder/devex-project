// 作成：Phase-19-7｜更新：Phase-21-7(画面確認後の修正)
// 写経レベル: 定型
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { StructurePanel } from "../StructurePanel";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";
import { COMPONENT_MODEL, ER_MODEL, makeDiagram } from "@/features/uml/test-utils/umlFixtures";
import { makeFunctionList, makeModuleList, makeStages } from "../../test-utils/stageFixtures";
import type { DesignStageRead } from "@/features/detailed-design/api/types";

// SUT: StructurePanel / ドライバ: render と操作 / スタブ: 段階のストアの save・generate・fetchStages、
// StageDiagramSection(図の一覧とエディタは StageDiagramSection.test.tsx で検証する)。モジュール一覧の表は
// 本物を使い、構成図のエディタのストアに置いた構成図から層の選択肢が作られることを見る。
const sectionProps = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }));
vi.mock("@/features/detailed-design/components/StageDiagramSection", () => ({
  StageDiagramSection: (props: Record<string, unknown>) => {
    sectionProps.last = props;
    return <div>diagram-section</div>;
  },
}));

const PATH = "app/api/routes/reservations.py";
const COMPONENT = makeDiagram({ id: "c1" });

function renderPanel(stage: DesignStageRead, onDirtyChange = vi.fn()) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <StructurePanel projectId="p1" stage={stage} onDirtyChange={onDirtyChange} />
    </TamaguiProvider>,
  );
  return onDirtyChange;
}

// 段階1〜3を承認し、段階4が開いた一覧(段階4の内容は引数で上書きする)
function setup(stage4: Partial<DesignStageRead>) {
  const stages = makeStages({
    1: { state: "approved", version: 2, approved_version: 2, model: makeFunctionList() },
    2: { state: "approved", version: 3, approved_version: 3 },
    3: { state: "approved", version: 1, approved_version: 1 },
    4: { is_open: true, missing_inputs: [], ...stage4 },
  });
  useDetailedDesignStore.setState({ stages });
  return stages[3];
}

describe("StructurePanel", () => {
  beforeEach(() => {
    useDetailedDesignStore.setState({
      saving: false,
      requestingGeneration: false,
      fetchStages: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(true),
      generate: vi.fn().mockResolvedValue(undefined),
    });
    useUmlEditorStore.setState({ diagram: COMPONENT, model: COMPONENT_MODEL, dirty: false });
  });

  it("未着手なら下書きを生成でき、構成図(component・全体1枚)を埋め込む", async () => {
    const user = userEvent.setup();
    renderPanel(setup({ state: "not_started" }));

    await user.click(screen.getByRole("button", { name: "下書きを生成する" }));

    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 4);
    expect(screen.getByText("diagram-section")).toBeInTheDocument();
    expect(sectionProps.last).toMatchObject({ notation: "component", subject: "", title: "構成図" });
    expect(screen.getByText("モジュールはまだありません。")).toBeInTheDocument();
  });

  it("層の選択肢は構成図の層。モジュール一覧を編集すると保存でき、保存するまで生成できない", async () => {
    const user = userEvent.setup();
    const onDirtyChange = renderPanel(
      setup({ state: "draft", version: 1, model: makeModuleList("API層") }),
    );

    expect(screen.getByRole("option", { name: "Service層" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(`${PATH} の層`), "Service層");

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: "下書きを作り直す" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // Phase-21-7：更新(画面確認後の修正。保存の操作が上下2つになったので先頭を取る)
    // await user.click(screen.getByRole("button", { name: "モジュール一覧を保存する" }));
    // ↓↓
    await user.click(screen.getAllByRole("button", { name: "モジュール一覧を保存する" })[0]);
    // ── ここから Phase-19-7 の作成分 ──
    const [, stage, model] = vi.mocked(useDetailedDesignStore.getState().save).mock.calls[0];
    expect(stage).toBe(4);
    expect(model).toEqual(makeModuleList("Service層"));
  });

  it("内容があれば作り直しの確認を出してから生成する", async () => {
    const user = userEvent.setup();
    renderPanel(setup({ state: "approved", version: 2, model: makeModuleList() }));

    await user.click(screen.getByRole("button", { name: "下書きを作り直す" }));
    expect(useDetailedDesignStore.getState().generate).not.toHaveBeenCalled();
    expect(await screen.findByText(/構成図とモジュール一覧の手直しは失われ/)).toBeInTheDocument();
    expect(screen.getByText(/段階の承認もやり直しになります/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("作り直す"));

    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 4);
  });

  it("生成中は表を出さず、構成図のエディタの未保存の編集も段階の dirty に含める", () => {
    const onDirtyChange = renderPanel(
      setup({ state: "draft", version: 1, generation_status: "generating", model: makeModuleList() }),
    );

    expect(screen.getByRole("button", { name: "生成中" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("モジュール一覧: 生成中")).toBeInTheDocument();
    expect(screen.queryByLabelText(`${PATH} のパス`)).not.toBeInTheDocument();
    expect(sectionProps.last?.generating).toBe(true);

    act(() => (sectionProps.last?.onDirtyChange as (dirty: boolean) => void)(true));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("失敗の理由と検証の結果を出す(構成図の未承認は一覧に出さない)。エディタが構成図でなければ層の選択肢は無い", () => {
    useUmlEditorStore.setState({
      diagram: makeDiagram({ notation: "er", view: "data", semantic_model: ER_MODEL }),
      model: ER_MODEL,
    });
    renderPanel(
      setup({
        state: "draft",
        version: 1,
        model: makeModuleList(),
        generation_status: "failed",
        generation_error: "AIの利用上限に達したため、下書きを作れませんでした。",
        issues: [
          { severity: "error", code: "COMPONENT_NOT_APPROVED", message: "構成図が承認されていません。", target: null },
          { severity: "warning", code: "UNCOVERED_FUNCTION", message: "F-02 に関わるモジュールがありません。", target: "F-02" },
        ],
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("AIの利用上限");
    expect(screen.queryByText(/構成図が承認されていません/)).not.toBeInTheDocument();
    expect(screen.getByText(/F-02 に関わるモジュールがありません/)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "api(構成図に無い)" })).toBeInTheDocument();
  });
});
