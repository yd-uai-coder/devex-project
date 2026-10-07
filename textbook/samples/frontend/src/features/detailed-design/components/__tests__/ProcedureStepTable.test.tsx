// 作成：Phase-20-6｜更新：Phase-21-8,29-1
// 写経レベル: 定型 ── 表の編集が onChange に渡ることと、番号・印の出方を確かめる。
// Phase-21-8:追記 ── @/features/detailed-design/logicOps.logicKey
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ProcedureStepTable } from "../ProcedureStepTable";
import type { ProcedureModel } from "@/features/detailed-design/api/types";
import { logicKey } from "@/features/detailed-design/logicOps";
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

  // Phase-29-1:追記
  it("種別を選ぶと onChange で返し、分岐の行には種別を出さない", async () => {
    const user = userEvent.setup();
    const onChange = renderTable();

    expect(screen.getByLabelText("F-01#1 の種別")).toHaveValue("call");
    expect(screen.queryByLabelText("F-01#1a の種別")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("F-01#1 の種別"), "戻り");
    const last = onChange.mock.lastCall?.[0] as ProcedureModel;
    expect(last.procedures[0].steps[0].kind).toBe("return");
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

  // Phase-21-8:追記
  // 段階6の詳細バッジと、段階6から移ってきた行の強調(Phase 21)
  it("段階6に詳細がある手順には詳細バッジを出し、押すと関数の鍵を返す。強調する行に印を付ける", async () => {
    const user = userEvent.setup();
    const onDetailPress = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <ProcedureStepTable
          model={makeProcedures()}
          functionId="F-01"
          modulePaths={[ROUTE]}
          disabled={false}
          onChange={vi.fn()}
          detailIds={new Map([[logicKey(ROUTE, "create_reservation"), "L-02"]])}
          onDetailPress={onDetailPress}
          highlightedStep="F-01#1"
        />
      </TamaguiProvider>,
    );

    await user.click(screen.getByRole("button", { name: "F-01#1 の詳細 L-02 へ移る" }));
    expect(onDetailPress).toHaveBeenCalledWith(logicKey(ROUTE, "create_reservation"));
    expect(screen.getByText("詳細 L-02 ↓")).toBeInTheDocument();
    expect(screen.getByLabelText("F-01#1 の処理内容").closest("tr")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByLabelText("F-01#1a の条件").closest("tr")).not.toHaveAttribute("aria-current");
  });

  // Phase-29-1:追記
  it("戻りの行には、関数の欄が一致しても詳細バッジを出さない", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <ProcedureStepTable
          model={{
            procedures: [
              { function_id: "F-01", reason: "", note: "", steps: [makeStep({ kind: "return" })] },
            ],
          }}
          functionId="F-01"
          modulePaths={[ROUTE]}
          disabled={false}
          onChange={vi.fn()}
          detailIds={new Map([[logicKey(ROUTE, "create_reservation"), "L-02"]])}
        />
      </TamaguiProvider>,
    );
    expect(screen.queryByText("詳細 L-02 ↓")).not.toBeInTheDocument();
  });
});
