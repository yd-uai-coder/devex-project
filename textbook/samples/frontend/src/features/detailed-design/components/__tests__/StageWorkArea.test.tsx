// 作成：Phase-15-7｜更新：Phase-16-6,17-6,18-9,19-7,20-7,21-7,21-7(画面確認後の修正),23-6,44-2,44(完了後の調整),69-4
// 写経レベル: コア ── 状態ごとのボタンと表示。
// Phase-16-6:追記 ── ../../test-utils/stageFixtures.makeFunctionList
// Phase-17-6:追記 ── @/features/detailed-design/detailed-design-store.useDetailedDesignStore
// Phase-20-7:追記 ── ../../test-utils/stageFixtures.makeModuleList
// Phase-21-7:追記 ── ../../test-utils/stageFixtures.makeProcedures
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { StageWorkArea } from "../StageWorkArea";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import {
  makeFunctionList,
  makeModuleList,
  makeProcedures,
  makeStages,
} from "../../test-utils/stageFixtures";
import type { DesignStageRead } from "@/features/detailed-design/api/types";

function renderArea(
  stage: DesignStageRead,
  onApprove = vi.fn(),
  actionError: string | null = null,
) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <StageWorkArea
        // Phase-16-6:追記
        projectId="p1"
        stage={stage}
        approving={false}
        actionError={actionError}
        onApprove={onApprove}
      />
    </TamaguiProvider>,
  );
  return onApprove;
}

describe("StageWorkArea", () => {
  // Phase-17-6:追記
  it("開いた段階2には、データフローのパネルを出す", () => {
    const stages = makeStages({
      1: { state: "approved", version: 2, approved_version: 2, model: makeFunctionList() },
      2: { is_open: true, missing_inputs: [] },
    });
    useDetailedDesignStore.setState({ stages });
    renderArea(stages[1]);

    expect(screen.getByText("DFD を描く機能グループ")).toBeInTheDocument();
    expect(screen.queryByText(/準備中/)).not.toBeInTheDocument();
  });

  // Phase-18-9:追記
  it("開いた段階3には、データモデルのパネルを出す", () => {
    const stages = makeStages({
      1: { state: "approved", version: 2, approved_version: 2, model: makeFunctionList() },
      2: { state: "approved", version: 3, approved_version: 3 },
      3: { is_open: true, missing_inputs: [] },
    });
    useDetailedDesignStore.setState({ stages });
    renderArea(stages[2]);

    expect(screen.getByText("CRUD 図")).toBeInTheDocument();
    expect(screen.queryByText(/準備中/)).not.toBeInTheDocument();
  });

  // Phase-19-7:追記
  it("開いた段階4には、ソフトウェア構造のパネルを出す", () => {
    const stages = makeStages({
      1: { state: "approved", version: 2, approved_version: 2, model: makeFunctionList() },
      2: { state: "approved", version: 3, approved_version: 3 },
      3: { state: "approved", version: 1, approved_version: 1 },
      4: { is_open: true, missing_inputs: [] },
    });
    useDetailedDesignStore.setState({ stages });
    renderArea(stages[3]);

    expect(screen.getByText("モジュール一覧")).toBeInTheDocument();
    expect(screen.queryByText(/準備中/)).not.toBeInTheDocument();
  });

  // Phase-20-7:追記
  // Phase-21-7：更新(段階6にもパネルを登録したので、テスト名から「段階6はまだ準備中」を外した)
  // it("開いた段階5には主要処理の手順のパネルを出し、段階6はまだ準備中", () => {
  // ↓↓
  it("開いた段階5には主要処理の手順のパネルを出す", () => {
  // ── ここから Phase-20-7 の作成分 ──
    const stages = makeStages({
      1: { state: "approved", version: 2, approved_version: 2, model: makeFunctionList() },
      2: { state: "approved", version: 3, approved_version: 3 },
      3: { state: "approved", version: 1, approved_version: 1 },
      4: { state: "approved", version: 1, approved_version: 1, model: makeModuleList() },
      5: { is_open: true, missing_inputs: [] },
      6: { is_open: true, missing_inputs: [] },
    });
    useDetailedDesignStore.setState({ stages });
    renderArea(stages[4]);

    expect(screen.getByText("手順を書く処理")).toBeInTheDocument();
    expect(screen.queryByText(/準備中/)).not.toBeInTheDocument();
  });

  // Phase-21-7:追記
  it("開いた段階6には処理ロジックのパネルを出し、「飛ばす」から承認を始められる", async () => {
    const user = userEvent.setup();
    const stages = makeStages({
      5: { state: "approved", version: 1, approved_version: 1, model: makeProcedures() },
      6: { is_open: true, missing_inputs: [] },
    });
    useDetailedDesignStore.setState({ stages, save: vi.fn().mockResolvedValue(true) });
    const onApprove = renderArea(stages[5]);

    expect(screen.getByText("詳細を書く関数")).toBeInTheDocument();
    // Phase-21-7：更新(画面確認後の修正。保存の操作が上下2つになったので先頭を取る)
    // await user.click(screen.getByRole("button", { name: "段階6を飛ばす(06を書かない)" }));
    // ↓↓
    await user.click(screen.getAllByRole("button", { name: "段階6を飛ばす(06を書かない)" })[0]);
    // ── ここから Phase-21-7 の作成分 ──
    await user.click(screen.getByLabelText("飛ばして承認する"));

    expect(useDetailedDesignStore.getState().save).toHaveBeenCalledWith("p1", 6, { logics: [] });
    expect(onApprove).toHaveBeenCalled();
  });

  // ── ここから Phase-15-7 の作成分 ──
  // Phase-23-6：更新
  // it("登録の無い段階は、開いていれば準備中を出す", () => {
  // ↓↓
  it("開いた段階7には、横断事項と実装計画のパネルを出す(全段階にパネルがある)", () => {
    // Phase-21-7：更新(段階6にもパネルを登録したので、登録の無い例を段階7にした)
    // const stages = makeStages({ 6: { is_open: true, missing_inputs: [] } });
    // renderArea(stages[5]);
    // ↓↓
    const stages = makeStages({ 7: { is_open: true, missing_inputs: [] } });
    renderArea(stages[6]);
    // ── ここから Phase-15-7 の作成分 ──

    // Phase-23-6：更新
    // expect(screen.getByText(/準備中/)).toBeInTheDocument();
    // ↓↓
    expect(screen.getByText("07 横断事項")).toBeInTheDocument();
    expect(screen.queryByText(/準備中/)).not.toBeInTheDocument();
  });

  // ── ここから Phase-15-7 の作成分 ──
  it("開いていない段階は、足りない入力を示し、承認できない", () => {
    const [, stage2] = makeStages();
    renderArea(stage2);

    expect(screen.getByText(/段階1\(機能一覧\)の承認/)).toBeInTheDocument();
    // Tamagui の Button の disabled は aria-disabled で表される
    expect(screen.getByRole("button", { name: "承認する" })).toHaveAttribute("aria-disabled", "true");
  });

  it("レビュー中の段階は承認できる", async () => {
    // Phase-16-6：更新
    // const [stage1] = makeStages({ 1: { state: "reviewing", version: 2 } });
    // ↓↓
    const [stage1] = makeStages({
      1: { state: "reviewing", version: 2, model: makeFunctionList() },
    });
    const user = userEvent.setup();
    const onApprove = renderArea(stage1);

    await user.click(screen.getByRole("button", { name: "承認する" }));

    expect(onApprove).toHaveBeenCalled();
  });

  it("古い段階は理由を示し、「このまま承認し直す」にする", () => {
    const [stage1] = makeStages({
      // Phase-16-6：更新
      // 1: { state: "outdated", version: 2, approved_version: 2 },
      // ↓↓
      1: {
        state: "outdated",
        version: 2,
        approved_version: 2,
        model: makeFunctionList(),
      },
    });
    renderArea(stage1);

    expect(screen.getByRole("status")).toHaveTextContent(
      "入力(前の段階または文書)が変わりました",
    );
    expect(
      screen.getByRole("button", { name: "このまま承認し直す" }),
    ).toBeEnabled();
  });

  // Phase-69-4:追記
  it("差し戻しで作り直した段階にエラーがあれば、承認の横に理由とエラーへのリンク、渡した指摘を出す", () => {
    const [stage1] = makeStages({
      1: {
        state: "regenerated",
        version: 3,
        model: makeFunctionList(),
        issues: [{ severity: "error", code: "DUPLICATE_GROUP", message: "グループが重なっています", target: "g1" }],
        generation_findings: [
          { id: "f1", level: "critical", targets: ["F-02"], problem: "予約の取消の処理が無い" },
        ],
      },
    });
    useDetailedDesignStore.setState({ stages: [stage1] });
    renderArea(stage1);

    expect(screen.getByRole("button", { name: "承認する" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status", { name: "承認できない理由" })).toHaveTextContent(
      "検証のエラーが1件あるため承認できません。",
    );
    expect(screen.getByRole("link", { name: "検証の結果へ" })).toHaveAttribute("href", "#stage-issue-list");
    expect(screen.getByLabelText("この作り直しで渡した指摘")).toHaveTextContent(
      "[最重要] 対象: F-02 ── 予約の取消の処理が無い",
    );
  });

  it("承認の失敗を表示する", () => {
    const [stage1] = makeStages({ 1: { state: "reviewing", version: 2 } });
    renderArea(stage1, vi.fn(), "承認に失敗しました");

    expect(screen.getByRole("alert")).toHaveTextContent("承認に失敗しました");
  });

  // Phase-44-2:追記
  it("変更の影響の印の件数を出し、未確認があれば承認し直しの前に確認済みにするよう案内する", () => {
    const stages = makeStages({
      1: { state: "outdated", version: 2, approved_version: 2, model: makeFunctionList(), impact_open: 1, impact_reviewed: 2 },
    });
    useDetailedDesignStore.setState({ stages });
    renderArea(stages[0]);

    expect(screen.getByText("変更の影響: 見直し 1 / 確認済み 2")).toBeInTheDocument();
    expect(screen.getByText(/確認済みにしてから承認し直してください/)).toBeInTheDocument();
  });

  // Phase-44(完了後の調整):追記
  it("閉じた段階に保存した内容があれば、消えていないことと承認し直す段階を示し、その段階へ移れる", async () => {
    const user = userEvent.setup();
    const selectStage = vi.fn();
    // 段階4は版が上がって承認済み、段階5は「古い」(開いている)、段階6は段階5が承認済みでないので閉じている
    const stages = makeStages({
      4: { state: "approved", version: 8, approved_version: 8, is_open: true, missing_inputs: [] },
      5: { state: "outdated", version: 4, approved_version: 4, is_open: true, missing_inputs: [] },
      6: { state: "outdated", version: 17, approved_version: 17, is_open: false, missing_inputs: ["stage:5"] },
      7: { state: "outdated", version: 8, is_open: false, missing_inputs: ["stage:5", "stage:6"] },
    });
    useDetailedDesignStore.setState({ stages, selectStage });
    renderArea(stages[6]);

    expect(screen.getByText(/この段階には保存した内容があります\(消えていません\)/)).toHaveTextContent(
      "段階5(古い)を承認し直すと、表示・編集できます。",
    );
    await user.click(screen.getByRole("button", { name: "段階5へ移る" }));
    expect(selectStage).toHaveBeenCalledWith(5);
  });

  it("閉じた段階に内容が無ければ、今までどおり始め方だけを出す", () => {
    const stages = makeStages();
    useDetailedDesignStore.setState({ stages });
    renderArea(stages[2]);

    expect(screen.getByText("前の段階を承認すると、この段階を始められます。")).toBeInTheDocument();
    expect(screen.queryByText(/保存した内容があります/)).not.toBeInTheDocument();
  });
});
