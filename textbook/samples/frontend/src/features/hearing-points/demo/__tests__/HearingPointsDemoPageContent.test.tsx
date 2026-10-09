// 作成：Phase-33-3
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { HearingPointsDemoPageContent } from "../HearingPointsDemoPageContent";

function renderPage() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <HearingPointsDemoPageContent />
    </TamaguiProvider>,
  );
}

function pointRow(label: string) {
  const table = screen.getByRole("table", { name: "観点の表" });
  const row = within(table)
    .getAllByRole("row")
    .find((r) => within(r).queryAllByRole("cell")[0]?.textContent === label);
  if (!row) throw new Error(`row not found: ${label}`);
  return row;
}

// 画面全体を描いて何度も操作するため、全体のテストを並列で流すと既定の5秒を超えることがある
describe("HearingPointsDemoPageContent", { timeout: 20000 }, () => {
  it("未決の必須の観点を示し、必須の可用性のカードから出す", () => {
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("未決の必須の観点: 例外の場面、可用性、セキュリティ");
    expect(within(screen.getByLabelText("選択肢カード")).getByText(/どのくらいで困りますか/)).toBeInTheDocument();
  });

  it("選択肢を選ぶと「AI の提案を採用」、自分の言葉で答えると「ユーザーが決定」になる", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "半日〜1日止まっても困らない" }));
    expect(pointRow("可用性")).toHaveTextContent("AI の提案を採用");
    expect(pointRow("可用性")).toHaveTextContent("カード(発言5)");

    // 次はセキュリティのカード。自分の言葉で答える
    await user.type(screen.getByLabelText("自分の言葉で答える"), "本人とその上司だけが見られる");
    await user.click(screen.getByRole("button", { name: "答える" }));
    expect(pointRow("セキュリティ")).toHaveTextContent("ユーザーが決定");
    expect(pointRow("セキュリティ")).toHaveTextContent("発言6");
  });

  it("必須がすべて決まると完了を示し、規模を社内に変えると必須が増える", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "半日〜1日止まっても困らない" }));
    await user.click(screen.getByRole("button", { name: "自分以外の全員(本人だけが見られる)" }));
    await user.click(screen.getByRole("button", { name: "理由を出して、送り直せばよい" }));
    expect(screen.getByRole("status")).toHaveTextContent("必須の観点がすべて決まりました");

    await user.click(screen.getByRole("button", { name: "社内" }));
    expect(screen.getByRole("status")).toHaveTextContent("未決の必須の観点: 運用・保守性、システム環境・エコロジー");
  });

  it("要件の出どころを数え、処理の無い Must の要件を指摘する", () => {
    renderPage();

    expect(screen.getByText("推測 1")).toBeInTheDocument();
    const traceTable = screen.getByRole("table", { name: "要件からの追跡" });
    const fr009 = within(traceTable)
      .getAllByRole("row")
      .find((r) => r.textContent?.startsWith("FR-009"));
    expect(fr009).toHaveTextContent("なし");
    expect(screen.getByLabelText("追跡の指摘")).toHaveTextContent("中程度: FR-009 は Must の機能要件ですが、担う処理がありません。");
  });
});
