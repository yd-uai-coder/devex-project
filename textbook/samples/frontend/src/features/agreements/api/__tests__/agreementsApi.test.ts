// 作成：Phase-97-2
// SUT: agreementsApi(行の合意の API の薄い包み)
// ドライバ: vitest のテスト関数
// スタブ: fetch(stubFetch)── 送った URL(クエリの符号化)と、応答の受け渡しを確かめるため
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAgreementHistory, getAgreementStatus } from "../agreementsApi";
import { makeHistory, makeStatus } from "../../test-utils/agreementFixtures";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

describe("agreementsApi", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("状態は文書の種類をクエリで渡す", async () => {
    stub.queue({ body: makeStatus({ doc_type: "external_design" }) });

    const status = await getAgreementStatus("p1", "external_design");

    expect(stub.requests[0].url).toContain("/api/v1/projects/p1/agreements/status?doc_type=external_design");
    expect(status.doc_type).toBe("external_design");
  });

  it("履歴はキーを符号化してクエリで渡す(空白・/・{} を含む)", async () => {
    stub.queue({ body: makeHistory({ key: "api:GET /api/v1/x/{}" }) });

    const history = await getAgreementHistory("p1", "api:GET /api/v1/x/{}");

    expect(stub.requests[0].url).toContain(
      "/api/v1/projects/p1/agreements/history?key=api%3AGET%20%2Fapi%2Fv1%2Fx%2F%7B%7D",
    );
    expect(history.key).toBe("api:GET /api/v1/x/{}");
  });
});
