// 作成：Phase-54-3
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { StageSendbackPanel } from "../StageSendbackPanel";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { makeFunctionList, makeModuleList, makeProcedures, makeStages } from "@/features/detailed-design/test-utils/stageFixtures";
import { useReviewStore } from "@/features/design-review/review-store";
import { finding, gate, run, user } from "@/features/design-review/test-utils/reviewFixtures";

// SUT: StageSendbackPanel(差し戻しのボタンとダイアログ)/ ドライバ: render と操作 / スタブ: 詳細設計の
// ストアの generate・selectStage(生成を呼ばずに、呼ばれ方を確かめる)。

function renderPanel() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <StageSendbackPanel projectId="p1" />
    </TamaguiProvider>,
  );
}

const STAGES = makeStages({
  1: { model: makeFunctionList(), is_open: true },
  4: { model: makeModuleList(), is_open: true, missing_inputs: [] },
  5: { model: makeProcedures(), is_open: true, missing_inputs: [] },
});

function stage6Gate(findings: ReturnType<typeof finding>[]) {
  return gate({ gate: "stage6", status: "reviewed", run: run({ gate: "stage6", findings }) });
}

describe("StageSendbackPanel", () => {
  beforeEach(() => {
    useDetailedDesignStore.setState({
      stages: STAGES,
      requestingGeneration: false,
      generate: vi.fn().mockResolvedValue(undefined),
      selectStage: vi.fn(),
    });
    useReviewStore.setState({ me: user(), gates: [] });
  });

  it("採用した設計・不整合の指摘が無い・レビューがオフなら出さない", () => {
    useReviewStore.setState({
      gates: [stage6Gate([finding({ decision: "adopted", cause: "hearing" }), finding({ decision: "pending" })])],
    });
    renderPanel();
    expect(screen.queryByRole("button", { name: /採用した指摘で段階を作り直す/ })).not.toBeInTheDocument();
  });

  it("未対応の指摘を選び、対象から推定した段階を作り直す", async () => {
    useReviewStore.setState({
      gates: [
        stage6Gate([
          finding({ id: "mod", decision: "adopted", followup: "unaddressed", targets: ["app/api/routes/reservations.py"], problem: "依存の向きが逆" }),
          finding({ id: "done", decision: "adopted", followup: "changed", targets: ["F-01"], problem: "直した" }),
        ]),
        // 文書の区切りの指摘はプレビューで直すので出さない
        gate({ status: "reviewed", run: run({ findings: [finding({ id: "doc", decision: "adopted", problem: "文書の指摘" })] }) }),
      ],
    });
    const u = userEvent.setup();
    renderPanel();

    await u.click(screen.getByRole("button", { name: "採用した指摘で段階を作り直す(2件)" }));
    expect(screen.queryByLabelText(/文書の指摘/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/依存の向きが逆/)).toBeChecked();
    expect(screen.getByLabelText(/直した/)).not.toBeChecked();
    expect(screen.getByLabelText("段階4-ソフトウェア構造")).toBeChecked();
    await u.click(screen.getByLabelText("作り直す"));

    expect(useDetailedDesignStore.getState().selectStage).toHaveBeenCalledWith(4);
    expect(useDetailedDesignStore.getState().generate).toHaveBeenCalledWith("p1", 4, undefined, undefined, undefined, ["mod"]);
  });

  it("部分再生成の段階で行が決まらなければ、作り直さずに知らせる", async () => {
    useReviewStore.setState({
      gates: [stage6Gate([finding({ id: "req", decision: "adopted", followup: "unaddressed", targets: ["FR-001"] })])],
    });
    const u = userEvent.setup();
    renderPanel();

    await u.click(screen.getByRole("button", { name: /採用した指摘で段階を作り直す/ }));
    await u.click(screen.getByLabelText(/段階5-/));
    await u.click(screen.getByLabelText("作り直す"));

    expect(useDetailedDesignStore.getState().generate).not.toHaveBeenCalled();
    // ダイアログの中は jsdom ではロールのクエリで「隠れている」扱いになるため、文で取る
    expect(screen.getByText(/段階5で作り直す行を、選んだ指摘の対象から決められません。/)).toBeInTheDocument();
  });
});
