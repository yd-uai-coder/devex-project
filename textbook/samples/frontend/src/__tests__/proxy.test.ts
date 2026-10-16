// 作成：Phase-63-2
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
// 同梱の文書は unstable_doesProxyMatch と書くが、16.3.6 が公開しているのは旧名だけ。
import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "../proxy";
import { LOGIN_FLAG_COOKIE } from "@/lib/auth-flag";

// SUT = proxy と config.matcher、ドライバ = このテスト(NextRequest を組み立てて渡す)。
// スタブ不要 ── proxy は要求の cookie と URL だけを読み、外部を呼ばないため。
const ORIGIN = "http://localhost:3000";

function request(path: string, loggedIn: boolean): NextRequest {
  const headers = loggedIn ? { cookie: `${LOGIN_FLAG_COOKIE}=1` } : undefined;
  return new NextRequest(`${ORIGIN}${path}`, { headers });
}

describe("proxy の対象(matcher)", () => {
  it.each(["/login", "/register"])("%s で動く", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it.each(["/", "/dashboard", "/projects/3", "/login/extra", "/_next/static/chunk.js"])("%s では動かない", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});

describe("proxy", () => {
  it("印が無ければそのまま通す", () => {
    const res = proxy(request("/login", false));

    expect(getRedirectUrl(res)).toBeNull();
  });

  it.each(["/login", "/register"])("印があれば %s からダッシュボードへ送る", (path) => {
    const res = proxy(request(path, true));

    expect(getRedirectUrl(res)).toBe(`${ORIGIN}/dashboard`);
  });

  it("戻り先が同じオリジンの相対パスなら、その先へ送る", () => {
    const res = proxy(request(`/login?redirect=${encodeURIComponent("/projects/new?mode=detailed")}`, true));

    expect(getRedirectUrl(res)).toBe(`${ORIGIN}/projects/new?mode=detailed`);
  });

  it("戻り先が別のオリジンと読まれるなら、ダッシュボードへ送る", () => {
    const res = proxy(request(`/login?redirect=${encodeURIComponent("//evil.example.com")}`, true));

    expect(getRedirectUrl(res)).toBe(`${ORIGIN}/dashboard`);
  });

  it("印の値が空なら通す(消した直後の cookie)", () => {
    const res = proxy(new NextRequest(`${ORIGIN}/login`, { headers: { cookie: `${LOGIN_FLAG_COOKIE}=` } }));

    expect(getRedirectUrl(res)).toBeNull();
  });
});
