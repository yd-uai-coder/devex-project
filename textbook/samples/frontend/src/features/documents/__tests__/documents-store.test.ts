// 作成：Phase-3-6｜更新：Phase-6-6,15-7,15-8,24(完了後の調整),36-3,53(完了後の調整),54-2,64-4
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentsStore } from "../documents-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

function resetStore() {
  useDocumentsStore.setState({
    // Phase-24:追記
    projectId: null,
    documents: [],
    status: "idle",
    error: null,
    fetchedAt: null,
    regenerating: false,
    // Phase-15-8:追記
    regenerateError: null,
    // Phase-15-7:追記
    projectMode: null,
    // Phase-36-3:追記
    // Phase-64-4:追記
    projectTitle: null,
    adoptingId: null,
    adoptError: null,
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

  // Phase-24:追記
  it("別のプロジェクトを開くと、TTL以内でも前の文書・モードを捨てて取り直す", async () => {
    stub.queue({ status: 200, body: [SAMPLE_DOC, { ...SAMPLE_DOC, id: "d2", doc_type: "internal_design" }] });
    await useDocumentsStore.getState().fetchDocuments("p1");
    useDocumentsStore.setState({ projectMode: "simple" });

    stub.queue({ status: 200, body: [SAMPLE_DOC] });
    const pending = useDocumentsStore.getState().fetchDocuments("p2");
    // 取得を待つ間も、前のプロジェクトの文書・モードは見せない
    expect(useDocumentsStore.getState().documents).toEqual([]);
    expect(useDocumentsStore.getState().projectMode).toBeNull();
    await pending;

    expect(stub.requests).toHaveLength(2);
    expect(useDocumentsStore.getState().projectId).toBe("p2");
    expect(useDocumentsStore.getState().documents).toEqual([SAMPLE_DOC]);
  });

  it("regenerate()はtriggerGenerationを呼びregeneratingを立てる", async () => {
    stub.queue({ status: 202, body: null });

    await useDocumentsStore.getState().regenerate("p1");

    expect(useDocumentsStore.getState().regenerating).toBe(true);
    expect(stub.requests[0].url).toContain("/generate");
  });

  // Phase-53(完了後の調整):追記
  it("regenerate()に起点を渡すと本文で送り、全部のときは本文を送らない", async () => {
    stub.queue({ status: 202, body: null });
    stub.queue({ status: 202, body: null });

    await useDocumentsStore.getState().regenerate("p1", "internal_design");
    await useDocumentsStore.getState().regenerate("p1");

    expect(JSON.parse(String(stub.requests[0].init?.body))).toEqual({ start_from: "internal_design" });
    expect(stub.requests[1].init?.body).toBeUndefined();
  });

  // Phase-54-2:追記
  it("regenerate()に採用した指摘を渡すと本文の finding_ids で送る", async () => {
    stub.queue({ status: 202, body: null });

    await useDocumentsStore.getState().regenerate("p1", undefined, ["f1", "f2"]);

    expect(JSON.parse(String(stub.requests[0].init?.body))).toEqual({ finding_ids: ["f1", "f2"] });
  });

  it("fetchProgress()は進み具合を読み、完了したら消す", async () => {
    useDocumentsStore.setState({ projectId: "p1", regenerating: true });
    const progress = { targets: ["implementation_plan"], done: [], current: "implementation_plan" };
    stub.queue({ status: 200, body: progress });

    await useDocumentsStore.getState().fetchProgress("p1");

    expect(stub.requests[0].url).toContain("/api/v1/projects/p1/generation-progress");
    expect(useDocumentsStore.getState().progress).toEqual(progress);
    stub.queue({ status: 200, body: [] });
    useDocumentsStore.getState().onRegenerationCompleted("p1");
    expect(useDocumentsStore.getState().progress).toBeNull();
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
  // Phase-64-4：更新
  // it("fetchProjectMode()はプロジェクトのmodeを保持し、失敗時はnullにする", async () => {
  //   stub.queue({ status: 200, body: { id: "p1", mode: "detailed" } });
  // ↓↓
  it("fetchProjectMode()はプロジェクトのmodeと名前を保持し、失敗時はnullにする", async () => {
    stub.queue({ status: 200, body: { id: "p1", mode: "detailed", title: "備品予約" } });
    await useDocumentsStore.getState().fetchProjectMode("p1");
    expect(useDocumentsStore.getState().projectMode).toBe("detailed");
    // Phase-64-4:追記
    expect(useDocumentsStore.getState().projectTitle).toBe("備品予約");
    expect(stub.requests[0].url).toContain("/api/v1/projects/p1");

    stub.queue({ status: 500, body: { detail: "error" } });
    await useDocumentsStore.getState().fetchProjectMode("p1");
    expect(useDocumentsStore.getState().projectMode).toBeNull();
    // Phase-64-4:追記
    expect(useDocumentsStore.getState().projectTitle).toBeNull();
  });

  // Phase-15-8:追記
  // Phase-53(完了後の調整)：更新
  // it("regenerate()が受け付けられなければregeneratingを下ろし、理由を保持する", async () => {
  //   stub.queue({
  //     status: 409,
  //     body: { detail: "設計書を生成しています。", code: "DOC_GENERATION_IN_PROGRESS" },
  //   });

  //   await useDocumentsStore.getState().regenerate("p1");

  //   const state = useDocumentsStore.getState();
  //   expect(state.regenerating).toBe(false);
  //   expect(state.regenerateError).toBe("設計書を生成しています。");
  // });

  // // Phase-36-3:追記
  // ↓↓
  it("regenerate()が受け付けられなければregeneratingを下ろし、理由を保持する", async () => {
    stub.queue({ status: 500, body: { detail: "生成を開始できませんでした。" } });

    await useDocumentsStore.getState().regenerate("p1");

    const state = useDocumentsStore.getState();
    expect(state.regenerating).toBe(false);
    expect(state.regenerateError).toBe("生成を開始できませんでした。");
  });

  it("regenerate()がすでに生成中(409 DOC_GENERATION_IN_PROGRESS)なら、失敗にせず完了を待つ", async () => {
    stub.queue({
      status: 409,
      body: { detail: "設計書を生成しています。", code: "DOC_GENERATION_IN_PROGRESS" },
    });

    await useDocumentsStore.getState().regenerate("p1");

    const state = useDocumentsStore.getState();
    expect(state.regenerating).toBe(true);
    expect(state.regenerateError).toBeNull();
  });

  it("fetchProjectMode()はプロジェクトが生成中ならregeneratingにする(読み込み直した後も完了を待つ)", async () => {
    stub.queue({ status: 200, body: { id: "p1", mode: "simple", status: "generating" } });
    await useDocumentsStore.getState().fetchProjectMode("p1");
    expect(useDocumentsStore.getState().regenerating).toBe(true);

    useDocumentsStore.setState({ regenerating: false });
    stub.queue({ status: 200, body: { id: "p1", mode: "simple", status: "completed" } });
    await useDocumentsStore.getState().fetchProjectMode("p1");
    expect(useDocumentsStore.getState().regenerating).toBe(false);
  });

  it("adoptRequirement()は返った要件定義書で同じ文書を置き換える(ほかの文書は変えない)", async () => {
    const external = { ...SAMPLE_DOC, id: "d2", doc_type: "external_design" as const };
    useDocumentsStore.setState({ projectId: "p1", documents: [SAMPLE_DOC, external] });
    const adopted = { ...SAMPLE_DOC, content: "# 採用後" };
    stub.queue({ status: 200, body: adopted });

    await useDocumentsStore.getState().adoptRequirement("p1", "NFR-001");

    expect(useDocumentsStore.getState().documents).toEqual([adopted, external]);
    expect(useDocumentsStore.getState().adoptingId).toBeNull();
  });

  it("adoptRequirement()の失敗はadoptErrorに残し、文書は変えない", async () => {
    useDocumentsStore.setState({ projectId: "p1", documents: [SAMPLE_DOC] });
    stub.queue({ status: 409, body: { detail: { code: "REQUIREMENT_NOT_ASSUMED", message: "推測ではありません" } } });

    await useDocumentsStore.getState().adoptRequirement("p1", "FR-001");

    expect(useDocumentsStore.getState().documents).toEqual([SAMPLE_DOC]);
    expect(useDocumentsStore.getState().adoptError).not.toBeNull();
    expect(useDocumentsStore.getState().adoptingId).toBeNull();
  });
});
