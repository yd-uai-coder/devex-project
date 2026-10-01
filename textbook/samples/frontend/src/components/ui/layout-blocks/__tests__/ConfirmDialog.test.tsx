// 作成：Phase-15-8
// 写経レベル: 定型
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ConfirmDialog } from "../ConfirmDialog";

function renderDialog(open = true) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ConfirmDialog
        open={open}
        title="削除しますか"
        description="元に戻せません。"
        confirmLabel="削除する"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </TamaguiProvider>,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("開いているときはタイトルと説明を表示する", () => {
    renderDialog();

    expect(screen.getByText("削除しますか")).toBeInTheDocument();
    expect(screen.getByText("元に戻せません。")).toBeInTheDocument();
  });

  it("閉じているときは何も表示しない", () => {
    renderDialog(false);

    expect(screen.queryByText("削除しますか")).not.toBeInTheDocument();
  });

  // Tamagui の Dialog は jsdom では表示のアニメーション中とみなされ、ロールのクエリでは
  // 「隠れている」扱いになるため、ボタンは aria-label で取る
  it("確定ボタンでonConfirm、キャンセルでonCancelを呼ぶ", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    await user.click(screen.getByLabelText("削除する"));
    await user.click(screen.getByLabelText("キャンセル"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
