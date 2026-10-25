// 作成：Phase-108-1｜更新：Phase-108-2,108-3
// Phase-108-2：更新
// // SUT: useShareStore(共有リンクの閲覧の読み込み)
// ↓↓
// Phase-108-3：更新
// // SUT: useShareStore(共有リンクの閲覧の読み込み・名前・コメント)
// ↓↓
// SUT: useShareStore(共有リンクの閲覧の読み込み・名前・コメント・合意 / 却下)
// ドライバ: vitest のテスト関数(ストアの関数を直接呼ぶ)
// スタブ: fetch(stubFetch)── ストアが呼ぶ公開の API と、応答・失敗の後の状態を確かめるため
// Phase-108-2:追記 ── ../test-utils/sharedFixtures.FINGERPRINT
// Phase-108-3:追記 ── ../test-utils/sharedFixtures.makeSharedWithOptions
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useShareStore } from "../share-store";
import { FINGERPRINT, makeShared, makeSharedWithOptions } from "../test-utils/sharedFixtures";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

const state = () => useShareStore.getState();

describe("useShareStore", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    // Phase-108-2：更新
    // useShareStore.setState({ token: null, shared: null, status: "idle", error: null, unavailable: false });
    // ↓↓
    useShareStore.setState({
      token: null,
      shared: null,
      status: "idle",
      error: null,
      unavailable: false,
      name: "",
      explanationChanged: false,
      commenting: false,
      commentError: null,
      // Phase-108-3:追記
      deciding: null,
      decisionError: null,
    });
    window.localStorage.clear();
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("トークンの公開の API を読む", async () => {
    stub.queue({ body: makeShared() });

    await state().load("tok-1");

    expect(stub.requests[0].url).toMatch(/\/api\/v1\/share\/tok-1$/);
    expect(state().shared?.label).toBe("CR-3");
    expect(state().status).toBe("success");
  });

  it("期限切れはリンクが使えないとして、中身を捨てる", async () => {
    stub.queue({ body: makeShared() });
    await state().load("tok-1");
    stub.queue({ status: 410, body: { detail: "…", code: "SHARE_LINK_EXPIRED" } });

    await state().load("tok-1");

    expect(state().unavailable).toBe(true);
    expect(state().shared).toBeNull();
    expect(state().error).toContain("期限が切れました");
  });

  it("回数の上限では、読んだ中身を残して知らせる", async () => {
    stub.queue({ body: makeShared() });
    await state().load("tok-1");
    stub.queue({ status: 429, body: { detail: "Too many requests" } });

    await state().load("tok-1");

    expect(state().unavailable).toBe(false);
    expect(state().shared?.label).toBe("CR-3");
    expect(state().error).toContain("しばらく待って");
  });

  it("別のトークンを開くと、前の中身を捨てる", async () => {
    stub.queue({ body: makeShared() });
    await state().load("tok-1");
    stub.queue({ status: 404, body: { detail: "Share link not found", code: "SHARE_LINK_NOT_FOUND" } });

    await state().load("tok-2");

    expect(state().token).toBe("tok-2");
    expect(state().shared).toBeNull();
  });

  // Phase-108-2:追記
  it("名前を覚え、開き直すと覚えた名前を入れる", () => {
    state().setName("山田");
    useShareStore.setState({ name: "" });

    state().restoreName();

    expect(state().name).toBe("山田");
  });

  it("コメントは名前・本文・見た説明書の版を送り、一覧に足す", async () => {
    stub.queue({ body: makeShared() });
    await state().load("tok-1");
    state().setName(" 山田 ");
    stub.queue({
      status: 201,
      body: { author: "山田", from_developer: false, body: "期間は何日まで?", created_at: "2026-10-25T00:00:00Z", replies: [] },
    });

    const sent = await state().comment("期間は何日まで?");

    expect(sent).toBe(true);
    expect(stub.requests[1].url).toMatch(/\/api\/v1\/share\/tok-1\/comments$/);
    expect(JSON.parse(stub.requests[1].init?.body as string)).toEqual({
      name: "山田",
      body: "期間は何日まで?",
      fingerprint: FINGERPRINT,
    });
    expect(state().shared?.comments).toHaveLength(1);
  });

  it("説明書が新しくなっていたら送れず、読み直すまで知らせる", async () => {
    stub.queue({ body: makeShared() });
    await state().load("tok-1");
    state().setName("山田");
    stub.queue({ status: 409, body: { detail: "…", code: "SHARE_EXPLANATION_CHANGED" } });

    const sent = await state().comment("質問");

    expect(sent).toBe(false);
    expect(state().explanationChanged).toBe(true);
    expect(state().commentError).toContain("新しくなりました");

    stub.queue({ body: makeShared({ fingerprint: "b".repeat(64) }) });
    await state().load("tok-1");
    expect(state().explanationChanged).toBe(false);
    expect(state().commentError).toBeNull();
  });

  // Phase-108-3:追記
  it("合意は名前・見た版・選んだ案を送り、判断の後の形に置き換える", async () => {
    stub.queue({ body: makeSharedWithOptions() });
    await state().load("tok-1");
    state().setName("山田");
    stub.queue({ body: makeSharedWithOptions({ state: "decided", state_label: "判断済み" }) });

    const done = await state().decide({ decision: "agreed", option: 2, reason: " " });

    expect(done).toBe(true);
    expect(stub.requests[1].url).toMatch(/\/api\/v1\/share\/tok-1\/decision$/);
    expect(JSON.parse(stub.requests[1].init?.body as string)).toEqual({
      decision: "agreed",
      name: "山田",
      fingerprint: FINGERPRINT,
      option: 2,
      reason: "",
    });
    expect(state().shared?.state).toBe("decided");
  });

  it("却下では案を送らない", async () => {
    stub.queue({ body: makeSharedWithOptions() });
    await state().load("tok-1");
    state().setName("山田");
    stub.queue({ body: makeSharedWithOptions({ state: "decided", state_label: "判断済み" }) });

    await state().decide({ decision: "rejected", option: 1, reason: "今は要らない" });

    expect(JSON.parse(stub.requests[1].init?.body as string)).toMatchObject({ option: null, reason: "今は要らない" });
  });

  it("先に開発者が判断していたら、読み直して今の状態と断られた旨を出す", async () => {
    stub.queue({ body: makeShared() });
    await state().load("tok-1");
    state().setName("山田");
    stub.queue({ status: 409, body: { detail: "…", code: "SHARE_LINK_NOT_WRITABLE" } });
    stub.queue({ body: makeShared({ state: "decided", state_label: "判断済み" }) });

    const done = await state().decide({ decision: "agreed", option: null, reason: "" });

    expect(done).toBe(false);
    expect(stub.requests).toHaveLength(3);
    expect(state().shared?.state).toBe("decided");
    expect(state().decisionError).toContain("受け付けていません");
  });
});
