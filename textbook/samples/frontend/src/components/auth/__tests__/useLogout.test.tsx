// 作成：Phase-62-1｜更新：Phase-63-1
// Phase-63-1:追記 ── @/lib/auth-flag.LOGIN_FLAG_COOKIE, @/lib/auth-flag.setLoginFlag
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAuthStore } from "../auth-store";
import { useLogout } from "../useLogout";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { LOGIN_FLAG_COOKIE, setLoginFlag } from "@/lib/auth-flag";

// Phase-63-1:追記
function hasFlag(): boolean {
  return document.cookie.split("; ").some((c) => c === `${LOGIN_FLAG_COOKIE}=1`);
}

describe("useLogout", () => {
  let stub: ReturnType<typeof stubFetch>;
  const assign = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    assign.mockClear();
    stub = stubFetch();
    // jsdom は画面の遷移(location.assign)を実装していないため差し替える
    Object.defineProperty(window, "location", { configurable: true, value: { assign } });
    useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });
    // Phase-63-1:追記
    setLoginFlag();
  });

  afterEach(() => {
    stub.restore();
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("API の logout を呼んでから、トップページを読み込み直す(ストアは先に消さない)", async () => {
    stub.queue({ status: 204 });
    const { result } = renderHook(() => useLogout());

    await result.current();

    expect(stub.requests).toHaveLength(1);
    expect(stub.requests[0].url).toContain("/api/v1/auth/logout");
    expect(stub.requests[0].init?.method).toBe("POST");
    expect(assign).toHaveBeenCalledWith("/");
    // 消すと保護ページがログイン必須ダイアログを一瞬出すため、読み込み直しに任せる
    expect(useAuthStore.getState().accessToken).toBe("header.payload.sig");
    // Phase-63-1:追記
    // ログインの印は消す(読み込み直した後の認証ページを proxy が飛ばさないように)
    expect(hasFlag()).toBe(false);
  });

  it("API が失敗しても読み込み直す(ベストエフォート)", async () => {
    stub.queue({ status: 500, body: { detail: "error" } });
    const { result } = renderHook(() => useLogout());

    await result.current();

    expect(assign).toHaveBeenCalledWith("/");
    // Phase-63-1:追記
    // 失効に失敗しても消す(refresh cookie が残っていれば、起動時の復元で付き直す)
    expect(hasFlag()).toBe(false);
  });
});
