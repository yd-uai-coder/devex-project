// 作成：Phase-23-6｜更新：Phase-26-5
// 写経レベル: 定型 ── 表の操作の確認。
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { CrossCuttingTable, MilestoneList, RiskTable } from "../PlanTables";
import { makePlan } from "../../test-utils/stageFixtures";
import type { PlanModel } from "@/features/detailed-design/api/types";

// SUT: CrossCuttingTable / MilestoneList / RiskTable(段階7の表)
// ドライバ: render と操作 / スタブ: onChange(vi.fn)── 表は編集した model を返すだけで、保存は
// 呼び出し元(PlanPanel)の責務のため。
function renderTables(model: PlanModel, onChange = vi.fn(), disabled = false) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <CrossCuttingTable model={model} disabled={disabled} onChange={onChange} />
      <MilestoneList model={model} disabled={disabled} onChange={onChange} />
      <RiskTable model={model} disabled={disabled} onChange={onChange} />
    </TamaguiProvider>,
  );
  return onChange;
}

const lastModel = (onChange: ReturnType<typeof vi.fn>): PlanModel =>
  onChange.mock.calls[onChange.mock.calls.length - 1][0];

describe("PlanTables", () => {
  // Phase-26-5:追記
  it("横断事項・マイルストーン(M-01)・単位(M-01-T01)・リスクを表に出す", () => {
    renderTables(makePlan());

    expect(screen.getByLabelText("例外と HTTP の方針")).toHaveValue("ドメイン例外を共通の形に変換する");
    expect(screen.getByLabelText("M-01 の名前")).toHaveValue("予約の登録");
    expect(screen.getByLabelText("M-01 の優先度")).toHaveValue("Must");
    // マイルストーンの処理はタスクから導いて見せるだけ
    expect(screen.getByLabelText("M-01 の処理")).toHaveTextContent("動くようにする処理: F-01");
    expect(screen.getByLabelText("M-01-T01 の種別")).toHaveValue("base");
    expect(screen.getByLabelText("M-01-T01 の環境・設定のファイル")).toHaveValue("Dockerfile");
    expect(screen.getByLabelText("M-01-T02 の種別")).toHaveValue("feature");
    expect(screen.getByLabelText("M-01-T02 の処理")).toHaveValue("F-01");
    expect(screen.getByLabelText("M-01-T02 の依存")).toHaveValue("M-01-T01");
    expect(screen.getByLabelText("M-01-T02 のモジュール")).toHaveValue("app/api/routes/reservations.py");
    expect(screen.getAllByRole("option", { name: "基盤" })).toHaveLength(2);
    expect(screen.getByLabelText("リスク1 の対策")).toHaveValue("一意制約で防ぐ");
    // 既定の項目はそろっているので、足すボタンは出ない
    expect(screen.queryByRole("button", { name: "「ログ」を追加" })).not.toBeInTheDocument();
  });

  it("欠けている既定の項目はボタンで足せる", async () => {
    const user = userEvent.setup();
    const plan = { ...makePlan(), crosscutting: [] };
    const onChange = renderTables(plan);

    await user.click(screen.getByRole("button", { name: "「ログ」を追加" }));

    expect(lastModel(onChange).crosscutting).toEqual([{ topic: "ログ", policy: "", modules: [] }]);
  });

  // Phase-26-5:追記
  it("マイルストーンの優先度・単位の種別を選び直し、タスクを足せる", async () => {
    const user = userEvent.setup();
    const onChange = renderTables(makePlan());

    await user.selectOptions(screen.getByLabelText("M-01 の優先度"), "Could");
    expect(lastModel(onChange).milestones[0].priority).toBe("Could");
    await user.selectOptions(screen.getByLabelText("M-01-T02 の種別"), "base");
    expect(lastModel(onChange).milestones[0].tasks[1].kind).toBe("base");
    await user.click(screen.getByRole("button", { name: "M-01 にタスクを追加" }));
    expect(lastModel(onChange).milestones[0].tasks).toHaveLength(3);
  });

  // Phase-26-5:追記
  it("単位を動かすと ID が振り直され、依存先も付け替わる(端のボタンは押せない)", async () => {
    const user = userEvent.setup();
    const onChange = renderTables(makePlan());

    expect(screen.getByLabelText("M-01-T01 を上へ")).toBeDisabled();
    expect(screen.getByLabelText("M-01-T02 を下へ")).toBeDisabled();
    await user.click(screen.getByLabelText("M-01-T02 を上へ"));

    const tasks = lastModel(onChange).milestones[0].tasks;
    expect(tasks.map((t) => [t.title, t.depends_on])).toEqual([
      ["予約を登録する", ["M-01-T02"]],
      ["開発環境を用意する", []],
    ]);
  });

  it("マイルストーンを動かすと番号が振り直される(端のボタンは押せない)", async () => {
    const user = userEvent.setup();
    const plan = makePlan();
    plan.milestones.push({ ...plan.milestones[0], name: "一覧" });
    const onChange = renderTables(plan);

    expect(screen.getByLabelText("M-01 を上へ")).toBeDisabled();
    expect(screen.getByLabelText("M-02 を下へ")).toBeDisabled();
    await user.click(screen.getByLabelText("M-02 を上へ"));

    expect(lastModel(onChange).milestones.map((m) => m.name)).toEqual(["一覧", "予約の登録"]);
  });

  it("段階が閉じていれば編集できない", () => {
    renderTables(makePlan(), vi.fn(), true);

    expect(screen.getByLabelText("M-01 の名前")).toBeDisabled();
    expect(screen.getByLabelText("例外と HTTP の関わるファイル")).toBeDisabled();
  });
  // Phase-26-5：削除
  // it("横断事項・マイルストーン(M-01)・タスク・リスクを表に出す", () => {
  //   renderTables(makePlan());
  //
  //   expect(screen.getByLabelText("例外と HTTP の方針")).toHaveValue("ドメイン例外を共通の形に変換する");
  //   expect(screen.getByLabelText("M-01 の名前")).toHaveValue("予約の登録");
  //   expect(screen.getByLabelText("M-01 の優先度")).toHaveValue("Must");
  //   expect(screen.getByLabelText("M-01 の処理")).toHaveValue("F-01");
  //   expect(screen.getByLabelText("M-01 のタスク1 の区分")).toHaveValue("バックエンド");
  //   expect(screen.getByLabelText("リスク1 の対策")).toHaveValue("一意制約で防ぐ");
  //   // ファイルの欄は例として見せる(検証しない)
  //   expect(screen.getByRole("columnheader", { name: "作成・変更するファイル(例)" })).toBeInTheDocument();
  //   // 既定の項目はそろっているので、足すボタンは出ない
  //   expect(screen.queryByRole("button", { name: "「ログ」を追加" })).not.toBeInTheDocument();
  // });

  // Phase-26-5：削除
  // it("マイルストーンの優先度・タスクの区分を選び直し、タスクを足せる", async () => {
  //   const user = userEvent.setup();
  //   const onChange = renderTables(makePlan());
  //
  //   await user.selectOptions(screen.getByLabelText("M-01 の優先度"), "Could");
  //   expect(lastModel(onChange).milestones[0].priority).toBe("Could");
  //   await user.selectOptions(screen.getByLabelText("M-01 のタスク1 の区分"), "テスト");
  //   expect(lastModel(onChange).milestones[0].tasks[0].area).toBe("テスト");
  //   await user.click(screen.getByRole("button", { name: "M-01 にタスクを追加" }));
  //   expect(lastModel(onChange).milestones[0].tasks).toHaveLength(2);
  // });

});
