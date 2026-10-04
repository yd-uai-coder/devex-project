// 作成：Phase-18-9
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DataModelPanel } from "../DataModelPanel";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";
import { ER_MODEL, makeDiagram } from "@/features/uml/test-utils/umlFixtures";
import { makeCrud, makeFunctionList, makeStages } from "../../test-utils/stageFixtures";
import type { DesignStageRead } from "@/features/detailed-design/api/types";

// SUT: DataModelPanel / ドライバ: render と操作 / スタブ: 段階のストアの save・generate・fetchStages、
// ErEditorSection(ER の一覧とエディタは ErEditorSection.test.tsx で検証する)。テーブル定義の表と
// CRUD 図は本物を使い、ER のエディタのストアに置いた ER から列が作られることを見る。
const sectionProps = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }));
vi.mock("@/features/detailed-design/components/ErEditorSection", () => ({
  ErEditorSection: (props: Record<string, unknown>) => {
    sectionProps.last = props;
    return <div>er-section</div>;
  },
}));

const ER = makeDiagram({ id: "e1", notation: "er", view: "data", semantic_model: ER_MODEL });

function renderPanel(stage: DesignStageRead, onDirtyChange = vi.fn()) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DataModelPanel projectId="p1" stage={stage} onDirtyChange={onDirtyChange} />
    </TamaguiProvider>,
  );
  return onDirtyChange;
}

// 段階1・2を承認し、段階3が開いた一覧(段階3の内容は引数で上書きする)
function setup(stage3: Partial<DesignStageRead>) {
  const stages = makeStages({
    1: { state: "approved", version: 2, approved_version: 2, model: makeFunctionList() },
    2: { state: "approved", version: 3, approved_version: 3 },
    3: {
      is_open: true,
      missing_inputs: [],
      dfd_accesses: [{ function_id: "F-01", table: "users", kind: "write" }],
      ...stage3,
    },
  });
  useDetailedDesignStore.setState({ stages });
  return stages[2];
}

describe("DataModelPanel", () => {
  beforeEach(() => {
    useDetailedDesignStore.setState({
      saving: false,
      requestingGeneration: false,
      fetchStages: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(true),
      generate: vi.fn().mockResolvedValue(undefined),
    });
    useUmlEditorStore.setState({ diagram: ER, model: ER_MODEL, dirty: false });
  });

  it("未着手なら下書きを生成でき、ER の表と CRUD 図の列は ER のテーブルから作る", async () => {
    const user = userEvent.setup();
    renderPanel(setup({ state: "not_started" }));

    await user.click(screen.getByRole("button", { name: "下書きを生成する" }));

    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 3);
    expect(screen.getByText("er-section")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "テーブル定義" })).toBeInTheDocument();
    expect(screen.getByLabelText("F-01 × users")).toBeInTheDocument();
    expect(screen.getByLabelText("F-01 × projects")).toBeInTheDocument();
  });

  it("CRUD 図を編集すると保存でき、保存するまで生成できない", async () => {
    const user = userEvent.setup();
    const onDirtyChange = renderPanel(
      setup({ state: "draft", version: 1, model: { cells: [] } }),
    );

    fireEvent.change(screen.getByLabelText("F-01 × users"), { target: { value: "c" } });

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: "下書きを生成する" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "CRUD 図を保存する" }));
    const [, stage, model] = vi.mocked(useDetailedDesignStore.getState().save).mock.calls[0];
    expect(stage).toBe(3);
    expect(model).toEqual({
      cells: [{ function_id: "F-01", table: "users", ops: "C", draft: false }],
    });
  });

  it("内容があれば作り直しの確認を出してから生成する", async () => {
    const user = userEvent.setup();
    renderPanel(setup({ state: "approved", version: 2, model: makeCrud("C", true) }));

    await user.click(screen.getByRole("button", { name: "下書きを作り直す" }));
    expect(useDetailedDesignStore.getState().generate).not.toHaveBeenCalled();
    expect(await screen.findByText(/CRUD 図で確定したセルは失われ/)).toBeInTheDocument();
    expect(screen.getByText(/段階の承認もやり直しになります/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("作り直す"));

    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 3);
  });

  it("生成中は表を出さず、ER のエディタの未保存の編集も段階の dirty に含める", () => {
    const onDirtyChange = renderPanel(
      setup({ state: "draft", version: 1, generation_status: "generating", model: makeCrud() }),
    );

    expect(screen.getByRole("button", { name: "生成中" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("CRUD 図: 生成中")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "テーブル定義" })).not.toBeInTheDocument();
    expect(sectionProps.last?.generating).toBe(true);

    act(() => (sectionProps.last?.onDirtyChange as (dirty: boolean) => void)(true));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("失敗の理由と検証の結果を出す(ER の未承認は一覧に出さない)。ER のエディタが ER でなければ表は出さない", () => {
    useUmlEditorStore.setState({ diagram: makeDiagram(), model: null });
    renderPanel(
      setup({
        state: "draft",
        version: 1,
        model: makeCrud("C", true),
        generation_status: "failed",
        generation_error: "AIの利用上限に達したため、下書きを作れませんでした。",
        issues: [
          { severity: "error", code: "ER_NOT_APPROVED", message: "ER が承認されていません。", target: null },
          { severity: "warning", code: "DRAFT_CELLS", message: "AI の下書きのままのセルが 1 個あります。", target: null },
        ],
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("AIの利用上限");
    expect(screen.queryByText(/ER が承認されていません/)).not.toBeInTheDocument();
    expect(screen.getByText(/下書きのままのセル/)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "テーブル定義" })).not.toBeInTheDocument();
    // ER が読めなくても、セルのあるテーブルは CRUD 図の列に出す
    expect(screen.getByLabelText("F-01 × reservations")).toHaveValue("C");
  });
});
