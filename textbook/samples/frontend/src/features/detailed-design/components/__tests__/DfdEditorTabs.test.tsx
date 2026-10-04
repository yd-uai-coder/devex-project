// 作成：Phase-17-7
// 写経レベル: コア ── エディタと API を差し替え、開く図と取り直しの配線だけを見る。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DfdEditorTabs } from "../DfdEditorTabs";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { listDiagrams } from "@/features/uml/api/umlApi";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";
import { DFD_MODEL, makeDiagram } from "@/features/uml/test-utils/umlFixtures";

// エディタ本体は UmlDiagramPageContent.test.tsx で検証する。ここでは開く図だけを見る。
vi.mock("@/features/uml/components/UmlDiagramEditor", () => ({
  UmlDiagramEditor: ({ diagramId }: { diagramId: string }) => <div>editor:{diagramId}</div>,
}));
vi.mock("@/features/uml/api/umlApi", () => ({ listDiagrams: vi.fn() }));

const dfd = (id: string, subject: string, status: "draft" | "approved" = "draft") =>
  makeDiagram({ id, notation: "dfd", view: "dataflow", subject, semantic_model: DFD_MODEL, status });

function renderTabs(groups: string[], generating = false, onDirtyChange = vi.fn()) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DfdEditorTabs
        projectId="p1"
        groups={groups}
        generating={generating}
        onDirtyChange={onDirtyChange}
      />
    </TamaguiProvider>,
  );
  return onDirtyChange;
}

describe("DfdEditorTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listDiagrams).mockResolvedValue([
      dfd("d1", "予約"),
      dfd("d2", "備品", "approved"),
      makeDiagram({ id: "c1" }),
    ]);
    useDetailedDesignStore.setState({ fetchStages: vi.fn().mockResolvedValue(undefined) });
    useUmlEditorStore.setState({ diagram: null, dirty: false });
  });

  it("最初のグループの DFD を開き、タブで切り替える", async () => {
    const user = userEvent.setup();
    renderTabs(["予約", "備品"]);

    expect(await screen.findByText("editor:d1")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "予約(下書き)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("tab", { name: "備品(承認済み)" }));
    expect(screen.getByText("editor:d2")).toBeInTheDocument();
  });

  it("まだ DFD の無いグループは、生成を促す", async () => {
    renderTabs(["会計"]);

    expect(await screen.findByText(/「会計」の DFD はまだありません/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "会計(未生成)" })).toBeInTheDocument();
  });

  it("生成中は一覧を読まず、エディタを開かない", () => {
    renderTabs(["予約"], true);

    expect(screen.getByText(/終わるまで DFD は編集できません/)).toBeInTheDocument();
    expect(listDiagrams).not.toHaveBeenCalled();
  });

  it("開いている DFD の未保存の編集を知らせ、状態が変わったら段階の一覧を取り直す", async () => {
    useUmlEditorStore.setState({ diagram: dfd("d1", "予約"), dirty: true });
    const onDirtyChange = renderTabs(["予約"]);

    await screen.findByText("editor:d1");

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(useDetailedDesignStore.getState().fetchStages).toHaveBeenCalledWith("p1");
  });

  it("グループが無ければ何も出さない", () => {
    renderTabs([]);

    expect(screen.queryByText("機能グループの DFD")).not.toBeInTheDocument();
  });
});
