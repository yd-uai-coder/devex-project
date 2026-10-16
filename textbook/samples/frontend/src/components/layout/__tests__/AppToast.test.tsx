// 作成：Phase-64-3
// SUT: AppToastProvider(トーストの置き場。ToastProvider・表示中のトースト・ToastViewport)
// ドライバ: このテスト(子の部品から useToastController().show を呼ぶ)
// スタブ不要 ── 知らせが画面に出ることそのものが検証対象で、外部に依存しないため
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import { useToastController } from "@tamagui/toast";
import tamaguiConfig from "@/tamagui.config";
import { AppToastProvider } from "../AppToast";

function Notifier() {
  const toast = useToastController();
  return <button onClick={() => toast.show("「備品予約」を削除しました")}>知らせる</button>;
}

describe("AppToastProvider", () => {
  it("子を描き、show した題名をトーストに出す", async () => {
    const user = userEvent.setup();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppToastProvider>
          <Notifier />
        </AppToastProvider>
      </TamaguiProvider>,
    );

    await user.click(screen.getByRole("button", { name: "知らせる" }));

    expect(await screen.findAllByText("「備品予約」を削除しました")).not.toHaveLength(0);
  });
});
