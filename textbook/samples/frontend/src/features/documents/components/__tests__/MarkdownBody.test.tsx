// 作成：Phase-110(完了後の調整)
// SUT: MarkdownBody(md の本文を枠の中に描く)
// ドライバ: Testing Library(描画)
// スタブ不要 ── md の文字列を受け取って描くだけで、ストアも API も呼ばないため
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { MarkdownBody } from "../MarkdownBody";

const TABLE_MD = "| 種類 | 内訳 |\n|---|---|\n| ファイル | app/clients/twitter.py・app/repositories/trend.py |\n";

function renderBody(content: string) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <MarkdownBody content={content} label="変更の説明書" />
    </TamaguiProvider>,
  );
}

describe("MarkdownBody", () => {
  it("表を横に送れる入れ物に入れ、長い語はセルの中で折り返す(狭い画面で枠からはみ出して切れない)", () => {
    renderBody(TABLE_MD);

    const table = screen.getByRole("table");
    expect(table.parentElement).toHaveStyle({ overflowX: "auto" });
    expect(screen.getByRole("cell", { name: /app\/clients\/twitter\.py/ })).toHaveStyle({ overflowWrap: "anywhere" });
  });

  it("見出しと本文を、名前つきの枠の中に描く", () => {
    renderBody("# 変更の説明書 CR-6\n\n本文です");

    const region = screen.getByRole("region", { name: "変更の説明書" });
    expect(region).toContainElement(screen.getByRole("heading", { level: 1, name: "変更の説明書 CR-6" }));
    expect(region).toHaveTextContent("本文です");
  });
});
