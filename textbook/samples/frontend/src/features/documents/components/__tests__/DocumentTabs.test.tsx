// 作成：Phase-3-6
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DocumentTabs } from "../DocumentTabs";
import type { GeneratedDocumentRead } from "@/features/documents/api/documentsApi";

const DOCS: GeneratedDocumentRead[] = [
  { id: "d1", doc_type: "requirements", content: "# 要件定義", version: 1, created_at: "" },
  { id: "d2", doc_type: "external_design", content: "# 外部設計", version: 1, created_at: "" },
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
});
