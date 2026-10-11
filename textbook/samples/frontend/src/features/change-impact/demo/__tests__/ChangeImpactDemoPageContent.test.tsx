// 作成：Phase-41-3
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ChangeImpactDemoPageContent } from "../ChangeImpactDemoPageContent";

function renderPage() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ChangeImpactDemoPageContent />
    </TamaguiProvider>,
  );
}

function impactKeys() {
  const table = screen.getByRole("table", { name: "影響の一覧" });
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[1].textContent ?? "");
}

function stageStatus(label: string) {
  const item = within(screen.getByRole("list", { name: "段階の状態" }))
    .getAllByRole("listitem")
    .find((li) => li.textContent?.startsWith(label));
  if (!item) throw new Error(`stage not found: ${label}`);
  return item;
}

// 画面全体を描いて何度も操作するため、全体のテストを並列で流すと既定の5秒を超えることがある
describe("ChangeImpactDemoPageContent", { timeout: 20000 }, () => {
  it("最初の変更(FR-011)の、変わったもの・影響の一覧・再生成の候補を示す", () => {
    renderPage();

    expect(screen.getByLabelText("変わったもの")).toHaveTextContent("FR-011");
    expect(impactKeys()).toHaveLength(9);
    expect(impactKeys().some((k) => k.startsWith("PROC F-02"))).toBe(true);
    expect(screen.getByLabelText("再生成の候補")).toHaveTextContent("段階5: PROC F-02");
    expect(stageStatus("段階5")).toHaveTextContent("古い・見直し 1 / 確認済み 0");
  });

  it("確認済みにすると段階の印が減り、すべて済めば承認し直せる", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "PROC F-02 を確認済みにする" }));

    expect(stageStatus("段階5")).toHaveTextContent("古い・見直し済み → 承認し直せる");
    expect(screen.queryByRole("button", { name: "PROC F-02 を確認済みにする" })).not.toBeInTheDocument();
  });

  it("改名を選ぶと直接の参照元だけを示し、同じ段階の中の依存にも印を付ける", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "段階4のモジュールを改名する" }));

    expect(impactKeys()).toHaveLength(6);
    expect(stageStatus("段階4")).toHaveTextContent("古くない・見直し 1 / 確認済み 0");
  });

  it("「表で見る」で、その段階の表を開いて行を強調する", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "LOGIC ChatService.send_message を段階の表で見る" }));

    const table = screen.getByRole("table", { name: "段階の表" });
    const focused = within(table)
      .getAllByRole("row")
      .find((row) => row.getAttribute("aria-current") === "true");
    expect(focused).toHaveTextContent("LOGIC ChatService.send_message");
    expect(focused).toHaveTextContent("見直し");
  });
});
