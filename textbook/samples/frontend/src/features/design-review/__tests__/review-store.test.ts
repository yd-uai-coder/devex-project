// 作成：Phase-53-3
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
});
