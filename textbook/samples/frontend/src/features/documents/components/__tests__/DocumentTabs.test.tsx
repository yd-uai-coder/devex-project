// 作成：Phase-3-6｜更新：Phase-6-6,53-4,57-2,57(完了後の調整)
// Phase-53-4:追記 ── vitest.vi
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DocumentTabs } from "../DocumentTabs";
import type { GeneratedDocumentRead } from "@/features/documents/api/documentsApi";

const DOCS: GeneratedDocumentRead[] = [
  { id: "d1", doc_type: "requirements", content: "# 要件定義", version: 1, created_at: "", is_current: true },
  { id: "d2", doc_type: "external_design", content: "# 外部設計", version: 1, created_at: "", is_current: true },
];

function renderTabs(documents: GeneratedDocumentRead[] = DOCS) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DocumentTabs projectId="p1" documents={documents} />
    </TamaguiProvider>,
  );
}

describe("DocumentTabs", () => {
  it("ドキュメントが無ければ何も表示しない", () => {
    renderTabs([]);

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("存在するdoc_typeの分だけタブを表示し、最初のタブの内容を表示する", () => {
    renderTabs();

    expect(screen.getByRole("tab", { name: "要件定義" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "外部設計" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "内部設計" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "要件定義" })).toBeInTheDocument();
  });

  it("タブ切り替えで表示内容が変わる", async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole("tab", { name: "外部設計" }));

    expect(screen.getByRole("heading", { name: "外部設計" })).toBeInTheDocument();
  });

  // Phase-53-4:追記
  it("選んでいる文書を親が持つときは、その文書を出し、タブの切り替えを親へ伝える", async () => {
    const user = userEvent.setup();
    const onActiveTypeChange = vi.fn();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <DocumentTabs
          projectId="p1"
          documents={DOCS}
          activeType="external_design"
          onActiveTypeChange={onActiveTypeChange}
        />
      </TamaguiProvider>,
    );

    expect(screen.getByRole("heading", { name: "外部設計" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "要件定義" }));
    expect(onActiveTypeChange).toHaveBeenCalledWith("requirements");
  });

  // Phase-57-2:追記
  it("テスト仕様書のタブの中身を渡すと、4文書の後ろに「テスト仕様書(結合・総合)」のタブを足す", async () => {
    const user = userEvent.setup();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <DocumentTabs projectId="p1" documents={DOCS} testSpecTab={() => <p>テスト仕様書の中身</p>} />
      </TamaguiProvider>,
    );

    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    // Phase-57(完了後の調整)：更新
    // expect(tabs).toEqual(["要件定義", "外部設計", "テスト仕様"]);
    // ↓↓
    expect(tabs).toEqual(["要件定義", "外部設計", "テスト仕様書(結合・総合)"]);

    // Phase-57(完了後の調整)：更新
    // await user.click(screen.getByRole("tab", { name: "テスト仕様" }));
    // ↓↓
    await user.click(screen.getByRole("tab", { name: "テスト仕様書(結合・総合)" }));
    expect(screen.getByText("テスト仕様書の中身")).toBeInTheDocument();
  });
});
