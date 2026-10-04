// 作成：Phase-19-6
// 写経レベル: 定型
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ModuleListTable } from "../ModuleListTable";
import { makeModuleList } from "../../test-utils/stageFixtures";
import type { ModuleListModel } from "@/features/detailed-design/api/types";

// SUT: ModuleListTable / ドライバ: render と入力操作 / スタブ不要 ── 表示と onChange だけの部品で、
// API やストアを呼ばないため。編集の結果は、呼び出し元の代わりのラッパー(Harness)が持つ。
const LAYERS = ["api", "service"];
const PATH = "app/api/routes/reservations.py";

function Harness({
  initial,
  onChange,
  disabled = false,
}: {
  initial: ModuleListModel;
  onChange: (model: ModuleListModel) => void;
  disabled?: boolean;
}) {
  const [model, setModel] = useState(initial);
  return (
    <ModuleListTable
      layers={LAYERS}
      model={model}
      disabled={disabled}
      onChange={(next) => {
        setModel(next);
        onChange(next);
      }}
    />
  );
}

function renderTable(initial: ModuleListModel = makeModuleList(), disabled = false) {
  const onChange = vi.fn();
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <Harness initial={initial} onChange={onChange} disabled={disabled} />
    </TamaguiProvider>,
  );
  return onChange;
}

const last = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls.at(-1)?.[0] as ModuleListModel;

describe("ModuleListTable", () => {
  it("行を表示し、層は構成図の層から選ぶ(構成図に無い層は印を付けて残す)", () => {
    renderTable(makeModuleList("domain"));

    expect(screen.getByLabelText(`${PATH} のパス`)).toHaveValue(PATH);
    const layer = screen.getByLabelText(`${PATH} の層`);
    expect(layer).toHaveValue("domain");
    expect(screen.getByRole("option", { name: "domain(構成図に無い)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "service" })).toBeInTheDocument();
    expect(screen.getByLabelText(`${PATH} の関わる処理`)).toHaveValue("F-01");
  });

  it("区切りの「,」を打っても消えず、配列にして返す", async () => {
    const onChange = renderTable();
    const input = screen.getByLabelText(`${PATH} の主な依存先`);

    await userEvent.type(input, "app/services/reservation.py, sqlalchemy");

    expect(input).toHaveValue("app/services/reservation.py, sqlalchemy");
    expect(last(onChange).modules[0].depends_on).toEqual([
      "app/services/reservation.py",
      "sqlalchemy",
    ]);
  });

  it("全処理を選ぶと関わる処理の欄を隠し、行の追加・削除ができる", async () => {
    const onChange = renderTable();

    await userEvent.click(screen.getByLabelText(`${PATH} は全処理`));
    expect(last(onChange).modules[0].all_functions).toBe(true);
    expect(screen.queryByLabelText(`${PATH} の関わる処理`)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "モジュールを追加" }));
    expect(last(onChange).modules[1]).toMatchObject({ path: "", layer: "api" });
    await userEvent.type(screen.getByLabelText("2行目 のパス"), PATH);
    expect(screen.getAllByText("パスが重複しています")).toHaveLength(2);

    await userEvent.click(screen.getAllByRole("button", { name: `${PATH} を削除` })[1]);
    expect(last(onChange).modules).toHaveLength(1);
    expect(screen.queryByText("パスが重複しています")).not.toBeInTheDocument();
  });

  it("無効のときは編集できない", () => {
    renderTable(makeModuleList(), true);
    expect(screen.getByLabelText(`${PATH} のパス`)).toBeDisabled();
    expect(screen.getByLabelText(`${PATH} の主な依存先`)).toBeDisabled();
  });
});
