// 作成：Phase-29-4
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ProcedureSequenceView } from "../ProcedureSequenceView";
import { getProcedureSequence } from "@/features/detailed-design/api/designStagesApi";

// SUT: ProcedureSequenceView(と SequenceSvg) / ドライバ: render /
// スタブ: シーケンス図の API(getProcedureSequence。保存した手順から devex-api が導いた SVG と指摘を返す)。

vi.mock("@/features/detailed-design/api/designStagesApi", () => ({
  getProcedureSequence: vi.fn(),
}));

function renderView(props: { version?: number | null; dirty?: boolean } = {}) {
  const ui = (version: number | null, dirty: boolean) => (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ProcedureSequenceView projectId="p1" functionId="F-01" version={version} dirty={dirty} />
    </TamaguiProvider>
  );
  const view = render(ui(props.version ?? 1, props.dirty ?? false));
  return { rerender: (version: number) => view.rerender(ui(version, false)) };
}

describe("ProcedureSequenceView", () => {
  beforeEach(() => {
    vi.mocked(getProcedureSequence).mockReset();
  });

  it("SVG をそのまま埋め込み、図にするときの指摘を並べる", async () => {
    vi.mocked(getProcedureSequence).mockResolvedValue({
      function_id: "F-01",
      svg: '<svg data-testid="sequence"><text>1: post</text></svg>',
      issues: [{ step_id: "F-01#2", code: "RETURN_AS_CALL", message: "戻りを呼び出しとして書いています" }],
    });
    renderView();

    expect(screen.getByText("シーケンス図を読み込み中...")).toBeInTheDocument();
    expect(await screen.findByTestId("sequence")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "F-01 のシーケンス図" })).toContainElement(
      screen.getByTestId("sequence"),
    );
    expect(screen.getByText("F-01#2: 戻りを呼び出しとして書いています")).toBeInTheDocument();
  });

  it("保存していない編集があれば、保存すると図に反映されると出す", async () => {
    vi.mocked(getProcedureSequence).mockResolvedValue({ function_id: "F-01", svg: "<svg/>", issues: [] });
    renderView({ dirty: true });

    expect(await screen.findByRole("img", { name: "F-01 のシーケンス図" })).toBeInTheDocument();
    expect(screen.getByText(/保存していない編集は、保存すると図に反映されます/)).toBeInTheDocument();
  });

  it("段階の版が変わる(保存した)と取り直す", async () => {
    vi.mocked(getProcedureSequence).mockResolvedValue({ function_id: "F-01", svg: "<svg/>", issues: [] });
    const { rerender } = renderView({ version: 1 });
    await screen.findByRole("img", { name: "F-01 のシーケンス図" });

    rerender(2);

    await screen.findByRole("img", { name: "F-01 のシーケンス図" });
    expect(getProcedureSequence).toHaveBeenCalledTimes(2);
  });

  it("取得に失敗したら理由を出す", async () => {
    vi.mocked(getProcedureSequence).mockRejectedValue(new Error("段階5が開いていません"));
    renderView();

    expect(await screen.findByRole("alert")).toHaveTextContent("段階5が開いていません");
  });
});
