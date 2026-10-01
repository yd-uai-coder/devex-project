// 作成：Phase-15-7
// 写経レベル: 定型
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ModeSelectDialog } from "../ModeSelectDialog";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function renderDialog(onClose = vi.fn()) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ModeSelectDialog open onClose={onClose} />
    </TamaguiProvider>,
  );
  return onClose;
}

describe("ModeSelectDialog", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("2つのモードを説明つきで示し、作成後に変えられないことを伝える", () => {
    renderDialog();

    expect(screen.getByText("簡易ドキュメントモード")).toBeInTheDocument();
    expect(screen.getByText("詳細設計モード")).toBeInTheDocument();
    expect(screen.getByText("モードはプロジェクトの作成後に変更できません。")).toBeInTheDocument();
  });

  it("選んだモードを ?mode= で作成画面へ渡し、ダイアログを閉じる", async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();

    // Tamagui の Dialog は jsdom では表示のアニメーション中とみなされ、ロールのクエリでは
    // 「隠れている」扱いになるため、aria-label で取る
    await user.click(screen.getByLabelText("詳細設計モードで作成する"));

    expect(push).toHaveBeenCalledWith("/projects/new?mode=detailed");
    expect(onClose).toHaveBeenCalled();
  });
});
