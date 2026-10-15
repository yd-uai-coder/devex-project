// 作成：Phase-6-2｜更新：Phase-6-6,57-2
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { VersionHistoryPanel } from "../VersionHistoryPanel";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { useDocumentsStore } from "@/features/documents/documents-store";

const V1 = {
  id: "d1",
  doc_type: "requirements" as const,
  content: "v1",
  version: 1,
  created_at: "2026-01-01T00:00:00Z",
  is_current: false, // Phase-6-6:追記
};
const V2 = {
  id: "d2",
  doc_type: "requirements" as const,
  content: "v2",
  version: 2,
  created_at: "2026-01-02T00:00:00Z",
  is_current: true, // Phase-6-6:追記
};

// Phase-57-2：更新
// function renderPanel() {
// ↓↓
function renderPanel(docType: "requirements" | "test_spec" = "requirements") {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      // Phase-57-2：更新
      // <VersionHistoryPanel projectId="p1" docType="requirements" />
      // ↓↓
      <VersionHistoryPanel projectId="p1" docType={docType} />
    </TamaguiProvider>,
  );
}

describe("VersionHistoryPanel", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
    useDocumentsStore.setState({
      documents: [],
      status: "idle",
      error: null,
      fetchedAt: null,
      regenerating: false,
    });
  });

  afterEach(() => {
    stub.restore();
    vi.restoreAllMocks();
  });

  it("トグルボタン押下で履歴一覧を取得して表示する(新しい順)", async () => {
    stub.queue({ status: 200, body: [V2, V1] });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "バージョン履歴" }));

    expect(await screen.findByText(/v2\(最新\)/)).toBeInTheDocument();
    expect(screen.getByText(/v1/)).toBeInTheDocument();
    expect(stub.requests[0].url).toContain("/documents/requirements/versions");
  });

  // Phase-6-6：更新(「最新」ではなく「表示中」の版に復元ボタンを出さない)
  // it("最新版には復元ボタンを表示しない", async () => { ... v2=最新には出さない ... });
  // ↓↓
  it("表示中の版には(表示中)バッジを付け、復元ボタンを表示しない", async () => {
    stub.queue({ status: 200, body: [V2, V1] });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "バージョン履歴" }));
    await screen.findByText(/v2\(最新\)\(表示中\)/);

    expect(
      screen.queryAllByRole("button", { name: "この内容で復元する" }),
    ).toHaveLength(1); // v1の分のみ(v2=表示中には出さない)
  });

  // Phase-6-6：更新(復元は新バージョンを作らず表示中バッジを付け替えるだけ)
  // 旧: restoreの応答(version:3の新バージョン)を先頭に追加し、行数が増えることを暗黙に許容していた。
  // ↓↓
  it("復元ボタン押下でrestoreを呼び、バージョンを増やさず表示中バッジを付け替え、documents-storeをforce再取得する", async () => {
    stub.queue({ status: 200, body: [V2, V1] }); // 初回の一覧取得(v1は表示中でないので復元可能)
    stub.queue({ status: 200, body: { ...V1, is_current: true } }); // restore(版番号はそのまま)
    stub.queue({ status: 200, body: [] }); // force再取得
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "バージョン履歴" }));
    await screen.findByText(/v2\(最新\)\(表示中\)/);

    await user.click(screen.getByRole("button", { name: "この内容で復元する" }));

    await vi.waitFor(() => expect(stub.requests).toHaveLength(3));
    expect(stub.requests[1].url).toContain("/versions/1/restore");
    expect(stub.requests[1].init?.method).toBe("POST");
    expect(stub.requests[2].url).toContain("/documents");
    // 表示中バッジがv1へ移り、行数(=バージョン数)は増えない
    expect(await screen.findByText(/v1\(表示中\)/)).toBeInTheDocument();
    expect(screen.getByText(/v2\(最新\)/)).not.toHaveTextContent("(表示中)");
    expect(screen.queryByText(/v3/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この内容で復元する" })).toBeInTheDocument(); // 今度はv2側
  });

  // Phase-57-2:追記
  it("テスト仕様書を復元したら、文書の一覧ではなくテスト仕様書を取り直す", async () => {
    const spec = { ...V1, doc_type: "test_spec" as const };
    stub.queue({ status: 200, body: [{ ...spec, version: 2, is_current: true }, spec] });
    stub.queue({ status: 200, body: { ...spec, is_current: true } });
    stub.queue({ status: 404, body: { detail: "test_spec not found" } });
    const user = userEvent.setup();
    renderPanel("test_spec");
    await user.click(screen.getByRole("button", { name: "バージョン履歴" }));
    await screen.findByText(/v2\(最新\)\(表示中\)/);

    await user.click(screen.getByRole("button", { name: "この内容で復元する" }));

    await vi.waitFor(() => expect(stub.requests).toHaveLength(3));
    expect(stub.requests[1].url).toContain("/documents/test_spec/versions/1/restore");
    expect(stub.requests[2].url).toContain("/test-spec");
  });

  it("取得失敗時はエラーを表示する", async () => {
    stub.queue({ status: 500, body: {} });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "バージョン履歴" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
