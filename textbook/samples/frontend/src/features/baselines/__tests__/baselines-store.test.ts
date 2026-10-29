// 作成：Phase-88-2｜更新：Phase-88(完了後の調整),116-4
// SUT: useBaselinesStore(一覧・中身・段階の状態・作成)
// ドライバ: vitest のテスト関数(ストアの関数を直接呼ぶ)
// スタブ: fetch(stubFetch)── ストアが API を呼ぶ順と本文、応答・失敗の後の状態を確かめるため
// Phase-116-4:追記 ── @/features/materials/test-utils/materialFixtures.makeFreshness
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useBaselinesStore } from "../baselines-store";
import { makeBaseline, makeBaselineSummary } from "../test-utils/baselineFixtures";
import { makeFreshness } from "@/features/materials/test-utils/materialFixtures";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

const state = () => useBaselinesStore.getState();
const BODY = {
  agreed_at: "2026-10-20T01:00:00.000Z",
  counterpart: null,
  memo: "",
  reason: "合意",
  change_request_numbers: [1],
};

describe("useBaselinesStore", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    // Phase-88(完了後の調整)：更新
    // useBaselinesStore.setState({ projectId: null, list: [], fetchedAt: null, detail: null, stages: null });
    // ↓↓
    useBaselinesStore.setState({ projectId: null, list: [], fetchedAt: null, detail: null, stages: null, unavailable: false });
    useChangeRequestsStore.setState({ projectId: null, fetchedAt: null, baselines: null });
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("一覧を読み、鮮度のある間は読み直さない。404はプロジェクトが無いとして知らせる", async () => {
    stub.queue({ body: [makeBaselineSummary()] });
    await state().fetchList("p1");
    await state().fetchList("p1");
    expect(state().list).toHaveLength(1);
    expect(stub.requests).toHaveLength(1);

    stub.queue({ status: 404, body: { detail: "not found" } });
    await state().fetchList("p2");
    expect(state().notFound).toBe(true);
    expect(state().list).toEqual([]);
  });

  // Phase-116-4：更新
  // it("中身と段階の状態を読む", async () => {
  // ↓↓
  it("中身と鮮度と段階の状態を読む", async () => {
    stub.queue({ body: makeBaseline({ number: 2 }) });
    // Phase-116-4:追記
    stub.queue({ body: makeFreshness({ baseline_number: 2, fresh: false, outdated_stages: [5] }) });
    stub.queue({ body: [{ stage: 1, state: "approved", approved_version: 1, generation_status: null }] });

    await state().fetchDetail("p1", 2);
    // Phase-116-4:追記
    await new Promise((resolve) => setTimeout(resolve, 0));
    await state().fetchStages("p1");

    expect(state().detail?.number).toBe(2);
    // Phase-116-4：更新
    // expect(stub.requests[1].url).toContain("/api/v1/projects/p1/design-stages");
    // ↓↓
    expect(stub.requests[1].url).toContain("/api/v1/projects/p1/baselines/2/freshness");
    expect(state().freshness?.outdated_stages).toEqual([5]);
    expect(stub.requests[2].url).toContain("/api/v1/projects/p1/design-stages");
    expect(state().stages).toHaveLength(1);
  });

  it("作成は作った束を返し、束の一覧を読み直し、CR の一覧と基準の束の鮮度を落とす", async () => {
    useChangeRequestsStore.setState({ projectId: "p1", fetchedAt: Date.now(), baselines: [makeBaselineSummary()] });
    stub.queue({ status: 201, body: makeBaseline({ number: 2 }) });
    stub.queue({ body: [makeBaselineSummary({ number: 2 }), makeBaselineSummary()] });

    const created = await state().create("p1", BODY);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(created?.number).toBe(2);
    expect(JSON.parse(String(stub.requests[0].init?.body))).toEqual(BODY);
    expect(state().list).toHaveLength(2);
    expect(useChangeRequestsStore.getState().fetchedAt).toBeNull();
    expect(useChangeRequestsStore.getState().baselines).toBeNull();
  });

  it("作成の失敗は createError に残す", async () => {
    stub.queue({ status: 409, body: { detail: "検証済みではありません", code: "CR_NOT_INCLUDABLE" } });

    const created = await state().create("p1", BODY);

    expect(created).toBeNull();
    expect(state().createError).toBe("検証済みではありません");
    expect(state().creating).toBe(false);
  });

  // Phase-88(完了後の調整):追記
  it("簡易モードの 409 は unavailable で知らせる", async () => {
    stub.queue({ status: 409, body: { detail: "簡易モード", code: "DESIGN_STAGES_NOT_AVAILABLE" } });

    await state().fetchList("p1");

    expect(state().unavailable).toBe(true);
    expect(state().notFound).toBe(false);
  });
});
