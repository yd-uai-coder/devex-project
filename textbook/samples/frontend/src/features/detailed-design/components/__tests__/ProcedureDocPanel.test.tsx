// 作成：Phase-27-3｜更新：Phase-28-3,28-4,31-5
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ProcedureDocPanel } from "../ProcedureDocPanel";
import { StageWorkArea } from "../StageWorkArea";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { makePlan, makeProcedureDoc, makeStages } from "../../test-utils/stageFixtures";
import type { DesignStageRead, StageIssue } from "@/features/detailed-design/api/types";

// Phase-28-3：更新
// // SUT: ProcedureDocPanel / ドライバ: render と操作 / スタブ: 段階のストアの jumpTo。
// ↓↓
// SUT: ProcedureDocPanel / ドライバ: render と操作 / スタブ: 段階のストアの jumpTo・save・generate・
// fetchStages と、単位の詳細が読む参照の API(getUnitContext)。
// 単位の一覧は、ストアに置いた段階7の内容(makePlan)から作る。

// Phase-28-4:追記
vi.mock("@/features/detailed-design/api/designStagesApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/detailed-design/api/designStagesApi")>()),
  getUnitContext: vi.fn().mockResolvedValue({
    unit_id: "M-01-T02",
    refs: [],
    crosscutting: "",
    environment: "",
  }),
}));

const noProcedure: StageIssue = {
  severity: "warning",
  code: "NO_PROCEDURE",
  message: "M-01-T02 の処理 F-01 に、段階5の手順がありません。",
  target: "F-01",
  level: "major",
  fix_stage: 5,
  unit: "M-01-T02",
};

// 段階1〜7を承認し、段階8が開いた一覧の段階8(内容は引数で上書きする)
function stage8(patch: Partial<DesignStageRead>): DesignStageRead {
  const stages = makeStages({
    7: { state: "approved", model: makePlan() },
    // Phase-31-5：更新
    // 8: { is_open: true, missing_inputs: [], ...patch },
    // ↓↓
    8: { is_open: true, missing_inputs: [], plan: makePlan(), ...patch },
  });
  useDetailedDesignStore.setState({ stages });
  return stages[7];
}

function renderPanel(stage: DesignStageRead) {
  // Phase-28-3:追記
  const onDirtyChange = vi.fn();
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {/* Phase-28-3：更新
      <ProcedureDocPanel stage={stage} />
      ↓↓ */}
      <ProcedureDocPanel projectId="p1" stage={stage} onDirtyChange={onDirtyChange} />
    </TamaguiProvider>,
  );
  // Phase-28-3:追記
  return onDirtyChange;
}

describe("ProcedureDocPanel", () => {
  beforeEach(() => {
    // Phase-28-3：更新
    // useDetailedDesignStore.setState({ jumpTo: vi.fn() });
    // ↓↓
    useDetailedDesignStore.setState({
      jumpTo: vi.fn(),
      saving: false,
      requestingGeneration: false,
      fetchStages: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(true),
      generate: vi.fn().mockResolvedValue(undefined),
      tabs: {},
    });
  });

  it("段階7の単位を依存順に並べ、手順書の有無と未定義の件数を出す", () => {
    renderPanel(stage8({ issues: [noProcedure], model: makeProcedureDoc(), version: 1 }));

    const rows = within(screen.getByRole("table", { name: "単位の一覧" })).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent("M-01-T01基盤開発環境を用意する—");
    expect(rows[1]).toHaveTextContent("未生成なし");
    expect(rows[2]).toHaveTextContent("M-01-T02機能予約を登録するF-01M-01-T01生成済");
    expect(rows[2]).toHaveTextContent("最重要 1中程度 1");
  });

  it("重要度で絞り込み、「段階Nで直す」で対象の段階へ移る", async () => {
    const user = userEvent.setup();
    renderPanel(stage8({ issues: [noProcedure], model: makeProcedureDoc(), version: 1 }));

    const table = () => screen.getByRole("table", { name: "未定義・要決定" });
    expect(within(table()).getAllByRole("row")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "中程度(1)" }));
    expect(within(table()).getAllByRole("row")).toHaveLength(2);
    expect(table()).toHaveTextContent("中程度検証M-01-T02F-01");

    await user.click(screen.getByRole("button", { name: "段階5で直す" }));
    expect(useDetailedDesignStore.getState().jumpTo).toHaveBeenCalledWith(5, "F-01");
  });

  it("手順書がまだ無くても指摘を出し、手順書そのもののエラーは検証の結果に出す", () => {
    const mismatch: StageIssue = {
      severity: "error",
      code: "UNIT_MISMATCH",
      message: "手順書の単位 M-09-T01 が、段階7にありません。",
      target: "M-09-T01",
      level: null,
      fix_stage: 8,
      unit: "M-09-T01",
    };
    renderPanel(stage8({ issues: [noProcedure, mismatch] }));

    expect(screen.getByRole("button", { name: "すべて(1)" })).toBeInTheDocument();
    expect(screen.getByLabelText("検証の結果")).toHaveTextContent("エラー: 手順書の単位 M-09-T01");
  });

  it("作業領域は段階8にこのパネルを出す", () => {
    const stage = stage8({});
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <StageWorkArea projectId="p1" stage={stage} approving={false} actionError={null} onApprove={vi.fn()} />
      </TamaguiProvider>,
    );

    expect(screen.getByText("段階8 実装手順書")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "単位の一覧" })).toBeInTheDocument();
    expect(screen.getByText("未定義・要決定はありません。")).toBeInTheDocument();
  });

  // Phase-28-3:追記
  it("選んだ単位の手順書を生成する(手順書の無い単位はそのまま)", async () => {
    const user = userEvent.setup();
    renderPanel(stage8({ model: makeProcedureDoc(), version: 1 }));

    const button = screen.getByRole("button", { name: "選んだ単位の手順書を生成する(0/5)" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByLabelText("M-01-T01 を生成する"));
    await user.click(screen.getByRole("button", { name: "選んだ単位の手順書を生成する(1/5)" }));

    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith(
      "p1",
      8,
      undefined,
      undefined,
      ["M-01-T01"],
    );
  });

  it("手順書のある単位を選んだときは、作り直しを確かめてから生成する", async () => {
    const user = userEvent.setup();
    renderPanel(stage8({ model: makeProcedureDoc(), version: 1 }));

    await user.click(screen.getByLabelText("M-01-T02 を生成する"));
    await user.click(screen.getByRole("button", { name: "選んだ単位の手順書を生成する(1/5)" }));
    expect(useDetailedDesignStore.getState().generate).not.toHaveBeenCalled();
    expect(await screen.findByText(/M-01-T02 の手順書を作り直します/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("作り直す"));

    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith(
      "p1",
      8,
      undefined,
      undefined,
      ["M-01-T02"],
    );
  });

  // Phase-28-4:追記
  it("単位の詳細を開いて編集すると保存でき、保存するまで生成できない", async () => {
    const user = userEvent.setup();
    const onDirtyChange = renderPanel(stage8({ model: makeProcedureDoc(), version: 1 }));

    await user.click(screen.getByLabelText("M-01-T02 の詳細を開く"));
    await user.clear(screen.getByLabelText("目的"));
    await user.type(screen.getByLabelText("目的"), "直した");
    await user.click(screen.getByLabelText("M-01-T01 を生成する"));

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(
      screen.getByRole("button", { name: "選んだ単位の手順書を生成する(1/5)" }),
    ).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getAllByRole("button", { name: "保存する" })[0]);
    const [projectId, stage, model] = vi.mocked(useDetailedDesignStore.getState().save).mock.calls[0];
    expect([projectId, stage]).toEqual(["p1", 8]);
    expect((model as { units: { purpose: string }[] }).units[0].purpose).toBe("直した");
    expect(useDetailedDesignStore.getState().tabs["8:unit"]).toBe("M-01-T02");
  });

  // Phase-28-3:追記
  it("生成に失敗したら理由を出す", () => {
    renderPanel(stage8({ generation_status: "failed", generation_error: "下書きの生成に失敗しました。" }));

    expect(screen.getByRole("alert")).toHaveTextContent("下書きの生成に失敗しました。");
  });

  // Phase-31-5:追記
  it("簡易モードは段階8の plan(実装計画書の WBS)の単位を出し、直す先の文書の画面へのリンクを出す", () => {
    const wbsIssue: StageIssue = {
      severity: "warning",
      code: "UNKNOWN_DATAFLOW",
      message: "M-01-T02 の処理 DF-9 が、内部設計書の処理別データフローにありません。",
      target: "DF-9",
      level: "major",
      fix_stage: 8,
      unit: "M-01-T02",
      fix_document: "implementation_plan",
    };
    useDetailedDesignStore.setState({ stages: [] });
    const [simple] = makeStages({
      8: { mode: "simple", is_open: true, missing_inputs: [], plan: makePlan(), issues: [wbsIssue] },
    }).slice(7);
    renderPanel(simple);

    expect(screen.getByText(/実装計画書の WBSの作業単位です/)).toBeInTheDocument();
    const rows = within(screen.getByRole("table", { name: "単位の一覧" })).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(screen.getByRole("link", { name: "実装計画書を直す(再生成)" })).toHaveAttribute(
      "href",
      "/projects/p1/documents",
    );
    expect(screen.queryByRole("button", { name: /段階\dで直す/ })).not.toBeInTheDocument();
  });

  it("簡易モードで WBS から単位を読めなければ、再生成を促す", () => {
    const [simple] = makeStages({
      8: { mode: "simple", is_open: true, missing_inputs: [], plan: { milestones: [] } },
    }).slice(7);
    renderPanel(simple);

    expect(screen.getByRole("status")).toHaveTextContent("実装計画書の WBS から作業単位を読めませんでした");
  });
});
