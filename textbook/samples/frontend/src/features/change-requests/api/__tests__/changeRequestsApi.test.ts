// 作成：Phase-87-1｜更新：Phase-88-2
// Phase-88-2：更新
// // SUT: changeRequestsApi(CR・束の要件の API の薄い包み)
// ↓↓
// SUT: changeRequestsApi(CR の API の薄い包み)
// ドライバ: vitest のテスト関数
// スタブ: fetch(stubFetch)── 送ったメソッド・URL・本文と、応答の受け渡しを確かめるため
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkChangeRequestDocuments,
  // Phase-88-2:追記
  confirmExplanationSummary,
  copyChangeRequest,
  createChangeRequest,
  // Phase-88-2:追記
  createExplanationSummary,
  decideChangeRequest,
  downloadExplanation,
  // Phase-88-2:追記
  editExplanationSummary,
  explainChangeRequest,
  getChangeRequest,
  getChangeRequestComparison,
  getChangeRequestImpact,
  getChangeRequestTrace,
  getChangeRequestVerification,
  // Phase-88-2:追記
  getExplanation,
  linkChangeRequestReview,
  // Phase-88-2：削除
  // listBaselineRequirements,
  // listBaselines,
  listChangeRequests,
  listReviewCandidates,
  updateChangeRequest,
  verifyChangeRequest,
  withdrawChangeRequest,
} from "../changeRequestsApi";
import { makeChangeRequest } from "../../test-utils/changeRequestFixtures";
import { ApiError } from "@/lib/api/client";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

const BASE = "/api/v1/projects/p1/change-requests";
const body = (stub: ReturnType<typeof stubFetch>, i = 0) => JSON.parse(String(stub.requests[i].init?.body));

describe("changeRequestsApi", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("作成は POST で本文をそのまま送り、作った CR を返す", async () => {
    stub.queue({ status: 201, body: makeChangeRequest() });
    const payload = {
      title: "t",
      content: "c",
      background_source: "email" as const,
      background_date: null,
      background_memo: "",
      targets: [{ requirement_id: "FR-001", kind: "delete" as const, proposed_text: "" }],
      adds_requirement: false,
      baseline_number: 2,
    };

    const created = await createChangeRequest("p1", payload);

    expect(created.label).toBe("CR-1");
    expect(stub.requests[0].url).toContain(BASE);
    expect(stub.requests[0].init?.method).toBe("POST");
    expect(body(stub)).toEqual(payload);
  });

  it("一覧・詳細・タブの読み込みは GET で各パスを呼ぶ", async () => {
    for (let i = 0; i < 7; i++) stub.queue({ body: [] });

    await listChangeRequests("p1");
    await getChangeRequest("p1", 3);
    await getChangeRequestImpact("p1", 3);
    await getChangeRequestComparison("p1", 3);
    await getChangeRequestVerification("p1", 3);
    await getChangeRequestTrace("p1", 3);
    await listReviewCandidates("p1", 3);

    expect(stub.requests.map((r) => r.url.replace(/^.*\/api/, "/api"))).toEqual([
      BASE,
      `${BASE}/3`,
      `${BASE}/3/impact`,
      `${BASE}/3/comparison`,
      `${BASE}/3/verification`,
      `${BASE}/3/trace`,
      `${BASE}/3/review-candidates`,
    ]);
    expect(stub.requests.every((r) => r.init?.method === undefined)).toBe(true);
  });

  it("編集は PATCH、文書の側の確認は PUT で送る", async () => {
    stub.queue({ body: makeChangeRequest() });
    stub.queue({ body: {} });
    const update = {
      title: "t",
      content: "c",
      background_source: "meeting" as const,
      background_date: "2026-10-19",
      background_memo: "m",
      targets: [],
      adds_requirement: true,
    };

    await updateChangeRequest("p1", 1, update);
    await checkChangeRequestDocuments("p1", 1, ["SCR-004"], false);

    expect(stub.requests[0].init?.method).toBe("PATCH");
    expect(body(stub, 0)).toEqual(update);
    expect(stub.requests[1].url).toContain(`${BASE}/1/document-checks`);
    expect(stub.requests[1].init?.method).toBe("PUT");
    expect(body(stub, 1)).toEqual({ keys: ["SCR-004"], reviewed: false });
  });

  it("状態の操作は POST で、本文の要るものだけ本文を付ける", async () => {
    for (let i = 0; i < 6; i++) stub.queue({ body: makeChangeRequest() });
    const decision = {
      decision: "agreed" as const,
      decided_at: "2026-10-19T01:00:00.000Z",
      counterpart: null,
      memo: "",
      reason: "合意した",
    };

    await explainChangeRequest("p1", 1);
    await decideChangeRequest("p1", 1, decision);
    await withdrawChangeRequest("p1", 1, "不要になった");
    await copyChangeRequest("p1", 1);
    await verifyChangeRequest("p1", 1, "確かめた");
    await linkChangeRequestReview("p1", 1, "r1");

    expect(stub.requests.map((r) => r.url.replace(/^.*change-requests\/1/, ""))).toEqual([
      "/explain",
      "/decision",
      "/withdraw",
      "/copy",
      "/verify",
      "/reviews",
    ]);
    expect(stub.requests.every((r) => r.init?.method === "POST")).toBe(true);
    expect(stub.requests[0].init?.body).toBeUndefined();
    expect(body(stub, 1)).toEqual(decision);
    expect(body(stub, 2)).toEqual({ reason: "不要になった" });
    expect(stub.requests[3].init?.body).toBeUndefined();
    expect(body(stub, 4)).toEqual({ note: "確かめた" });
    expect(body(stub, 5)).toEqual({ review_run_id: "r1" });
  });

  it("失敗は code 付きの ApiError になる", async () => {
    stub.queue({ status: 409, body: { detail: "反映の前です", code: "CR_NOT_APPLIED" } });

    const error = await getChangeRequestComparison("p1", 1).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("CR_NOT_APPLIED");
  });

  it("説明書は Content-Disposition のファイル名と md の本文を返す", async () => {
    stub.queue({
      body: "# CR-1",
      headers: { "Content-Disposition": 'attachment; filename="cr-1-explanation.md"' },
    });

    const file = await downloadExplanation("p1", 1);

    expect(stub.requests[0].url).toContain(`${BASE}/1/explanation/download`);
    expect(file.filename).toBe("cr-1-explanation.md");
    expect(file.content).toBe(JSON.stringify("# CR-1"));
  });

  // Phase-88-2：更新
  // it("束の一覧と、束の要件の行を読む", async () => {
  //   stub.queue({ body: [] });
  //   stub.queue({ body: [{ id: "FR-001", kind: "FR", priority: "Must", category: "", text: "ログイン" }] });
  // ↓↓
  it("説明書のプレビューと、要約の作成・直し・確認", async () => {
    for (let i = 0; i < 4; i++) stub.queue({ body: { number: 1 } });

    // Phase-88-2：更新
    // await listBaselines("p1");
    // const rows = await listBaselineRequirements("p1", 2);
    // ↓↓
    await getExplanation("p1", 1);
    await createExplanationSummary("p1", 1);
    await editExplanationSummary("p1", 1, "直した文");
    await confirmExplanationSummary("p1", 1);

    // Phase-88-2：更新
    // expect(stub.requests[0].url).toContain("/api/v1/projects/p1/baselines");
    // expect(stub.requests[1].url).toContain("/api/v1/projects/p1/baselines/2/requirements");
    // expect(rows[0].id).toBe("FR-001");
    // ↓↓
    expect(stub.requests.map((r) => [r.init?.method ?? "GET", r.url.replace(/^.*change-requests/, "")])).toEqual([
      ["GET", "/1/explanation"],
      ["POST", "/1/explanation/summary"],
      ["PATCH", "/1/explanation/summary"],
      ["POST", "/1/explanation/summary/confirm"],
    ]);
    expect(JSON.parse(String(stub.requests[2].init?.body))).toEqual({ text: "直した文" });
  });
});
