// 作成：Phase-57-2｜更新：Phase-57(完了後の調整)
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { TestSpecPanel } from "../TestSpecPanel";
import type { TestSpecRead } from "@/features/documents/api/documentsApi";
import type { Readiness } from "@/features/documents/testSpecOps";
import { makeTestSpec } from "@/features/documents/test-utils/testSpecFixtures";

// SUT: TestSpecPanel / ドライバ: render と操作 /
// スタブ: onGenerate(生成の受け付けの代わり)。本文の表示(DocumentMarkdownView)は本物を使う。

function renderPanel({
  testSpec = makeTestSpec(),
  readiness = { ready: true, reason: null },
  generating = false,
  onGenerate = vi.fn(),
}: {
  testSpec?: TestSpecRead | null;
  readiness?: Readiness;
  generating?: boolean;
  onGenerate?: () => void;
} = {}) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <TestSpecPanel
        projectId="p1"
        testSpec={testSpec}
        loading={false}
        generating={generating}
        generateError={null}
        readiness={readiness}
        emptyNotice="まだありません"
        onGenerate={onGenerate}
      />
    </TamaguiProvider>,
  );
  return onGenerate;
}

describe("TestSpecPanel", () => {
  it("件数・検証の結果・本文を出し、作り直せる", async () => {
    const user = userEvent.setup();
    const onGenerate = renderPanel({ testSpec: makeTestSpec({ design_gaps: 2 }) });

    expect(screen.getByLabelText("テストの件数")).toHaveTextContent("結合 12 件・総合 5 件(「設計に無い」2 件)");
    expect(screen.getByRole("table", { name: "テスト仕様書の検証の結果" })).toBeInTheDocument();
    // Phase-57(完了後の調整)：更新
    // expect(screen.getByRole("heading", { name: "テスト仕様書" })).toBeInTheDocument();
    // ↓↓
    expect(screen.getByRole("heading", { name: "テスト仕様書(結合・総合)" })).toBeInTheDocument();
    expect(screen.getByText("※単体テストのテスト観点は実装手順書で個別に確認")).toBeInTheDocument();
    expect(screen.queryByText(/入力(.*)が変わりました/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "テスト仕様書を作り直す" }));
    expect(onGenerate).toHaveBeenCalled();
  });

  it("古いときは注記を出す", () => {
    renderPanel({ testSpec: makeTestSpec({ outdated: true }) });

    expect(screen.getByRole("status")).toHaveTextContent("作り直してください");
  });

  it("まだ無ければ案内と「作る」を出し、作れないときは押せず理由を出す", () => {
    renderPanel({ testSpec: null, readiness: { ready: false, reason: "段階7が承認されていません。" } });

    expect(screen.getByText("まだありません")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "テスト仕様書を作る" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent("段階7が承認されていません。");
  });

  it("作っている間は押せない", () => {
    renderPanel({ generating: true });

    expect(screen.getByRole("button", { name: "作っています..." })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/テスト仕様書を作っています/)).toBeInTheDocument();
  });
});
