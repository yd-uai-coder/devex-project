// 作成：Phase-19-7
// 写経レベル: 定型
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { StageDiagramSection } from "../StageDiagramSection";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { listDiagrams } from "@/features/uml/api/umlApi";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";
import { ER_MODEL, makeDiagram } from "@/features/uml/test-utils/umlFixtures";

// SUT: StageDiagramSection(段階4の構成図として使う形) / ドライバ: render とエディタのストアの書き換え /
// スタブ: listDiagrams(図の一覧の API)・UmlDiagramEditor(エディタ本体は UmlDiagramPageContent.test.tsx
// で検証する)・fetchStages(段階の一覧の取り直し)。ER として使う形は ErEditorSection.test.tsx で見る。
vi.mock("@/features/uml/components/UmlDiagramEditor", () => ({
  UmlDiagramEditor: ({ diagramId }: { diagramId: string }) => <div>editor:{diagramId}</div>,
}));
vi.mock("@/features/uml/api/umlApi", () => ({ listDiagrams: vi.fn() }));

const component = makeDiagram({ id: "c1", subject: "" });

function renderSection(generating = false, onDirtyChange = vi.fn()) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <StageDiagramSection
        projectId="p1"
        notation="component"
        subject=""
        title="構成図"
        generating={generating}
        onDirtyChange={onDirtyChange}
      />
    </TamaguiProvider>,
  );
  return onDirtyChange;
}

describe("StageDiagramSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDetailedDesignStore.setState({ fetchStages: vi.fn().mockResolvedValue(undefined) });
    useUmlEditorStore.setState({ diagram: null, dirty: false });
  });

  it("指定した記法・対象の図だけを開く", async () => {
    vi.mocked(listDiagrams).mockResolvedValue([
      makeDiagram({ id: "c2", subject: "部分" }),
      makeDiagram({ id: "e1", notation: "er", view: "data", semantic_model: ER_MODEL }),
      component,
    ]);
    renderSection();

    expect(await screen.findByText("editor:c1")).toBeInTheDocument();
    expect(screen.getByText("構成図(下書き)")).toBeInTheDocument();
  });

  it("図が無ければ図の名前で案内を出し、生成中は一覧を読まない", async () => {
    vi.mocked(listDiagrams).mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText(/^構成図はまだありません/)).toBeInTheDocument();

    vi.mocked(listDiagrams).mockClear();
    renderSection(true);
    expect(screen.getByText(/終わるまで 構成図は編集できません/)).toBeInTheDocument();
    expect(listDiagrams).not.toHaveBeenCalled();
  });

  it("エディタの未保存の編集を伝え、図の状態が変わったら段階の一覧を取り直す", async () => {
    vi.mocked(listDiagrams).mockResolvedValue([component]);
    const onDirtyChange = renderSection();
    await screen.findByText("editor:c1");

    act(() => useUmlEditorStore.setState({ diagram: component, dirty: true }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    act(() => useUmlEditorStore.setState({ diagram: { ...component, status: "approved" }, dirty: false }));

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(useDetailedDesignStore.getState().fetchStages).toHaveBeenCalledWith("p1");
    expect(screen.getByText("構成図(承認済み)")).toBeInTheDocument();
  });
});
