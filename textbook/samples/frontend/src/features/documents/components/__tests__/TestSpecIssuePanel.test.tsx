// 作成：Phase-57-2
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { TestSpecIssuePanel } from "../TestSpecIssuePanel";
import { makeTestSpec } from "@/features/documents/test-utils/testSpecFixtures";

// SUT: TestSpecIssuePanel / ドライバ: render と操作 /
// スタブ不要 ── 指摘を props で受けて表にするだけで、外部を呼ばないため。

function renderPanel(issues = makeTestSpec().issues) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <TestSpecIssuePanel issues={issues} />
    </TamaguiProvider>,
  );
}

describe("TestSpecIssuePanel", () => {
  it("指摘を 重要度・対象・内容 の表にし、重要度で絞り込める", async () => {
    const user = userEvent.setup();
    renderPanel();

    const table = screen.getByRole("table", { name: "テスト仕様書の検証の結果" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("FR-007")).toBeInTheDocument();
    expect(within(table).getByText("テストの無い Must の機能要件")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "軽微(1)" }));

    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByText("異常系のテストが無い API")).toBeInTheDocument();
  });

  it("指摘が無ければ「指摘はありません」", () => {
    renderPanel([]);

    expect(screen.getByText("指摘はありません。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "すべて(0)" })).toBeInTheDocument();
  });
});
