// 作成：Phase-116-1
// SUT: useMaterialsStore(資料の一覧・資料と違い・足す・消す・取り出す・捨てる/戻す・CR の下書き)
// ドライバ: vitest のテスト関数(ストアの関数を直接呼ぶ)
// スタブ: fetch(stubFetch)── ストアが API を呼ぶ順と本文、応答・失敗の後の状態を確かめるため
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMaterialsStore } from "../materials-store";
import {
  makeDifference,
  makeDifferences,
  makeFreshness,
  makeMaterial,
  makeMaterialSummary,
} from "../test-utils/materialFixtures";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

const state = () => useMaterialsStore.getState();
const META = { kind: "minutes" as const, title: "議事録", material_date: "2026-11-16" };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("useMaterialsStore", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    useMaterialsStore.setState({ projectId: null, list: [], fetchedAt: null, detail: null, differences: null });
    useChangeRequestsStore.setState({ projectId: null, fetchedAt: null });
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("一覧を読み、鮮度のある間は読み直さない。簡易モードの409は unavailable", async () => {
    stub.queue({ body: [makeMaterialSummary()] });
    await state().fetchList("p1");
    await state().fetchList("p1");
    expect(state().list).toHaveLength(1);
    expect(stub.requests).toHaveLength(1);

    stub.queue({ status: 409, body: { detail: "詳細設計モードだけ", code: "DESIGN_STAGES_NOT_AVAILABLE" } });
    await state().fetchList("p2");
    expect(state().unavailable).toBe(true);
  });

  it("資料と違いの一覧を読み、最新の束の鮮度も読む", async () => {
    stub.queue({ body: makeMaterial() });
    stub.queue({ body: makeDifferences({ latest_baseline_number: 3 }) });
    stub.queue({ body: makeFreshness({ baseline_number: 3, fresh: false, applied_after: [{ number: 6, keys: ["req:FR-001"] }] }) });

    await state().fetchDetail("p1", "m1");
    await flush();

    expect(state().detail?.id).toBe("m1");
    expect(state().differences?.differences).toHaveLength(1);
    expect(stub.requests[2].url).toContain("/api/v1/projects/p1/baselines/3/freshness");
    expect(state().latestFreshness?.fresh).toBe(false);
  });

  it("貼り付けとファイルで足し、一覧の鮮度を落とす。失敗は addError", async () => {
    useMaterialsStore.setState({ projectId: "p1", fetchedAt: Date.now() });
    stub.queue({ status: 201, body: makeMaterial({ id: "m2" }) });
    stub.queue({ status: 201, body: makeMaterial({ id: "m3", source: "pdf" }) });
    stub.queue({ status: 422, body: { detail: "本文が長すぎます", code: "MATERIAL_TOO_LONG" } });

    const pasted = await state().add("p1", { meta: META, body: "本文" });
    const uploaded = await state().add("p1", { meta: META, file: new File(["%PDF"], "a.pdf") });
    const failed = await state().add("p1", { meta: META, body: "長い" });

    expect(pasted?.id).toBe("m2");
    expect(uploaded?.id).toBe("m3");
    expect(stub.requests[1].url).toContain("/materials/upload");
    expect(state().fetchedAt).toBeNull();
    expect(failed).toBeNull();
    expect(state().addError).toBe("本文が長すぎます");
  });

  it("取り出し・捨てる・戻すは違いの一覧を置き換える", async () => {
    useMaterialsStore.setState({ projectId: "p1", detail: makeMaterial() });
    stub.queue({ body: makeDifferences() });
    stub.queue({ body: makeFreshness() });
    stub.queue({ body: makeDifference({ status: "dismissed" }) });
    stub.queue({ body: makeDifferences({ differences: [makeDifference({ status: "dismissed", dismiss_reason: "決まった" })] }) });
    stub.queue({ body: makeFreshness() });
    stub.queue({ body: makeDifference() });
    stub.queue({ body: makeDifferences() });
    stub.queue({ body: makeFreshness() });

    await state().extract("p1", "m1");
    await flush();
    expect(state().differences?.differences[0].status).toBe("unconfirmed");

    expect(await state().dismiss("p1", "m1", "d1", "決まった")).toBe(true);
    await flush();
    expect(state().differences?.differences[0].dismiss_reason).toBe("決まった");

    await state().restore("p1", "m1", "d1");
    await flush();
    // 違いの一覧を置き換えるたびに、最新の束の鮮度も読み直す
    expect(stub.requests.map((r) => r.init?.method ?? "GET")).toEqual(["POST", "GET", "PATCH", "GET", "GET", "PATCH", "GET", "GET"]);
  });

  it("CR の下書きを作ると、作った CR を返し、違いを読み直し、CR の一覧の鮮度を落とす。束を作り直した後は案内", async () => {
    useMaterialsStore.setState({ projectId: "p1", detail: makeMaterial() });
    useChangeRequestsStore.setState({ projectId: "p1", fetchedAt: Date.now() });
    stub.queue({ status: 201, body: { number: 8 } });
    stub.queue({ body: makeDifferences({ differences: [makeDifference({ status: "converted", change_request_number: 8 })] }) });
    stub.queue({ body: makeFreshness() });

    const cr = await state().createChangeRequest("p1", "m1", { difference_ids: ["d1"] });
    await flush();

    expect(cr?.number).toBe(8);
    expect(state().differences?.differences[0].change_request_number).toBe(8);
    expect(useChangeRequestsStore.getState().fetchedAt).toBeNull();

    stub.queue({ status: 409, body: { detail: "outdated", code: "MATERIAL_DIFFERENCE_OUTDATED" } });
    expect(await state().createChangeRequest("p1", "m1", { difference_ids: ["d1"] })).toBeNull();
    expect(state().actionError).toContain("取り出し直して");
  });

  it("資料を消すと、開いていた資料を閉じる", async () => {
    useMaterialsStore.setState({ projectId: "p1", detail: makeMaterial(), differences: makeDifferences() });
    stub.queue({}); // 本文なしの 204 はスタブで作れないので、200 の空で代える

    expect(await state().remove("p1", "m1")).toBe(true);
    expect(state().detail).toBeNull();
    expect(state().differences).toBeNull();
  });
});
