// 作成：Phase-21-6
// 写経レベル: 定型 ── 入力と onChange、バッジの出し分けを確かめる。
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { LogicSpecEditor } from "../LogicSpecEditor";
import { BADGE } from "../tableStyles";
import type { LogicModel } from "@/features/detailed-design/api/types";
import { keyOf } from "@/features/detailed-design/logicOps";
import { makeLogic, makeLogics } from "../../test-utils/stageFixtures";

// SUT: LogicSpecEditor / ドライバ: render と操作 / スタブ: onChange・onStepPress(呼び出し元への
// 通知を受け取る)。編集操作そのもの(logicOps)は本物を使い、表・擬似フローの入力と onChange に渡る値、
// 「呼ばれる手順」のバッジの出し方を見る。

const KEY = keyOf(makeLogic());

function Harness({
  initial,
  stepIds,
  onChange,
  onStepPress,
}: {
  initial: LogicModel;
  stepIds: string[];
  onChange: (m: LogicModel) => void;
  onStepPress?: (id: string) => void;
}) {
  const [model, setModel] = useState(initial);
  return (
    <LogicSpecEditor
      model={model}
      logicKey={KEY}
      logicId="L-01"
      stepIds={stepIds}
      disabled={false}
      onChange={(next) => {
        setModel(next);
        onChange(next);
      }}
      onStepPress={onStepPress}
    />
  );
}

function renderEditor(
  options: { initial?: LogicModel; stepIds?: string[]; onStepPress?: (id: string) => void } = {},
) {
  const onChange = vi.fn();
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <Harness
        initial={options.initial ?? makeLogics()}
        stepIds={options.stepIds ?? ["F-01#1"]}
        onChange={onChange}
        onStepPress={options.onStepPress}
      />
    </TamaguiProvider>,
  );
  return onChange;
}

describe("LogicSpecEditor", () => {
  it("仕様の表と擬似フローを出し、欄の編集を onChange で返す", async () => {
    const user = userEvent.setup();
    const onChange = renderEditor();

    expect(screen.getByLabelText("L-01 のシグネチャ")).toHaveValue(makeLogic().signature);
    expect(screen.getByLabelText("L-01 の擬似フロー 1")).toHaveValue("本文を検証する");
    expect(screen.getByLabelText("L-01 の擬似フロー 1 の箇条")).toHaveValue("不正なら 422");
    await user.clear(screen.getByLabelText("L-01 の事前条件"));
    await user.type(screen.getByLabelText("L-01 の事前条件"), "ロック済み");

    const last: LogicModel = onChange.mock.lastCall?.[0];
    expect(last.logics[0].pre).toBe("ロック済み");
  });

  it("擬似フローの段を足す・箇条を1行1つで書く・段を消す", async () => {
    const user = userEvent.setup();
    const onChange = renderEditor();

    await user.click(screen.getByRole("button", { name: "段を足す" }));
    await user.type(screen.getByLabelText("L-01 の擬似フロー 2"), "保存する");
    await user.type(screen.getByLabelText("L-01 の擬似フロー 2 の箇条"), "flush{Enter}commit");
    expect(onChange.mock.lastCall?.[0].logics[0].pseudo[1]).toEqual({
      text: "保存する",
      sub: ["flush", "commit"],
    });

    await user.click(screen.getByRole("button", { name: "L-01 の擬似フロー 1 を削除" }));
    expect(onChange.mock.lastCall?.[0].logics[0].pseudo.map((p: { text: string }) => p.text)).toEqual([
      "保存する",
    ]);
  });

  it("呼ばれる手順はバッジで出し、onStepPress があれば押して移れる", async () => {
    const user = userEvent.setup();
    const onStepPress = vi.fn();
    renderEditor({ stepIds: ["F-01#1", "F-02#3"], onStepPress });

    await user.click(screen.getByRole("button", { name: "手順 F-02#3 へ移る" }));
    expect(onStepPress).toHaveBeenCalledWith("F-02#3");
    expect(screen.getByRole("button", { name: "手順 F-01#1 へ移る" })).toHaveStyle({
      borderRadius: `${BADGE.borderRadius}px`,
    });
  });

  it("onStepPress が無ければバッジは押せず、呼ぶ手順が無ければ印を出す", () => {
    renderEditor({ stepIds: [] });
    expect(screen.getByText("段階5にこの関数を呼ぶ手順がありません")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /へ移る/ })).toBeNull();
  });

  it("擬似フローが無ければ案内を出す", () => {
    renderEditor({ initial: { logics: [makeLogic({ pseudo: [] })] } });
    expect(screen.getByText(/擬似フローはまだありません/)).toBeInTheDocument();
  });
});
