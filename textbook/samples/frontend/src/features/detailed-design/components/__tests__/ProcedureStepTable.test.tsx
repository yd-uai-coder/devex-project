// 作成：Phase-20-6
// 写経レベル: 定型 ── 表の編集が onChange に渡ることと、番号・印の出方を確かめる。
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ProcedureStepTable } from "../ProcedureStepTable";
import type { ProcedureModel } from "@/features/detailed-design/api/types";
import { makeProcedures, makeStep } from "../../test-utils/stageFixtures";

// SUT: ProcedureStepTable / ドライバ: render と操作 / スタブ: onChange(呼び出し元への通知を受け取る)。
// 編集操作そのもの(procedureOps)は本物を使い、表に出る番号・印と onChange に渡る値を見る。

const ROUTE = "app/api/routes/reservations.py";

function Harness({ initial, onChange }: { initial: ProcedureModel; onChange: (m: ProcedureModel) => void }) {
  const [model, setModel] = useState(initial);
  return (
    <ProcedureStepTable
      model={model}
      functionId="F-01"
      modulePaths={[ROUTE]}
      disabled={false}
      onChange={(next) => {
        setModel(next);
        onChange(next);
      }}
    />
  );
}

function renderTable(initial: ProcedureModel = makeProcedures()) {
  const onChange = vi.fn();
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <Harness initial={initial} onChange={onChange} />
    </TamaguiProvider>,
  );
  return onChange;
}

describe("ProcedureStepTable", () => {
  it("手順と分岐を番号付きで出し、欄の編集を onChange で返す", async () => {
    const user = userEvent.setup();
    const onChange = renderTable();

    expect(screen.getByLabelText("F-01#1 の呼び出し先")).toHaveValue(ROUTE);
    expect(screen.getByLabelText("F-01#1a の条件")).toHaveValue("本文が不正");
    expect(screen.getByLabelText("F-01#1a の分岐の結果")).toHaveValue("422");
    expect(screen.queryByLabelText("F-01#1a の呼び出し先")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("F-01#1 の関数"));
    await user.type(screen.getByLabelText("F-01#1 の関数"), "f");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        procedures: [expect.objectContaining({ steps: [makeStep({ call: "f" }), expect.anything()] })],
      }),
    );
  });

  it("モジュール一覧に無いパスと空の呼び出し先に印を出し、外部の役者には出さない", async () => {
    const user = userEvent.setup();
    renderTable();
    const callee = screen.getByLabelText("F-01#1 の呼び出し先");

    await user.clear(callee);
    expect(screen.getByText("呼び出し先が空です")).toBeInTheDocument();
    await user.type(callee, "app/missing.py");
    expect(screen.getByText("モジュール一覧に無いパスです")).toBeInTheDocument();
    await user.clear(callee);
    await user.type(callee, "利用者");
    expect(screen.queryByText("モジュール一覧に無いパスです")).not.toBeInTheDocument();
  });

  it("手順・分岐を足すと番号が振り直され、手順を消すと付いている分岐も消える", async () => {
    const user = userEvent.setup();
    const onChange = renderTable();

    await user.click(screen.getByRole("button", { name: "手順を足す" }));
    expect(screen.getByLabelText("F-01#2 の呼び出し先")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "F-01#1 に分岐を足す" }));
    expect(screen.getByLabelText("F-01#1b の条件")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "F-01#1 を削除" }));
    const last = onChange.mock.lastCall?.[0] as ProcedureModel;
    expect(last.procedures[0].steps).toHaveLength(1);
    expect(screen.getByLabelText("F-01#1 の呼び出し先")).toHaveValue("");
  });

  it("選定理由と注記を編集でき、手順が無ければ案内を出す", async () => {
    const user = userEvent.setup();
    const onChange = renderTable({
      procedures: [{ function_id: "F-01", reason: "", note: "", steps: [] }],
    });

    expect(screen.getByText(/手順はまだありません/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("F-01 の選定理由"), "並行制御");
    await user.type(screen.getByLabelText("F-01 の注記"), "T");
    expect(onChange).toHaveBeenLastCalledWith({
      procedures: [{ function_id: "F-01", reason: "並行制御", note: "T", steps: [] }],
    });
  });

  it("選ばれていない処理なら何も出さない", () => {
    const { container } = render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <ProcedureStepTable
          model={{ procedures: [] }}
          functionId="F-01"
          modulePaths={[]}
          disabled={false}
          onChange={vi.fn()}
        />
      </TamaguiProvider>,
    );
    expect(container.querySelector("table")).toBeNull();
  });
});
