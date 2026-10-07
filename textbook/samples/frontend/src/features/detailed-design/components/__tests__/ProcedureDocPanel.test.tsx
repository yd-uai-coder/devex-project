// 作成：Phase-27-3
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

// SUT: ProcedureDocPanel / ドライバ: render と操作 / スタブ: 段階のストアの jumpTo。
// 単位の一覧は、ストアに置いた段階7の内容(makePlan)から作る。

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
    8: { is_open: true, missing_inputs: [], ...patch },
  });
  useDetailedDesignStore.setState({ stages });
  return stages[7];
}

function renderPanel(stage: DesignStageRead) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ProcedureDocPanel stage={stage} />
    </TamaguiProvider>,
  );
}

describe("ProcedureDocPanel", () => {
  beforeEach(() => {
    useDetailedDesignStore.setState({ jumpTo: vi.fn() });
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
});
