// 作成：Phase-53-3｜更新：Phase-54-1,54-4
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useReviewStore } from "../review-store";
import { finding, gate, run, user } from "../test-utils/reviewFixtures";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

// SUT は useReviewStore の操作、ドライバは vitest(getState() で直接呼ぶ)。スタブは stubFetch
// (API の応答を積む)── ストアは API を呼ぶので、通信を偽物にして状態の移り変わりを確かめる。
function resetStore() {
  useReviewStore.setState({
    projectId: null,
    gates: [],
    status: "idle",
    error: null,
    fetchedAt: null,
    me: null,
    savingSetting: false,
    requesting: null,
    decidingId: null,
    actionError: null,
  });
}

describe("useReviewStore", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    resetStore();
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("区切りを取り、別のプロジェクトに移ったら捨てて取り直す", async () => {
    stub.queue({ status: 200, body: [gate()] });
    await useReviewStore.getState().fetchGates("p1");
    expect(useReviewStore.getState().gates).toHaveLength(1);

    // TTL 以内は取り直さない
    await useReviewStore.getState().fetchGates("p1");
    expect(stub.requests).toHaveLength(1);

    stub.queue({ status: 200, body: [] });
    await useReviewStore.getState().fetchGates("p2");
    expect(useReviewStore.getState().projectId).toBe("p2");
    expect(useReviewStore.getState().gates).toEqual([]);
  });

  it("レビューを流すと区切りを取り直す。失敗はサーバーの文を出す", async () => {
    stub.queue({ status: 202, body: run({ status: "running" }) });
    stub.queue({ status: 200, body: [gate({ status: "running" })] });

    const accepted = await useReviewStore.getState().runReview("p1", "documents");

    expect(accepted).toBe(true);
    expect(useReviewStore.getState().gates[0].status).toBe("running");

    stub.queue({ status: 429, body: { detail: "上限に達しました", code: "REVIEW_LIMIT_EXCEEDED" } });
    expect(await useReviewStore.getState().runReview("p1", "documents")).toBe(false);
    expect(useReviewStore.getState().actionError).toBe("上限に達しました");
    expect(useReviewStore.getState().requesting).toBeNull();
  });

  it("採否は返った指摘で置き換える", async () => {
    useReviewStore.setState({
      projectId: "p1",
      gates: [gate({ status: "reviewed", run: run({ findings: [finding({ id: "f1" }), finding({ id: "f2" })] }) })],
    });
    stub.queue({ status: 200, body: finding({ id: "f2", decision: "rejected" }) });

    await useReviewStore.getState().decide("p1", "f2", "rejected");

    const findings = useReviewStore.getState().gates[0].run?.findings ?? [];
    expect(findings.map((f) => f.decision)).toEqual(["pending", "rejected"]);
    // Phase-54-1:追記
    // 前の回で採用した指摘も置き換える
    useReviewStore.setState({
      gates: [gate({ status: "reviewed", run: run(), adopted_before: [finding({ id: "f9", decision: "adopted" })] })],
    });
    stub.queue({ status: 200, body: finding({ id: "f9", decision: "held" }) });
    await useReviewStore.getState().decide("p1", "f9", "held");
    expect(useReviewStore.getState().gates[0].adopted_before[0].decision).toBe("held");
    expect(useReviewStore.getState().decidingId).toBeNull();
  });

  it("ユーザーを読み、設定を切り替える", async () => {
    stub.queue({ status: 200, body: user({ review_enabled: false, review_effective: false }) });
    await useReviewStore.getState().fetchMe();
    expect(useReviewStore.getState().me?.review_effective).toBe(false);

    stub.queue({ status: 200, body: user() });
    await useReviewStore.getState().setReviewEnabled(true);
    expect(useReviewStore.getState().me?.review_effective).toBe(true);
    expect(useReviewStore.getState().savingSetting).toBe(false);
  });

  // Phase-54-1:追記
  it("聞き直しは指摘を送り、失敗はサーバーの文を出す", async () => {
    useReviewStore.setState({ projectId: "p1" });
    stub.queue({ status: 200, body: { points: [] } });
    expect(await useReviewStore.getState().rehear("p1", ["h1"])).toBe(true);
    expect(stub.requests[0].url).toContain("/projects/p1/reviews/rehearing");
    expect(JSON.parse(String(stub.requests[0].init?.body))).toEqual({ finding_ids: ["h1"] });

    stub.queue({ status: 409, body: { detail: "聞き直す指摘を選んでください。" } });
    expect(await useReviewStore.getState().rehear("p1", [])).toBe(false);
    expect(useReviewStore.getState().actionError).toBe("聞き直す指摘を選んでください。");
    expect(useReviewStore.getState().rehearing).toBe(false);
  });
});
