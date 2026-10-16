// 作成：Phase-64-3
// SUT: Providers(Tamagui とテーマの提供・トーストの置き場)
// ドライバ: このテスト(子の部品から useToastController().show を呼ぶ)
// スタブ: next/navigation の useServerInsertedHTML(SSR のストリームに書く関数。jsdom では使わないので何もしない)・
// @tamagui/next-theme(next/script を読むため Vitest では評価できない。テーマは light に固定する)
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useToastController } from "@tamagui/toast";
import { Providers } from "../providers";

vi.mock("next/navigation", () => ({ useServerInsertedHTML: () => undefined }));
vi.mock("@tamagui/next-theme", () => ({
  NextThemeProvider: ({ children }: { children: ReactNode }) => children,
  useRootTheme: () => ["light", () => undefined],
}));

function Notifier() {
  const toast = useToastController();
  return <button onClick={() => toast.show("「備品予約」を削除しました")}>知らせる</button>;
}

describe("Providers", () => {
  it("子をトーストの置き場の中に描く(どの画面からも知らせを出せ、画面を移っても残る)", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <Notifier />
      </Providers>,
    );

    await user.click(screen.getByRole("button", { name: "知らせる" }));

    expect(await screen.findAllByText("「備品予約」を削除しました")).not.toHaveLength(0);
  });
});
