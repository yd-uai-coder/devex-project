// 作成：Phase-11-2
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError, apiFetch } from "../client";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

describe("apiFetch のエラー", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("共通エラー形式の detail と code を ApiError に載せる", async () => {
    stub.queue({ status: 409, body: { detail: "他で更新されました", code: "VERSION_CONFLICT" } });

    const error = await apiFetch("/x").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      message: "他で更新されました",
      code: "VERSION_CONFLICT",
    });
  });

  it("code の無いエラーでは code が undefined になる", async () => {
    stub.queue({ status: 400, body: { detail: "notation は変更できません" } });

    const error = await apiFetch("/x").catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 400, message: "notation は変更できません" });
    expect((error as ApiError).code).toBeUndefined();
  });

  it("422 の detail 配列は msg をつないだメッセージにする", async () => {
    stub.queue({ status: 422, body: { detail: [{ msg: "field required" }, { msg: "bad" }] } });

    const error = await apiFetch("/x").catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 422, message: "field required, bad" });
  });
});
