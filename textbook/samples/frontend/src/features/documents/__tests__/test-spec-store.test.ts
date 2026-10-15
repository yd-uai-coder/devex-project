// 作成：Phase-57-2
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTestSpecStore } from "../test-spec-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { makeTestSpec } from "../test-utils/testSpecFixtures";

// SUT: useTestSpecStore / ドライバ: このテスト / スタブ: fetch(サーバーの代わり)。

describe("useTestSpecStore", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    useTestSpecStore.setState({
      projectId: null,
      testSpec: null,
      status: "idle",
      error: null,
      generating: false,
      generateError: null,
    });
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("テスト仕様書を取り、別のプロジェクトに移ったら前のものを捨てる", async () => {
    stub.queue({ status: 200, body: makeTestSpec() });
    await useTestSpecStore.getState().fetchTestSpec("p1");
    expect(useTestSpecStore.getState().testSpec?.counts.integration).toBe(12);

    stub.queue({ status: 404, body: { detail: "test_spec not found" } });
    await useTestSpecStore.getState().fetchTestSpec("p2");
    expect(useTestSpecStore.getState()).toMatchObject({ projectId: "p2", testSpec: null, status: "success" });
  });

  it("生成はテスト仕様書を起点に受け付け、完了したら取り直す", async () => {
    stub.queue({ status: 202, body: {} });
    await useTestSpecStore.getState().generate("p1");

    expect(useTestSpecStore.getState().generating).toBe(true);
    expect(stub.requests[0].url).toContain("/api/v1/projects/p1/generate");
    expect(JSON.parse(String(stub.requests[0].init?.body))).toEqual({ start_from: "test_spec" });

    stub.queue({ status: 200, body: makeTestSpec() });
    useTestSpecStore.getState().onGenerated("p1");
    expect(useTestSpecStore.getState().generating).toBe(false);
    await vi.waitFor(() => expect(useTestSpecStore.getState().testSpec).not.toBeNull());
  });

  it("前提の段階が承認されていない(409)ときは、生成中にせず理由を出す。生成中(409)は待つ", async () => {
    stub.queue({
      status: 409,
      body: { detail: "段階1と段階7を承認してから作れます。", code: "TEST_SPEC_UPSTREAM_NOT_READY" },
    });
    await useTestSpecStore.getState().generate("p1");
    expect(useTestSpecStore.getState()).toMatchObject({
      generating: false,
      generateError: "段階1と段階7を承認してから作れます。",
    });

    stub.queue({ status: 409, body: { detail: "生成中", code: "DOC_GENERATION_IN_PROGRESS" } });
    await useTestSpecStore.getState().generate("p1");
    expect(useTestSpecStore.getState()).toMatchObject({ generating: true, generateError: null });
  });
});

