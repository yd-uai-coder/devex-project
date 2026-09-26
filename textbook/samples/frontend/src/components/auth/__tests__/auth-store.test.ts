// 作成：Phase-3-1
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshTokens, useAuthStore } from "../auth-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

function resetStore() {
  useAuthStore.setState({ accessToken: null, status: "idle", error: null });
}

describe("useAuthStore", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    resetStore();
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
  });

  it("login()はaccessTokenを保存しstatusをsuccessにする", () => {
    useAuthStore.getState().login("header.payload.sig");

    expect(useAuthStore.getState().accessToken).toBe("header.payload.sig");
    expect(useAuthStore.getState().status).toBe("success");
  });

  it("logout()はaccessTokenを破棄し、ベストエフォートで/api/v1/auth/logoutを呼ぶ", async () => {
    useAuthStore.getState().login("header.payload.sig");
    stub.queue({ status: 204 });

    useAuthStore.getState().logout();

    // ネットワーク呼び出しの完了を待たず、状態は同期的にログアウト済みになる
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().status).toBe("idle");

    await vi.waitFor(() => expect(stub.requests).toHaveLength(1));
    expect(stub.requests[0].url).toContain("/api/v1/auth/logout");
    expect(stub.requests[0].init?.credentials).toBe("include");
  });

  it("refreshTokens()は成功時にCookie経由でaccessTokenを更新する", async () => {
    stub.queue({ status: 200, body: { access_token: "new-token", token_type: "bearer" } });

    const ok = await refreshTokens();

    expect(ok).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe("new-token");
    expect(stub.requests[0].url).toContain("/api/v1/auth/refresh");
    expect(stub.requests[0].init?.credentials).toBe("include");
    // リフレッシュトークンをボディに含めない(Cookieのみでやり取りする)ことを確認する
    expect(stub.requests[0].init?.body).toBeUndefined();
  });

  it("refreshTokens()はCookie無し等の失敗時に静かにログアウト状態へ倒す", async () => {
    stub.queue({ status: 401, body: { detail: "Could not validate credentials" } });

    const ok = await refreshTokens();

    expect(ok).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().status).toBe("idle");
  });

  it("同時に複数回呼んでも実際のリフレッシュリクエストは1回にまとまる", async () => {
    stub.queue({ status: 200, body: { access_token: "new-token", token_type: "bearer" } });

    const [first, second] = await Promise.all([refreshTokens(), refreshTokens()]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(stub.requests).toHaveLength(1);
  });
});
