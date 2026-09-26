// 作成：Phase-3-6
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentsStore } from "../documents-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

function resetStore() {
  useDocumentsStore.setState({
    documents: [],
    status: "idle",
    error: null,
    fetchedAt: null,
    regenerating: false,
  });
}

const SAMPLE_DOC = {
  id: "d1",
  doc_type: "requirements" as const,
  content: "# 要件定義",
  version: 1,
  created_at: "2026-01-01T00:00:00Z",
};

describe("useDocumentsStore", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    resetStore();
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("fetchDocuments()は成功時にdocuments・fetchedAtを更新する", async () => {
    stub.queue({ status: 200, body: [SAMPLE_DOC] });

    await useDocumentsStore.getState().fetchDocuments("p1");

    expect(useDocumentsStore.getState().documents).toEqual([SAMPLE_DOC]);
    expect(useDocumentsStore.getState().status).toBe("success");
  });

  it("TTL以内であれば再フェッチをスキップし、forceで無視する", async () => {
    stub.queue({ status: 200, body: [] });
    await useDocumentsStore.getState().fetchDocuments("p1");
    expect(stub.requests).toHaveLength(1);

    await useDocumentsStore.getState().fetchDocuments("p1");
    expect(stub.requests).toHaveLength(1);

    stub.queue({ status: 200, body: [] });
    await useDocumentsStore.getState().fetchDocuments("p1", { force: true });
    expect(stub.requests).toHaveLength(2);
  });

  it("regenerate()はtriggerGenerationを呼びregeneratingを立てる", async () => {
    stub.queue({ status: 202, body: null });

    await useDocumentsStore.getState().regenerate("p1");

    expect(useDocumentsStore.getState().regenerating).toBe(true);
    expect(stub.requests[0].url).toContain("/generate");
  });

  it("onRegenerationCompleted()はregeneratingを下ろし一覧をforce再取得する", async () => {
    useDocumentsStore.setState({ regenerating: true });
    stub.queue({ status: 200, body: [SAMPLE_DOC] });

    useDocumentsStore.getState().onRegenerationCompleted("p1");

    expect(useDocumentsStore.getState().regenerating).toBe(false);
    await vi.waitFor(() => expect(useDocumentsStore.getState().documents).toEqual([SAMPLE_DOC]));
    expect(stub.requests[0].url).toContain("/documents");
  });
});
