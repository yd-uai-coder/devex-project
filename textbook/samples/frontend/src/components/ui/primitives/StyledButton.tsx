// 更新：Phase-78-3
"use client";

import { Button, type ButtonProps } from "tamagui";

// Phase-78-3:追記
// 押せないとき(disabled)の不透明度。Tamagui の Button は disabled で押せなくするだけで見た目を
// 変えないため、押せるボタンと見分けられるように薄くする(呼ぶ側の opacity が優先)。
const DISABLED_OPACITY = 0.5;

export function StyledButton({
  theme = "green",
  backgroundColor = "$color9",
  color = "white",
  hoverStyle,
  pressStyle,
  // Phase-78-3:追記
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Button
      theme={theme}
      backgroundColor={backgroundColor}
      color={color}
      hoverStyle={{ backgroundColor: "$color10", ...hoverStyle }}
      pressStyle={{ backgroundColor: "$color8", ...pressStyle }}
      // Phase-78-3:追記
      disabled={disabled}
      opacity={disabled ? DISABLED_OPACITY : undefined}
      {...props}
    />
  );
}
