// 作成：Phase-3-2
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import FormGeneral from "../FormGeneral";

function renderForm(props: Partial<React.ComponentProps<typeof FormGeneral>> = {}) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <FormGeneral {...props} />
    </TamaguiProvider>,
  );
}

describe("FormGeneral", () => {
  it("onBeforeSubmitがtrueを返したら、追加待機なしですぐonSubmittedを呼ぶ(demoDelayMs未指定)", async () => {
    const onSubmitted = vi.fn();
    const user = userEvent.setup();
    renderForm({ onBeforeSubmit: () => Promise.resolve(true), onSubmitted });

    await user.click(screen.getByRole("button", { name: "送信" }));

    await vi.waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
  });

  it("onBeforeSubmitがfalseを返したらonSubmittedを呼ばず、再送信可能な状態に戻す", async () => {
    const onSubmitted = vi.fn();
    const user = userEvent.setup();
    renderForm({ onBeforeSubmit: () => Promise.resolve(false), onSubmitted });

    const button = screen.getByRole("button", { name: "送信" });
    await user.click(button);

    await vi.waitFor(() => expect(button).toBeEnabled());
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  it("demoDelayMs指定時は、その時間が経過するまでonSubmittedを呼ばない", async () => {
    const onSubmitted = vi.fn();
    const user = userEvent.setup();
    renderForm({ onBeforeSubmit: () => Promise.resolve(true), onSubmitted, demoDelayMs: 50 });

    await user.click(screen.getByRole("button", { name: "送信" }));
    expect(onSubmitted).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
  });
});
