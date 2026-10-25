// 作成：Phase-109-1
// SUT: StrayFunctionTable(段階2・3・7 の、機能一覧に無い処理の行の付け替え・消す)
// ドライバ: Testing Library(描画・選択・クリック)
// スタブ: onReassign・onRemove・onRemoveAll(vi.fn)── 押した行の key と選んだ処理だけを見るため
// (モデルの変換は dataFlowOps・crudOps・planOps のテストが確かめる)
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { StrayFunctionTable, type StrayRow } from "../StrayFunctionTable";
import { makeFunctionListWithSpare } from "../../test-utils/stageFixtures";

function renderTable(rows: StrayRow[]) {
  const handlers = { onReassign: vi.fn(), onRemove: vi.fn(), onRemoveAll: vi.fn() };
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <StrayFunctionTable
        title="機能一覧に無い処理のセル"
        description="説明"
        detailHead="テーブル"
        rows={rows}
        removeLabel="外す"
        removeAllLabel="すべて外す"
        disabled={false}
        {...handlers}
      />
    </TamaguiProvider>,
  );
  return handlers;
}

const spare = makeFunctionListWithSpare().functions[1];

describe("StrayFunctionTable", () => {
  it("行を出し、付け替え先を選んでから付け替える", async () => {
    const handlers = renderTable([{ key: "k1", functionId: "F-09", detail: "users", targets: [spare] }]);

    expect(screen.getByText("機能一覧に無い処理のセル(1)")).toBeInTheDocument();
    const reassign = screen.getByRole("button", { name: "F-09(users) を付け替える" });
    expect(reassign).toHaveAttribute("aria-disabled", "true");
    await userEvent.selectOptions(screen.getByLabelText("F-09(users) の付け替え先"), "F-02");
    await userEvent.click(reassign);

    expect(handlers.onReassign).toHaveBeenCalledWith("k1", "F-02");
  });

  it("1行ずつ外す・すべて外す", async () => {
    const handlers = renderTable([{ key: "k1", functionId: "F-09", detail: "users", targets: [spare] }]);

    await userEvent.click(screen.getByRole("button", { name: "F-09(users) を外す" }));
    expect(handlers.onRemove).toHaveBeenCalledWith("k1");
    await userEvent.click(screen.getByRole("button", { name: "すべて外す" }));
    expect(handlers.onRemoveAll).toHaveBeenCalled();
  });

  it("付け替え先が無ければ選べない旨を出す", () => {
    renderTable([{ key: "k1", functionId: "F-09", detail: "users", targets: [] }]);
    expect(screen.getByText("(付け替えられる処理がありません)")).toBeInTheDocument();
  });

  it("行が無ければ何も出さない", () => {
    renderTable([]);
    expect(screen.queryByLabelText("機能一覧に無い処理のセル")).not.toBeInTheDocument();
  });
});
