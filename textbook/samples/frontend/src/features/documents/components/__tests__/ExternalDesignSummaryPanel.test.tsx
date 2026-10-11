// 作成：Phase-37-3
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ExternalDesignSummaryPanel } from "../ExternalDesignSummaryPanel";
import type { GeneratedDocumentRead } from "@/features/documents/api/documentsApi";

// SUT: ExternalDesignSummaryPanel。ドライバ: このテスト。スタブ不要 ── 文書の応答(props)だけを
// 読んで描き、API もストアも呼ばないため。
const EXTERNAL_DOC: GeneratedDocumentRead = {
  id: "d2",
  doc_type: "external_design",
  content: "# 2. 外部設計書",
  version: 1,
  created_at: "",
  is_current: true,
  external_design: {
    counts: { screens: 3, apis: 5, integrations: 1 },
    issues: [
      {
        level: "major",
        code: "MUST_REQUIREMENT_UNCOVERED",
        message: "画面も API も無い Must の機能要件があります: FR-004",
        targets: ["FR-004"],
      },
    ],
  },
};

function renderPanel(document: GeneratedDocumentRead) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ExternalDesignSummaryPanel document={document} />
    </TamaguiProvider>,
  );
}

describe("ExternalDesignSummaryPanel", () => {
  it("件数と指摘を出す", () => {
    renderPanel(EXTERNAL_DOC);

    expect(screen.getByText("画面 3 / API 5 / 外部連携 1")).toBeInTheDocument();
    expect(
      screen.getByText("【中程度】画面も API も無い Must の機能要件があります: FR-004"),
    ).toBeInTheDocument();
  });

  it("指摘が無ければ、その旨を出す", () => {
    const counts = { screens: 1, apis: 1, integrations: 0 };
    renderPanel({ ...EXTERNAL_DOC, external_design: { counts, issues: [] } });

    expect(screen.getByText(/指摘はありません/)).toBeInTheDocument();
  });

  it("model の無い以前の版は、再生成の案内を出す", () => {
    renderPanel({ ...EXTERNAL_DOC, external_design: null });

    expect(screen.getByText(/要件ID との対応がありません/)).toBeInTheDocument();
  });

  it("ほかの文書には出さない", () => {
    const { container } = renderPanel({ ...EXTERNAL_DOC, doc_type: "requirements" });

    expect(container.textContent).toBe("");
  });
});
