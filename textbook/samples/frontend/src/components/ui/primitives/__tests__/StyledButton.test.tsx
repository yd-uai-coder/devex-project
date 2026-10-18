// 作成：Phase-78-3
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { StyledButton } from "../StyledButton";

function renderButton(props: { disabled?: boolean; opacity?: number }) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <StyledButton {...props}>保存</StyledButton>
    </TamaguiProvider>,
  );
  return screen.getByRole("button", { name: "保存" });
}

describe("StyledButton", () => {
  it("押せないときは薄くして、押せるボタンと見分けられるようにする", () => {
    expect(renderButton({ disabled: true })).toHaveStyle({ opacity: "0.5" });
  });

  it("押せるときは薄くしない", () => {
    expect(renderButton({ disabled: false })).not.toHaveStyle({ opacity: "0.5" });
  });

  it("呼ぶ側の opacity を優先する", () => {
    expect(renderButton({ disabled: true, opacity: 0.8 })).toHaveStyle({ opacity: "0.8" });
  });
});
