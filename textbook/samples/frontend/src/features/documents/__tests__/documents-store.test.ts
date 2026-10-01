// 作成：Phase-3-6｜更新：Phase-6-6,15-7,15-8
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
    // Phase-15-8:追記
    regenerateError: null,
    // Phase-15-7:追記
    projectMode: null,
  });
}

const SAMPLE_DOC = {
  id: "d1",
  doc_type: "requirements" as const,
  content: "# 要件定義",
  version: 1,
  created_at: "2026-01-01T00:00:00Z",
  is_current: true, // Phase-6-6:追記
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
  // Phase-15-7:追記
  it("fetchProjectMode()はプロジェクトのmodeを保持し、失敗時はnullにする", async () => {
    stub.queue({ status: 200, body: { id: "p1", mode: "detailed" } });
    await useDocumentsStore.getState().fetchProjectMode("p1");
    expect(useDocumentsStore.getState().projectMode).toBe("detailed");
    expect(stub.requests[0].url).toContain("/api/v1/projects/p1");

    stub.queue({ status: 500, body: { detail: "error" } });
    await useDocumentsStore.getState().fetchProjectMode("p1");
    expect(useDocumentsStore.getState().projectMode).toBeNull();
  });

  // Phase-15-8:追記
  it("regenerate()が受け付けられなければregeneratingを下ろし、理由を保持する", async () => {
    stub.queue({
      status: 409,
      body: { detail: "設計書を生成しています。", code: "DOC_GENERATION_IN_PROGRESS" },
    });

    await useDocumentsStore.getState().regenerate("p1");

    const state = useDocumentsStore.getState();
    expect(state.regenerating).toBe(false);
    expect(state.regenerateError).toBe("設計書を生成しています。");
  });
});
