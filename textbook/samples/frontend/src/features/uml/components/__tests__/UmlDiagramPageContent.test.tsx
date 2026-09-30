// 作成：Phase-11-5｜更新：Phase-11-6,12-5
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { UmlDiagramPageContent } from "../UmlDiagramPageContent";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";
import { makeDiagram } from "@/features/uml/test-utils/umlFixtures";

// キャンバスは UmlCanvas.test.tsx で検証する。ここではツールバーと状態表示の配線だけを見る。
vi.mock("@/features/uml/components/UmlCanvas", () => ({ UmlCanvas: () => <div>canvas</div> }));
// Phase-11-6:追記
vi.mock("@/features/uml/components/ElementInspector", () => ({
  ElementInspector: () => <div>inspector</div>,
}));
// Phase-12-5:追記
vi.mock("@/features/uml/components/DiagramReviewActions", () => ({
  DiagramReviewActions: () => <div>review-actions</div>,
}));
vi.mock("@/features/uml/components/ValidationPanel", () => ({
  ValidationPanel: () => <div>validation</div>,
}));

function renderContent() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <UmlDiagramPageContent projectId="p1" diagramId="d1" />
    </TamaguiProvider>,
  );
}

describe("UmlDiagramPageContent", () => {
  beforeEach(() => {
    useUmlEditorStore.setState({
      diagram: makeDiagram(),
      status: "success",
      error: null,
      dirty: false,
      saving: false,
      layingOut: false,
      conflict: false,
      layoutNotice: null,
      load: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(true),
      runLayout: vi.fn().mockResolvedValue(undefined),
      // Phase-11-6:追記
      validating: false,
      // Phase-12-5:追記
      approving: false,
      exporting: false,
      addElement: vi.fn(),
      validate: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("マウント時に load(projectId, diagramId) を呼び、図の名前・状態・キャンバスを表示する", () => {
    renderContent();

    expect(useUmlEditorStore.getState().load).toHaveBeenCalledWith("p1", "d1");
    expect(screen.getByRole("heading", { name: "コンポーネント図(全体)" })).toBeInTheDocument();
    // Phase-12-5：更新
    // expect(screen.getByText("状態: 下書き")).toBeInTheDocument();
    // ↓↓
    // 状態表示と承認・出力は DiagramReviewActions.test.tsx で検証する
    expect(screen.getByText("review-actions")).toBeInTheDocument();
    expect(screen.getByText("canvas")).toBeInTheDocument();
  });

  it("未保存の変更があれば保存ボタンで save を呼ぶ", async () => {
    const user = userEvent.setup();
    useUmlEditorStore.setState({ dirty: true });
    renderContent();

    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(useUmlEditorStore.getState().save).toHaveBeenCalled();
    expect(screen.getByText("未保存の変更があります")).toBeInTheDocument();
  });

  it("自動レイアウトは確認してから実行し、キャンセルしたら実行しない", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderContent();

    await user.click(screen.getByRole("button", { name: "自動レイアウト" }));
    expect(useUmlEditorStore.getState().runLayout).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "自動レイアウト" }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(useUmlEditorStore.getState().runLayout).toHaveBeenCalledTimes(1);
  });

  it("競合したら理由と再読み込みボタンを表示し、再読み込みで load し直す", async () => {
    const user = userEvent.setup();
    useUmlEditorStore.setState({ conflict: true });
    renderContent();

    await user.click(screen.getByRole("button", { name: "再読み込み" }));

    expect(screen.getByRole("alert")).toHaveTextContent("他の画面または再生成で更新されました");
    expect(useUmlEditorStore.getState().load).toHaveBeenCalledTimes(2);
  });

  it("自動レイアウトできなかった理由を表示する", () => {
    useUmlEditorStore.setState({ layoutNotice: "自動レイアウトできませんでした: 上限超過" });
    renderContent();

    expect(screen.getByText("自動レイアウトできませんでした: 上限超過")).toBeInTheDocument();
  });

  // Phase-11-6:追記
  it("属性パネルと検証パネルを配置し、検証ボタンで validate を呼ぶ", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByRole("button", { name: "検証" }));

    expect(screen.getByText("inspector")).toBeInTheDocument();
    expect(screen.getByText("validation")).toBeInTheDocument();
    expect(useUmlEditorStore.getState().validate).toHaveBeenCalled();
  });

  it("記法に合った要素の追加ボタンを出す(DFD は3種類)", async () => {
    const user = userEvent.setup();
    useUmlEditorStore.setState({ diagram: makeDiagram({ notation: "dfd", subject: "ログイン" }) });
    renderContent();

    await user.click(screen.getByRole("button", { name: "データストアを追加" }));

    expect(screen.getByRole("button", { name: "処理を追加" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "モジュールを追加" })).not.toBeInTheDocument();
    expect(useUmlEditorStore.getState().addElement).toHaveBeenCalledWith("data_store");
  });
});
