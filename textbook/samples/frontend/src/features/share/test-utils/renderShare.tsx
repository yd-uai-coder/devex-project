// 作成：Phase-108-1｜更新：Phase-108-2,108-3
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { useShareStore } from "@/features/share/share-store";
import type { SharedChangeRequestRead } from "@/features/share/api/types";

// 共有リンクの画面の部品のテストの共通の準備。ストアに「tok-1 を読み終えた」状態を置き、読み込みの関数を
// 差し替える(部品の配線だけを見る。ストア自体は share-store.test.ts で確かめる)。
export function seedShareStore(
  shared: SharedChangeRequestRead | null,
  overrides: Partial<ReturnType<typeof useShareStore.getState>> = {},
): void {
  useShareStore.setState({
    token: "tok-1",
    shared,
    status: "success",
    error: null,
    unavailable: false,
    // Phase-108-2:追記
    name: "",
    explanationChanged: false,
    commenting: false,
    commentError: null,
    // Phase-108-3:追記
    deciding: null,
    decisionError: null,
    load: async () => {},
    // Phase-108-2:追記
    restoreName: () => {},
    ...overrides,
  });
}

export function renderWithTamagui(ui: ReactElement) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {ui}
    </TamaguiProvider>,
  );
}
