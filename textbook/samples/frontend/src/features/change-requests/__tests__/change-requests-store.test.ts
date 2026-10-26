// 作成：Phase-87-1｜更新：Phase-88-2,88(完了後の調整),89(完了後の調整),98-2,107-2,107-3,107-4,107-5,112-4
// Phase-88-2：更新
// // SUT: useChangeRequestsStore(一覧・詳細・タブの読み込み・状態の操作・文書への反映)
// ↓↓
// Phase-89(完了後の調整)：更新
// // SUT: useChangeRequestsStore(一覧・詳細・タブの読み込み・状態の操作・文書への反映・説明書の要約)
// ↓↓
// Phase-112-4：更新
// // SUT: useChangeRequestsStore(一覧・詳細・タブの読み込み・状態の操作・文書への反映と完了の待ち直し・説明書の要約)
// ↓↓
// SUT: useChangeRequestsStore(一覧・詳細・タブの読み込み・状態の操作・競合の確かめ・文書への反映と完了の待ち直し・説明書の要約)
// ドライバ: vitest のテスト関数(ストアの関数を直接呼ぶ)
// スタブ: fetch(stubFetch)── ストアが API を呼ぶ順と本文、応答・失敗の後の状態を確かめるため
// Phase-88-2：更新
// import { makeChangeRequest, makeVerification } from "../test-utils/changeRequestFixtures";
// ↓↓
// Phase-107-2:追記 ── ../test-utils/changeRequestFixtures.makeOptions
// Phase-107-3:追記 ── ../test-utils/changeRequestFixtures.makeOptionDraft
// Phase-107-4:追記 ── ../test-utils/changeRequestFixtures.makeCreatedShareLink, ../test-utils/changeRequestFixtures.makeShareLink
// Phase-107-5:追記 ── ../test-utils/changeRequestFixtures.makeComment
// Phase-112-4:追記 ── ../test-utils/changeRequestFixtures.makeConflict
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useChangeRequestsStore } from "../change-requests-store";
import {
  makeChangeRequest,
  makeConflict,
  makeExplanation,
  makeOptionDraft,
  makeOptions,
  makeComment,
  makeCreatedShareLink,
  makeShareLink,
  makeSummary,
  makeVerification,
} from "../test-utils/changeRequestFixtures";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import type { ProjectRead } from "@/features/dashboard/api/projects";

const state = () => useChangeRequestsStore.getState();

describe("useChangeRequestsStore", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    // 前のテストの内容を捨てる(プロジェクトを開き直すと、ストアも同じ値に戻す)
    useChangeRequestsStore.setState({
      projectId: null,
      list: [],
      fetchedAt: null,
      requirements: {},
      detail: null,
      actionError: null,
      reflecting: false,
      reflectError: null,
      // Phase-88-2:追記
      summaryActing: null,
      summaryError: null,
      // Phase-107-3:追記
      draftActing: null,
      draftError: null,
      // Phase-107-4:追記
      createdLink: null,
      shareActing: null,
      shareError: null,
      // Phase-107-5:追記
      replying: null,
      replyError: null,
      // Phase-88(完了後の調整):追記
      unavailable: false,
    });
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("一覧を読み、鮮度のある間は読み直さない", async () => {
    stub.queue({ body: [makeChangeRequest()] });

    await state().fetchList("p1");
    await state().fetchList("p1");

    expect(state().list).toHaveLength(1);
    expect(state().status).toBe("success");
    expect(stub.requests).toHaveLength(1);
  });

  it("一覧の404はプロジェクトが無いとして知らせる", async () => {
    stub.queue({ status: 404, body: { detail: "not found" } });

    await state().fetchList("p1");

    expect(state().notFound).toBe(true);
  });

  it("束の要件は束ごとに1回だけ読む", async () => {
    stub.queue({ body: [{ id: "FR-001", kind: "FR", priority: null, category: "", text: "a" }] });

    await state().fetchRequirements("p1", 1);
    await state().fetchRequirements("p1", 1);

    expect(state().requirements[1]).toHaveLength(1);
    expect(stub.requests).toHaveLength(1);
  // Phase-98-2:追記
  });

  it("起点の候補は束ごとに1回だけ読む", async () => {
    stub.queue({ body: [{ key: "req:FR-001", kind: "requirement", label: "FR-001 a" }] });

    await state().fetchOrigins("p1", 1);
    await state().fetchOrigins("p1", 1);

    expect(state().origins[1]).toHaveLength(1);
    expect(stub.requests).toHaveLength(1);
    expect(stub.requests[0].url).toContain("/baselines/1/origins");
  });

  it("詳細のタブを読み、比較の 409 はタブの失敗として残す", async () => {
    stub.queue({ body: makeChangeRequest({ status: "agreed" }) });
    stub.queue({ body: makeVerification() });
    stub.queue({ status: 409, body: { detail: "反映の前です", code: "CR_NOT_APPLIED" } });

    await state().fetchDetail("p1", 1);
    await state().fetchView("p1", 1, "verification");
    await state().fetchView("p1", 1, "comparison");

    expect(state().detail?.status).toBe("agreed");
    expect(state().views.verification?.open_marks).toBe(1);
    expect(state().viewErrors.comparison).toBe("反映の前です");
  });

  it("状態の操作は詳細を置き換え、タブの内容と一覧の鮮度を捨てる", async () => {
    stub.queue({ body: makeChangeRequest() });
    stub.queue({ body: makeVerification() });
    stub.queue({ body: makeChangeRequest({ status: "explained", allowed_actions: ["edit", "agree"] }) });

    await state().fetchDetail("p1", 1);
    await state().fetchView("p1", 1, "verification");
    const ok = await state().explain("p1", 1);

    expect(ok).toBe(true);
    expect(state().detail?.status).toBe("explained");
    expect(state().views.verification).toBeNull();
    expect(state().fetchedAt).toBeNull();
    expect(state().acting).toBe(false);
  });

  // Phase-112-4:追記
  it("競合の確かめは conflict-checks を POST し、詳細を置き換える", async () => {
    stub.queue({ body: makeChangeRequest({ conflicts: [makeConflict()] }) });
    stub.queue({ body: makeChangeRequest({ conflicts: [makeConflict({ checked: true })] }) });

    await state().fetchDetail("p1", 1);
    const ok = await state().checkConflicts("p1", 1);

    expect(ok).toBe(true);
    expect(stub.requests[1].url).toMatch(/\/projects\/p1\/change-requests\/1\/conflict-checks$/);
    expect(stub.requests[1].init?.method).toBe("POST");
    expect(state().detail?.conflicts[0].checked).toBe(true);
  });

  // Phase-107-2:追記
  it("案の保存は案だけを PATCH で送り、詳細を置き換える", async () => {
    stub.queue({ body: makeChangeRequest() });
    stub.queue({ body: makeChangeRequest({ options: makeOptions() }) });

    await state().fetchDetail("p1", 1);
    const body = { items: [], recommended: null, reason: "" };
    const ok = await state().updateOptions("p1", 1, body);

    expect(ok).toBe(true);
    expect(stub.requests[1].url).toMatch(/\/change-requests\/1$/);
    expect(stub.requests[1].init?.method).toBe("PATCH");
    expect(JSON.parse(String(stub.requests[1].init?.body))).toEqual({ options: body });
    expect(state().detail?.options?.items).toHaveLength(2);
  });

  it("操作の失敗は actionError に残し、詳細は変えない", async () => {
    stub.queue({ body: makeChangeRequest({ status: "applied" }) });
    stub.queue({ status: 409, body: { detail: "未確認が残っています", code: "CR_NOT_VERIFIABLE" } });

    await state().fetchDetail("p1", 1);
    const ok = await state().verify("p1", 1, "");

    expect(ok).toBe(false);
    expect(state().actionError).toBe("未確認が残っています");
    expect(state().detail?.status).toBe("applied");
  });

  it("作成・写しは作った CR を返し、開いている詳細は変えない", async () => {
    stub.queue({ status: 201, body: makeChangeRequest({ number: 4, label: "CR-4" }) });

    const created = await state().copy("p1", 3);

    expect(created?.number).toBe(4);
    expect(stub.requests[0].url).toContain("/change-requests/3/copy");
    expect(state().detail).toBeNull();
  });

  it("文書の側の確認は返った検証の内容でタブを置き換える", async () => {
    stub.queue({ body: makeChangeRequest({ status: "applied" }) });
    stub.queue({ body: makeVerification({ open_documents: 0 }) });

    await state().fetchDetail("p1", 1);
    await state().checkDocuments("p1", 1, ["SCR-004"], true);

    expect(state().views.verification?.open_documents).toBe(0);
  });

  it("文書への反映は CR の番号を渡して再生成を始め、完了で詳細を読み直す", async () => {
    stub.queue({ status: 202, body: {} });
    stub.queue({ body: makeChangeRequest({ status: "applied" }) });

    await state().reflectDocuments("p1", 1);
    expect(state().reflecting).toBe(true);
    expect(stub.requests[0].url).toContain("/api/v1/projects/p1/generate");
    expect(JSON.parse(String(stub.requests[0].init?.body))).toEqual({ cr_number: 1 });

    state().onReflectionFinished("p1", 1, { generation_failure: null } as unknown as ProjectRead);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(state().reflecting).toBe(false);
    expect(state().detail?.status).toBe("applied");
  });

  it("生成中の 409 は失敗にせず、完了を待つ", async () => {
    stub.queue({ status: 409, body: { detail: "生成中", code: "DOC_GENERATION_IN_PROGRESS" } });

    await state().reflectDocuments("p1", 1);

    expect(state().reflecting).toBe(true);
    expect(state().reflectError).toBeNull();
  });

  // Phase-89(完了後の調整):追記
  it("詳細を開いたとき、プロジェクトが生成中なら反映の完了を待ち直し、そうでなければ待たない", async () => {
    stub.queue({ body: makeChangeRequest() });
    stub.queue({ body: { id: "p1", status: "generating" } });
    await state().fetchDetail("p1", 1);
    await state().resumeReflection("p1");
    expect(stub.requests[1].url).toMatch(/\/api\/v1\/projects\/p1$/);
    expect(state().reflecting).toBe(true);

    useChangeRequestsStore.setState({ reflecting: false });
    stub.queue({ body: { id: "p1", status: "completed" } });
    await state().resumeReflection("p1");
    expect(state().reflecting).toBe(false);
  });

  // Phase-88-2:追記
  it("説明書はタブとして読み、要約の操作は応答の説明書でタブだけを置き換える", async () => {
    stub.queue({ body: makeChangeRequest() });
    stub.queue({ body: makeExplanation() });
    stub.queue({ body: makeExplanation({ summary: makeSummary() }) });
    stub.queue({ body: makeExplanation({ summary: makeSummary({ text: "直した", edited: true }) }) });
    stub.queue({ body: makeExplanation({ summary: makeSummary({ state: "confirmed" }) }) });

    await state().fetchDetail("p1", 1);
    await state().fetchView("p1", 1, "explanation");
    expect(state().views.explanation?.summary).toBeNull();

    expect(await state().summarize("p1", 1)).toBe(true);
    expect(stub.requests[2].url).toContain("/change-requests/1/explanation/summary");
    expect(stub.requests[2].init?.method).toBe("POST");
    expect(state().views.explanation?.summary?.state).toBe("unconfirmed");

    await state().editSummary("p1", 1, "直した");
    expect(stub.requests[3].init?.method).toBe("PATCH");
    expect(JSON.parse(String(stub.requests[3].init?.body))).toEqual({ text: "直した" });
    expect(state().views.explanation?.summary?.edited).toBe(true);

    await state().confirmSummary("p1", 1);
    expect(stub.requests[4].url).toContain("/explanation/summary/confirm");
    expect(state().views.explanation?.summary?.state).toBe("confirmed");
    // CR の状態は変わらないので、詳細と一覧の鮮度はそのまま
    expect(state().detail?.status).toBe("draft");
    expect(state().summaryActing).toBeNull();
  });

  it("要約の失敗は summaryError に残し、説明書のタブは変えない", async () => {
    stub.queue({ body: makeChangeRequest() });
    stub.queue({ body: makeExplanation() });
    stub.queue({ status: 502, body: { detail: "LLM の呼び出しに失敗しました" } });

    await state().fetchDetail("p1", 1);
    await state().fetchView("p1", 1, "explanation");
    const ok = await state().summarize("p1", 1);

    expect(ok).toBe(false);
    expect(state().summaryError).toBe("LLM の呼び出しに失敗しました");
    expect(state().views.explanation?.summary).toBeNull();
  });

  // Phase-107-3:追記
  it("下書きの無い 404 は「下書きなし」として読み、作ると下書きのビューを、取り込むと詳細を置き換える", async () => {
    stub.queue({ body: makeChangeRequest() });
    stub.queue({ status: 404, body: { detail: "none", code: "CR_OPTION_DRAFT_NOT_FOUND" } });
    stub.queue({ body: makeOptionDraft() });
    stub.queue({ body: makeChangeRequest({ options: makeOptions() }) });

    await state().fetchDetail("p1", 1);
    await state().fetchView("p1", 1, "optionDraft");
    expect(state().views.optionDraft).toEqual({ draft: null });
    expect(state().viewErrors.optionDraft).toBeUndefined();

    expect(await state().draftOptions("p1", 1)).toBe(true);
    expect(stub.requests[2].url).toMatch(/\/options\/draft$/);
    expect(stub.requests[2].init?.method).toBe("POST");
    expect(state().views.optionDraft?.draft?.adoptable).toBe(true);

    expect(await state().adoptDraft("p1", 1)).toBe(true);
    expect(stub.requests[3].url).toMatch(/\/options\/draft\/adopt$/);
    expect(state().detail?.options?.items).toHaveLength(2);
    expect(state().views.optionDraft).toBeNull();
    expect(state().draftActing).toBeNull();
  });

  it("下書きの失敗は draftError に残す", async () => {
    stub.queue({ body: makeChangeRequest() });
    stub.queue({ status: 422, body: { detail: "取り込めません", code: "CR_OPTION_INVALID" } });

    await state().fetchDetail("p1", 1);
    expect(await state().adoptDraft("p1", 1)).toBe(false);

    expect(state().draftError).toBe("取り込めません");
  });

  // Phase-107-4:追記
  it("共有リンクを作るとトークンつきのリンクを持ち、CR を読み直す。別の CR を開くと捨てる", async () => {
    stub.queue({ body: makeChangeRequest() });
    stub.queue({ body: makeCreatedShareLink() });
    stub.queue({ body: makeChangeRequest({ status: "explained" }) });

    await state().fetchDetail("p1", 1);
    expect(await state().createShare("p1", 1, 30)).toBe(true);

    expect(JSON.parse(String(stub.requests[1].init?.body))).toEqual({ expires_in_days: 30 });
    expect(state().createdLink).toEqual({ number: 1, link: expect.objectContaining({ token: "tok123" }) });
    expect(state().detail?.status).toBe("explained");
    expect(state().views.shareLinks).toBeNull();

    stub.queue({ body: makeChangeRequest({ number: 2, label: "CR-2" }) });
    await state().fetchDetail("p1", 2);
    expect(state().createdLink).toBeNull();
  });

  it("取り消し・延長は応答のリンクで一覧の行を置き換え、失敗は shareError に残す", async () => {
    stub.queue({ body: makeChangeRequest() });
    stub.queue({ body: [makeShareLink(), makeShareLink({ id: "l0", state: "revoked" })] });
    stub.queue({ body: makeShareLink({ state: "revoked", state_label: "取り消し", revoked_at: "2026-10-25T01:00:00Z" }) });
    stub.queue({ status: 409, body: { detail: "取り消したリンクは延ばせません" } });

    await state().fetchDetail("p1", 1);
    await state().fetchView("p1", 1, "shareLinks");
    expect(await state().revokeShare("p1", 1, "l1")).toBe(true);
    expect(stub.requests[2].url).toMatch(/\/share-links\/l1\/revoke$/);
    expect(state().views.shareLinks?.map((l) => l.state)).toEqual(["revoked", "revoked"]);

    expect(await state().extendShare("p1", 1, "l1", 7)).toBe(false);
    expect(JSON.parse(String(stub.requests[3].init?.body))).toEqual({ expires_in_days: 7 });
    expect(state().shareError).toBe("取り消したリンクは延ばせません");
  });

  // Phase-107-5:追記
  it("返信は返ったコメントで一覧の同じコメントを置き換え、記録のタブを読み直させる", async () => {
    const answered = makeComment({ replies: [makeComment({ id: "r1", from_developer: true, can_reply: false })] });
    stub.queue({ body: makeChangeRequest() });
    stub.queue({ body: [makeComment(), makeComment({ id: "c2" })] });
    stub.queue({ body: answered });

    await state().fetchDetail("p1", 1);
    await state().fetchView("p1", 1, "comments");
    useChangeRequestsStore.setState({ views: { ...state().views, trace: { number: 1 } as never } });
    expect(await state().reply("p1", 1, "c1", "答え")).toBe(true);

    expect(stub.requests[2].url).toMatch(/\/comments\/c1\/replies$/);
    expect(JSON.parse(String(stub.requests[2].init?.body))).toEqual({ body: "答え" });
    expect(state().views.comments?.map((c) => c.replies.length)).toEqual([1, 0]);
    expect(state().views.trace).toBeNull();
    expect(state().replying).toBeNull();
  });

  // Phase-88(完了後の調整):追記
  it("簡易モードの 409 は unavailable で知らせる(一覧・詳細)", async () => {
    stub.queue({ status: 409, body: { detail: "簡易モード", code: "DESIGN_STAGES_NOT_AVAILABLE" } });
    stub.queue({ status: 409, body: { detail: "簡易モード", code: "DESIGN_STAGES_NOT_AVAILABLE" } });

    await state().fetchList("p9");
    expect(state().unavailable).toBe(true);
    await state().fetchDetail("p9", 1);
    expect(state().unavailable).toBe(true);
    expect(state().detailNotFound).toBe(false);
  });
});
