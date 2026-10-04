// 作成：Phase-21-7(画面確認後の修正)
// 写経レベル: 定型 ── 保存できる条件と前後のボタンの並びを確かめる。
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { StageSaveBar } from "../StageSaveBar";

// SUT: StageSaveBar / ドライバ: render と操作 / スタブ: onSave(呼び出し元への通知を受け取る)。
// 保存できる条件(編集がある・保存中でない・保存できない理由が無い)と、前後のボタンの置き場所を見る。

function renderBar(props: Partial<Parameters<typeof StageSaveBar>[0]> = {}) {
  const onSave = vi.fn();
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <StageSaveBar dirty saving={false} disabled={false} onSave={onSave} {...props} />
    </TamaguiProvider>,
  );
  return onSave;
}

describe("StageSaveBar", () => {
  it("編集があれば保存でき、未保存の案内を出す", async () => {
    const user = userEvent.setup();
    const onSave = renderBar();

    expect(screen.getByText("保存していない編集があります。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存する" }));
    expect(onSave).toHaveBeenCalled();
  });

  it("編集が無い・保存中・保存できない理由があるときは押せない", () => {
    renderBar({ dirty: false, label: "CRUD 図を保存する" });
    expect(screen.getByRole("button", { name: "CRUD 図を保存する" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.queryByText("保存していない編集があります。")).toBeNull();
  });

  it("保存中は文言を変え、前後に段階ごとのボタンを並べる", () => {
    renderBar({
      saving: true,
      leading: <button type="button">前</button>,
      trailing: <button type="button">後</button>,
    });
    const names = screen.getAllByRole("button").map((el) => el.textContent);
    expect(names).toEqual(["前", "保存しています...", "後"]);
  });
});
