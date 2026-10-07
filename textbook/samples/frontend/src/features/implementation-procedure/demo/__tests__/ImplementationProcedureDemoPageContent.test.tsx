// 作成：Phase-25-2｜更新：Phase-25-5
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ImplementationProcedureDemoPageContent } from "../ImplementationProcedureDemoPageContent";

function renderPage() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ImplementationProcedureDemoPageContent />
    </TamaguiProvider>,
  );
}

// Phase-25-5：更新
// describe("ImplementationProcedureDemoPageContent", () => {
// ↓↓
// 画面全体を描いて何度も操作するため、全体のテストを並列で流すと既定の5秒を超えることがある
describe("ImplementationProcedureDemoPageContent", { timeout: 20000 }, () => {
  it("単位を依存順に並べ、生成済みの M-03-T01 の詳細を最初に開く", () => {
    renderPage();

    const rows = within(screen.getByRole("table", { name: "単位の一覧" })).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("M-01-T01");
    expect(rows[1]).toHaveTextContent("M-01-T02");
    expect(rows[4]).toHaveTextContent("M-01-T05");
    expect(within(screen.getByLabelText("単位の詳細")).getByText("M-03-T01 チャットメッセージを送信する")).toBeInTheDocument();
  });

  it("参照のバッジを押すと設計の中身を展開し、設計に無い参照は押せない", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "段階6 L-01 AIservice.stream_chat" }));
    expect(screen.getByLabelText("段階6 L-01 AIservice.stream_chat の中身")).toHaveTextContent("async def stream_chat");

    await user.click(screen.getByRole("button", { name: "M-01-T02 を開く" }));
    expect(screen.getByRole("button", { name: "段階5 F-01(設計に無い)" })).toBeDisabled();
  });

  it("未生成の単位は5件まで選べ、詳細には未生成と出る", async () => {
    const user = userEvent.setup();
    renderPage();

    for (const id of ["M-01-T03", "M-01-T04", "M-01-T05", "M-02-T01", "M-02-T02", "M-02-T03"]) {
      await user.click(screen.getByRole("checkbox", { name: `${id} を生成する` }));
    }
    expect(screen.getByRole("checkbox", { name: "M-02-T03 を生成する" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "選んだ単位を生成する(5/5)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "M-01-T03 を開く" }));
    expect(screen.getByText(/この単位の手順書はまだ生成していません/)).toBeInTheDocument();
  });

  it("全体の未定義を重要度で絞り込み、直す先の段階を案内する", async () => {
    const user = userEvent.setup();
    renderPage();
    const overall = () => within(screen.getByRole("table", { name: "全体の未定義・要決定" })).getAllByRole("row").slice(1);

    expect(overall()).toHaveLength(19);
    await user.click(screen.getByRole("button", { name: "軽微(1)" }));
    expect(overall()).toHaveLength(1);

    await user.click(within(overall()[0]).getByRole("button", { name: "段階7で直す" }));
    expect(screen.getByRole("status")).toHaveTextContent("段階7の画面へ移り");
  });

  // Phase-25-5:追記
  it("手順から導いたシーケンス図を出し、テストを選ぶとスタブの候補と手順書のスタブの食い違いを示す", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole("img", { name: "段階5 F-07 のシーケンス図" })).toBeInTheDocument();
    expect(screen.getByText(/検証 F-07#4: 呼び出し先 frontend は呼び出し元の側にいる/)).toBeInTheDocument();

    const rows = within(screen.getByRole("table", { name: "テスト観点とスタブの候補" })).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("services/ai_service.py");
    expect(rows[0]).toHaveTextContent("スタブに、手順に無い依存がある: repositories/project_repository.py");
    expect(rows[2]).toHaveTextContent("食い違いなし");
    expect(rows[3]).toHaveTextContent("図に無い(画面など)");

    await user.click(within(rows[0]).getByRole("button", { name: "TC-01" }));
    const svg = screen.getByRole("img", { name: "段階5 F-07 のシーケンス図" });
    const box = (name: string) => svg.querySelector(`[data-participant="${name}"] rect`)!;
    expect(box("services/ai_service.py")).toHaveAttribute("fill", "var(--blue4)");
    expect(box("external/gemini_client.py")).toHaveAttribute("fill", "var(--orange4)");
    expect(box("frontend")).toHaveAttribute("fill", "var(--yellow4, #fdf3c4)");
  });

  it("AI 向けにコピーすると、展開した md を書き込み、残っている未定義の数を出す", async () => {
    const user = userEvent.setup();
    renderPage();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    await user.click(screen.getByRole("button", { name: "AI 向けにコピー" }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("あなたは実装担当者です。"));
    expect(writeText.mock.calls[0][0]).toContain("### 段階5 F-07 チャットメッセージを送信する");
    expect(screen.getByRole("status")).toHaveTextContent("未定義・要決定が 8 件残っています(最重要 3 件)");
  });
});
