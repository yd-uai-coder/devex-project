// 作成：Phase-88-2
// SUT: baselinesApi(合意済みの版の API の薄い包み)
// ドライバ: vitest のテスト関数
// スタブ: fetch(stubFetch)── 送ったメソッド・URL・本文と、応答の受け渡しを確かめるため
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createBaseline,
  getBaseline,
  listBaselineRequirements,
  listBaselines,
} from "../baselinesApi";
import { makeBaseline, makeBaselineSummary } from "../../test-utils/baselineFixtures";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

const BASE = "/api/v1/projects/p1/baselines";

describe("baselinesApi", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("一覧・中身・要件の行を読む", async () => {
    stub.queue({ body: [makeBaselineSummary()] });
    stub.queue({ body: makeBaseline({ number: 2 }) });
    stub.queue({ body: [{ id: "FR-001", kind: "FR", priority: "Must", category: "", text: "ログイン" }] });

    const list = await listBaselines("p1");
    const baseline = await getBaseline("p1", 2);
    const rows = await listBaselineRequirements("p1", 2);

    expect(stub.requests.map((r) => r.url.replace(/^.*\/baselines/, ""))).toEqual(["", "/2", "/2/requirements"]);
    expect(stub.requests[0].url).toContain(BASE);
    expect(list[0].items).toHaveLength(11);
    expect(baseline.number).toBe(2);
    expect(rows[0].id).toBe("FR-001");
  });

  it("作成は合意の記録と入れる CR の番号を送る", async () => {
    stub.queue({ status: 201, body: makeBaseline({ number: 2 }) });
    const body = {
      agreed_at: "2026-10-20T01:00:00.000Z",
      counterpart: null,
      memo: "",
      reason: "CR-1 を反映した版",
      change_request_numbers: [1],
    };

    const created = await createBaseline("p1", body);

    expect(stub.requests[0].init?.method).toBe("POST");
    expect(JSON.parse(String(stub.requests[0].init?.body))).toEqual(body);
    expect(created.number).toBe(2);
  });
});
