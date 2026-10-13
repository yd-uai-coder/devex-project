// 作成：Phase-51-3
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DesignReviewDemoPageContent } from "../DesignReviewDemoPageContent";

function renderPage() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DesignReviewDemoPageContent />
    </TamaguiProvider>,
  );
}

function gateRow(label: string) {
  const row = within(screen.getByRole("table", { name: "レビューの区切り" }))
    .getAllByRole("row")
    .find((r) => r.textContent?.startsWith(label));
  if (!row) throw new Error(`gate not found: ${label}`);
  return row;
}

function findingCount() {
  return within(screen.getByRole("table", { name: "指摘の一覧" })).getAllByRole("row").length - 1;
}

// 画面全体を描いて何度も操作するため、全体のテストを並列で流すと既定の5秒を超えることがある
describe("DesignReviewDemoPageContent", { timeout: 20000 }, () => {
  it("詳細設計モードは、要件・外部の生成後(自動)だけレビュー済みで、段階6・7は文書がまだ無い", () => {
    renderPage();

    expect(gateRow("要件・外部の生成の後")).toHaveTextContent("自動");
    expect(gateRow("要件・外部の生成の後")).toHaveTextContent("レビュー済み");
    expect(gateRow("段階6の承認の後")).toHaveTextContent("ボタン");
    expect(gateRow("段階6の承認の後")).toHaveTextContent("文書がまだ無い");
    expect(findingCount()).toBe(5);
  });

  it("段階6を承認すると未レビューになり、ボタンでレビューすると詳細設計書の指摘が増える", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(within(gateRow("段階6の承認の後")).getByRole("button", { name: "段階6を承認する" }));
    expect(gateRow("段階6の承認の後")).toHaveTextContent("未レビュー");

    await user.click(screen.getByRole("button", { name: "実装手順書を生成する" }));
    expect(screen.getByRole("status")).toHaveTextContent("未レビューの区切りがあります(段階6の承認の後)");

    await user.click(screen.getByRole("button", { name: "段階6の承認の後でレビューする" }));
    expect(gateRow("段階6の承認の後")).toHaveTextContent("レビュー済み");
    expect(findingCount()).toBe(8);
  });

  it("モデルが使えないときは失敗(自己診断に切り替え)になり、もう一度レビューで流し直せる", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(within(gateRow("段階6の承認の後")).getByRole("button", { name: "段階6を承認する" }));
    await user.click(screen.getByRole("checkbox", { name: /レビューのモデルが使えない/ }));
    await user.click(screen.getByRole("button", { name: "段階6の承認の後でレビューする" }));
    expect(gateRow("段階6の承認の後")).toHaveTextContent("失敗(自己診断に切り替え)");

    await user.click(screen.getByRole("checkbox", { name: /レビューのモデルが使えない/ }));
    await user.click(screen.getByRole("button", { name: "段階6の承認の後でレビューする" }));
    expect(gateRow("段階6の承認の後")).toHaveTextContent("レビュー済み");
  });

  it("採用した設計の指摘は再生成の指示に入り、ヒアリングの指摘は観点を未決に戻して聞き直す", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByLabelText("再生成の指示")).toBeNull();
    await user.click(screen.getByRole("button", { name: "D-01 を採用" }));
    await user.click(screen.getByRole("button", { name: "D-03 を採用" }));
    await user.click(screen.getByRole("button", { name: "D-05 を却下" }));

    expect(screen.getByLabelText("再生成の指示")).toHaveTextContent("SCR-004");
    expect(screen.getByLabelText("再生成の指示")).not.toHaveTextContent("観点 セキュリティ");
    const security = within(screen.getByRole("table", { name: "ヒアリングの観点" }))
      .getAllByRole("row")
      .find((r) => r.textContent?.startsWith("セキュリティ"));
    expect(security).toHaveTextContent("未決に戻した");
    expect(screen.getByLabelText("聞き直し")).toHaveTextContent("「セキュリティ」について確認させてください");
  });

  it("一般ユーザーはレビューを切り替えられず、オフ(自己診断)になる", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "一般ユーザー" }));

    expect(screen.getByRole("checkbox", { name: "AI 設計レビューを使う" })).toBeDisabled();
    expect(screen.getByLabelText("レビューの状態")).toHaveTextContent("superuser だけが使える");
    expect(gateRow("要件・外部の生成の後")).toHaveTextContent("オフ(自己診断)");
    expect(screen.queryByRole("table", { name: "指摘の一覧" })).toBeNull();
  });

  it("簡易モードは4文書の生成後の1区切りで、もともと未決の観点は戻したことにしない", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "簡易モード" }));
    expect(within(screen.getByRole("table", { name: "レビューの区切り" })).getAllByRole("row")).toHaveLength(2);
    expect(findingCount()).toBe(4);

    await user.click(screen.getByRole("button", { name: "S-03 を採用" }));
    expect(screen.queryByText("未決に戻した")).toBeNull();
    expect(screen.getByLabelText("聞き直し")).toHaveTextContent("「体制・期間」");
  });
});
