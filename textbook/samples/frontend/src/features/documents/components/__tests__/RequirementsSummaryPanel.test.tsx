// 作成：Phase-36-3｜更新：Phase-36(完了後の調整)
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { RequirementsSummaryPanel } from "../RequirementsSummaryPanel";
import type { GeneratedDocumentRead } from "@/features/documents/api/documentsApi";
import { useDocumentsStore } from "@/features/documents/documents-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

const REQUIREMENTS_DOC: GeneratedDocumentRead = {
  id: "d1",
  doc_type: "requirements",
  content: "# 1. 要件定義書",
  version: 1,
  created_at: "",
  is_current: true,
  requirements: {
    counts: { user: 3, adopted: 1, assumed: 1 },
    assumed: [{ id: "NFR-001", kind: "NFR", text: "通信を HTTPS で暗号化する" }],
    issues: [
      {
        level: "minor",
        code: "ASSUMED_REQUIREMENTS",
        message: "推測の要件が1件あります(利用者に確かめてください)。",
        targets: ["NFR-001"],
      },
    ],
  },
};

function renderPanel(document: GeneratedDocumentRead) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <RequirementsSummaryPanel projectId="p1" document={document} />
    </TamaguiProvider>,
  );
}

describe("RequirementsSummaryPanel", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
    useDocumentsStore.setState({
      projectId: "p1",
      documents: [REQUIREMENTS_DOC],
      adoptingId: null,
      adoptError: null,
    });
  });

  afterEach(() => {
    stub.restore();
  });

  it("出どころの件数・指摘・推測の要件を出す", () => {
    renderPanel(REQUIREMENTS_DOC);

    expect(screen.getByText("要件の出どころ: ユーザー 3 / 採用 1 / 推測 1")).toBeInTheDocument();
    expect(screen.getByText(/【軽微】推測の要件が1件あります/)).toBeInTheDocument();
    expect(screen.getByText("通信を HTTPS で暗号化する")).toBeInTheDocument();
  });

  // Phase-36(完了後の調整):追記
  it("件数の下に出どころの意味の注釈を出す", () => {
    renderPanel(REQUIREMENTS_DOC);

    expect(screen.getByText("ユーザー: 初期入力・チャットでの回答より")).toBeInTheDocument();
    expect(screen.getByText("採用: ヒアリングで AI の提案を採用")).toBeInTheDocument();
    expect(screen.getByText("推測: ドキュメント生成時に AI が推測(未確認)")).toBeInTheDocument();
  });

  it("「採用にする」で推測の要件をサーバーへ送る", async () => {
    const user = userEvent.setup();
    stub.queue({ status: 200, body: { ...REQUIREMENTS_DOC, requirements: null } });
    renderPanel(REQUIREMENTS_DOC);

    await user.click(screen.getByRole("button", { name: "NFR-001 を採用にする" }));

    expect(stub.requests[0].url).toContain("/documents/requirements/rows/NFR-001/adopt");
    expect(stub.requests[0].init?.method).toBe("POST");
  });

  it("model の無い要件定義書(以前の版)は、再生成の案内だけを出す", () => {
    renderPanel({ ...REQUIREMENTS_DOC, requirements: null });

    expect(screen.getByText(/要件ID・出どころがありません/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("要件定義書でない文書には何も出さない", () => {
    const { container } = renderPanel({
      ...REQUIREMENTS_DOC,
      doc_type: "external_design",
      requirements: null,
    });

    expect(container.textContent).toBe("");
  });
});
