// 作成：Phase-3-1｜更新：Phase-63-1
// Phase-63-1:追記 ── @/lib/api/client.apiFetch, @/lib/auth-flag.clearLoginFlag, @/lib/auth-flag.LOGIN_FLAG_COOKIE
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshTokens, useAuthStore } from "../auth-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { apiFetch } from "@/lib/api/client";
import { clearLoginFlag, LOGIN_FLAG_COOKIE } from "@/lib/auth-flag";

// Phase-63-1:追記
function hasFlag(): boolean {
  return document.cookie.split("; ").some((c) => c === `${LOGIN_FLAG_COOKIE}=1`);
}

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
    // Phase-63-1:追記
    clearLoginFlag();
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

  // Phase-63-1:追記
  it("login()でログインの印を付け、logout()で消す", () => {
    stub.queue({ status: 204 });

    useAuthStore.getState().login("header.payload.sig");
    expect(hasFlag()).toBe(true);

    useAuthStore.getState().logout();
    expect(hasFlag()).toBe(false);
  });

  it("refreshTokens()の成功で印を付け、失敗で消す", async () => {
    stub.queue({ status: 200, body: { access_token: "new-token", token_type: "bearer" } });
    await refreshTokens();
    expect(hasFlag()).toBe(true);

    stub.queue({ status: 401, body: { detail: "Could not validate credentials" } });
    await refreshTokens();
    expect(hasFlag()).toBe(false);
  });

  it("apiFetchの401でrefreshも失敗したら印を消す(セッション切れ)", async () => {
    useAuthStore.getState().login("header.payload.sig");
    stub.queue({ status: 401, body: { detail: "expired" } });
    stub.queue({ status: 401, body: { detail: "Could not validate credentials" } });

    await expect(apiFetch("/api/v1/projects")).rejects.toMatchObject({ status: 401 });

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(hasFlag()).toBe(false);
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
