// 作成：Phase-18-9
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ErEditorSection } from "../ErEditorSection";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { listDiagrams } from "@/features/uml/api/umlApi";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";
import { ER_MODEL, makeDiagram } from "@/features/uml/test-utils/umlFixtures";

// SUT: ErEditorSection / ドライバ: render とエディタのストアの書き換え /
// スタブ: listDiagrams(図の一覧の API)・UmlDiagramEditor(エディタ本体は UmlDiagramPageContent.test.tsx
// で検証する)・fetchStages(段階の一覧の取り直し)。ここでは開く図と、状態の伝え方だけを見る。
vi.mock("@/features/uml/components/UmlDiagramEditor", () => ({
  UmlDiagramEditor: ({ diagramId }: { diagramId: string }) => <div>editor:{diagramId}</div>,
}));
vi.mock("@/features/uml/api/umlApi", () => ({ listDiagrams: vi.fn() }));

const er = makeDiagram({ id: "e1", notation: "er", view: "data", subject: "", semantic_model: ER_MODEL });

function renderSection(generating = false, onDirtyChange = vi.fn()) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ErEditorSection projectId="p1" generating={generating} onDirtyChange={onDirtyChange} />
    </TamaguiProvider>,
  );
  return onDirtyChange;
}

describe("ErEditorSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDetailedDesignStore.setState({ fetchStages: vi.fn().mockResolvedValue(undefined) });
    useUmlEditorStore.setState({ diagram: null, dirty: false });
  });

  it("全体の ER(subject が空)を開き、部分図や他の記法は開かない", async () => {
    vi.mocked(listDiagrams).mockResolvedValue([
      makeDiagram({ id: "e2", notation: "er", view: "data", subject: "部分" }),
      er,
      makeDiagram({ id: "c1" }),
    ]);
    renderSection();

    expect(await screen.findByText("editor:e1")).toBeInTheDocument();
    expect(screen.getByText("ER(下書き)")).toBeInTheDocument();
  });

  it("ER が無ければ案内を出し、生成中は一覧を読まない", async () => {
    vi.mocked(listDiagrams).mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText(/ER はまだありません/)).toBeInTheDocument();

    vi.mocked(listDiagrams).mockClear();
    renderSection(true);
    expect(screen.getByText(/終わるまで ER は編集できません/)).toBeInTheDocument();
    expect(listDiagrams).not.toHaveBeenCalled();
  });

  it("エディタの未保存の編集を伝え、図の状態が変わったら段階の一覧を取り直す", async () => {
    vi.mocked(listDiagrams).mockResolvedValue([er]);
    const onDirtyChange = renderSection();
    await screen.findByText("editor:e1");

    act(() => useUmlEditorStore.setState({ diagram: er, dirty: true }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    act(() => useUmlEditorStore.setState({ diagram: { ...er, status: "approved" }, dirty: false }));

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(useDetailedDesignStore.getState().fetchStages).toHaveBeenCalledWith("p1");
    expect(screen.getByText("ER(承認済み)")).toBeInTheDocument();
  });
});
