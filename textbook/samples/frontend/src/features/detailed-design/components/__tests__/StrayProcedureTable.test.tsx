// 作成：Phase-99(完了後の調整)
// SUT: StrayProcedureTable(段階5 の、機能一覧に無い処理の手順の付け替え・消す)
// ドライバ: Testing Library(描画・選択・クリック)
// スタブ: onChange(vi.fn)── 操作が返す下書きだけを見るため(変換そのものは procedureOps のテストが確かめる)
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import type { FunctionListModel, ProcedureModel } from "@/features/detailed-design/api/types";
import { StrayProcedureTable } from "../StrayProcedureTable";
import { makeFunctionList, makeProcedures } from "../../test-utils/stageFixtures";

function functionList(): FunctionListModel {
  const list = makeFunctionList();
  return { ...list, functions: [...list.functions, { ...list.functions[0], id: "F-27", name: "トップページ表示" }] };
}

function withStray(): ProcedureModel {
  const base = makeProcedures();
  return { procedures: [base.procedures[0], { ...base.procedures[0], function_id: "F-04" }] };
}

function renderTable(model: ProcedureModel, onChange = vi.fn()) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <StrayProcedureTable model={model} functionList={functionList()} disabled={false} onChange={onChange} />
    </TamaguiProvider>,
  );
  return onChange;
}

describe("StrayProcedureTable", () => {
  it("機能一覧に無い手順を出し、選んだ処理へ付け替える", async () => {
    const onChange = renderTable(withStray());

    expect(screen.getByText("機能一覧に無い処理の手順(1)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "F-04 を付け替える" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.selectOptions(screen.getByLabelText("F-04 の付け替え先"), "F-27");
    await userEvent.click(screen.getByRole("button", { name: "F-04 を付け替える" }));

    const next = onChange.mock.lastCall?.[0] as ProcedureModel;
    expect(next.procedures.map((p) => p.function_id)).toEqual(["F-01", "F-27"]);
  });

  it("1件ずつ消す・すべて消す", async () => {
    const onChange = renderTable(withStray());

    await userEvent.click(screen.getByRole("button", { name: "F-04 の手順を消す" }));
    expect((onChange.mock.lastCall?.[0] as ProcedureModel).procedures.map((p) => p.function_id)).toEqual(["F-01"]);
    await userEvent.click(screen.getByRole("button", { name: "機能一覧に無い手順をすべて消す" }));
    expect((onChange.mock.lastCall?.[0] as ProcedureModel).procedures.map((p) => p.function_id)).toEqual(["F-01"]);
  });

  it("機能一覧に無い手順が無ければ何も出さない", () => {
    renderTable(makeProcedures());

    expect(screen.queryByLabelText("機能一覧に無い処理の手順")).not.toBeInTheDocument();
  });
});
