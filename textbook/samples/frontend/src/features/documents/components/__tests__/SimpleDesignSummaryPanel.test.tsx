// 作成：Phase-45-5
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { SimpleDesignSummaryPanel } from "../SimpleDesignSummaryPanel";
import type { GeneratedDocumentRead } from "@/features/documents/api/documentsApi";

// SUT: SimpleDesignSummaryPanel。ドライバ: このテスト。スタブ不要 ── 文書の応答(props)だけを
// 読んで描き、API もストアも呼ばないため。
const INTERNAL_DOC: GeneratedDocumentRead = {
  id: "d3",
  doc_type: "internal_design",
  content: "# 3. 内部設計書",
  version: 1,
  created_at: "",
  is_current: true,
  internal_design: {
    counts: { tables: 2, apis: 4, modules: 6, dataflows: 3 },
    issues: [
      {
        level: "major",
        code: "API_WITHOUT_DATAFLOW",
        message: "処理別データフローの無い、外部設計書の API があります: GET /api/v1/x",
        targets: ["GET /api/v1/x"],
      },
    ],
  },
};

const PLAN_DOC: GeneratedDocumentRead = {
  ...INTERNAL_DOC,
  id: "d4",
  doc_type: "implementation_plan",
  internal_design: null,
  implementation_plan: { counts: { milestones: 2, tasks: 5, risks: 1 }, issues: [] },
};

function renderPanel(document: GeneratedDocumentRead) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <SimpleDesignSummaryPanel document={document} />
    </TamaguiProvider>,
  );
}

describe("SimpleDesignSummaryPanel", () => {
  it("内部設計書の件数と指摘を出す", () => {
    renderPanel(INTERNAL_DOC);

    expect(screen.getByText("テーブル 2 / API 4 / モジュール 6 / 処理 3")).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "内部設計書の指摘" }),
    ).toHaveTextContent("【中程度】処理別データフローの無い、外部設計書の API があります");
  });

  it("実装計画書の件数を出し、指摘が無ければその旨を出す", () => {
    renderPanel(PLAN_DOC);

    expect(screen.getByText("マイルストーン 2 / タスク 5 / リスク 1")).toBeInTheDocument();
    expect(screen.getByText(/機能のタスクには、どれも処理と要件があります/)).toBeInTheDocument();
  });

  it("model の無い以前の版は、再生成の案内を出す", () => {
    renderPanel({ ...PLAN_DOC, implementation_plan: null });

    expect(screen.getByText(/書き落としの検証がありません/)).toBeInTheDocument();
  });

  it("ほかの文書には出さない", () => {
    const { container } = renderPanel({ ...INTERNAL_DOC, doc_type: "external_design" });

    expect(container.textContent).toBe("");
  });
});
