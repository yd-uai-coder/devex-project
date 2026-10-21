// 作成：Phase-98-1
// SUT: confirmationsApi(確認事項の一覧の API の薄い包み)
// ドライバ: vitest のテスト関数
// スタブ: fetch(stubFetch)── 送った URL(キーの符号化)・メソッド・本文と、応答の受け渡しを確かめるため
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listConfirmations, updateConfirmation } from "../confirmationsApi";
import { makeList } from "../../test-utils/confirmationFixtures";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

describe("confirmationsApi", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("一覧を読む", async () => {
    stub.queue({ body: makeList() });

    const list = await listConfirmations("p1");

    expect(stub.requests[0].url).toContain("/api/v1/projects/p1/confirmations");
    expect(list.items).toHaveLength(4);
  });

  it("更新はキーを符号化して PATCH し、渡した欄だけ送る", async () => {
    stub.queue({ body: makeList() });

    await updateConfirmation("p1", "user:管理者 A", { opportunity: null });

    expect(stub.requests[0].url).toContain(
      `/api/v1/projects/p1/confirmations/${encodeURIComponent("user:管理者 A")}`,
    );
    expect(stub.requests[0].url).toContain("user%3A");
    expect(stub.requests[0].init?.method).toBe("PATCH");
    expect(JSON.parse(String(stub.requests[0].init?.body))).toEqual({ opportunity: null });
  });
});
