// 作成：Phase-66-3
// SUT: accountApi(getAccount・updateUserName・changeEmail・changePassword)
// ドライバ: 各テスト
// スタブ: fetch(stubFetch。送ったメソッド・パス・本文を見る)
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { changeEmail, changePassword, getAccount, updateUserName } from "../accountApi";

describe("accountApi", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("各操作を対応するメソッド・パス・本文で送る", async () => {
    await getAccount();
    await updateUserName("ギル");
    await changeEmail("new@example.com", "Old-pass-01");
    await changePassword("Old-pass-01", "New-pass-02");

    const sent = stub.requests.map((r) => [r.init?.method ?? "GET", new URL(r.url).pathname, r.init?.body]);
    expect(sent).toEqual([
      ["GET", "/api/v1/users/me", undefined],
      ["PATCH", "/api/v1/users/me", JSON.stringify({ user_name: "ギル" })],
      ["PUT", "/api/v1/users/me/email", JSON.stringify({ new_email: "new@example.com", current_password: "Old-pass-01" })],
      ["PUT", "/api/v1/users/me/password", JSON.stringify({ current_password: "Old-pass-01", new_password: "New-pass-02" })],
    ]);
  });
});
