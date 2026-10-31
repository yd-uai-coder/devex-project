// 作成：Phase-118-1
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";

// 使い方の解説の部品のテストの共通の準備(API もストアも使わないので、Tamagui で包むだけ)
export function renderGuide(ui: ReactElement) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {ui}
    </TamaguiProvider>,
  );
}
