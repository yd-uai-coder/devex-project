// 作成：Phase-107-2
// SUT: OptionsEditor(案の編集欄)
// ドライバ: Testing Library(クリック・選択・入力)
// スタブ: 保存・キャンセルの関数(vi.fn)── 欄の操作から作る案の形だけを見るため
import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OptionsEditor } from "../OptionsEditor";
import { optionsFormFromCr } from "../../changeRequestOps";
import { makeChangeRequest, makeOptions } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme } from "../../test-utils/renderWithStore";

describe("OptionsEditor", () => {
  it("削除にすると変更後の案の欄を消し、おすすめの番号と理由を送る", async () => {
    const onSubmit = vi.fn();
    renderWithTheme(
      <OptionsEditor
        initial={{ ...optionsFormFromCr(makeOptions()), recommended: null, reason: "" }}
        crTargets={makeChangeRequest().targets}
        addsRequirement={false}
        submitting={false}
        submitLabel="案を保存する"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    const second = screen.getByLabelText("案2の編集");
    await userEvent.selectOptions(within(second).getByLabelText("案2の FR-005 の変更の種類"), "delete");
    expect(within(second).queryByLabelText("案2の FR-005 の変更後の案")).toBeNull();
    expect(within(second).getByText("(削除)")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("おすすめの案"), "2");
    await userEvent.type(screen.getByLabelText("おすすめの理由"), "小さく済む");
    await userEvent.click(screen.getByRole("button", { name: "案を保存する" }));

    const form = onSubmit.mock.calls[0][0];
    expect(form.items[1].targets).toEqual([{ requirement_id: "FR-005", kind: "delete", proposed_text: "" }]);
    expect(form.recommended).toBe(2);
    expect(form.reason).toBe("小さく済む");
  });

  it("3つまでしか足せない", async () => {
    renderWithTheme(
      <OptionsEditor
        initial={optionsFormFromCr(makeOptions())}
        crTargets={makeChangeRequest().targets}
        addsRequirement={false}
        submitting={false}
        submitLabel="案を保存する"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "案を足す" }));
    expect(screen.getByLabelText("案3の編集")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "案を足す" })).toBeNull();
  });
});
