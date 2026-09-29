// 作成：Phase-6-6
// 写経レベル: コア ── F5でログインが切れた不具合(URLの`//`でCookieが送られない)の回帰テスト。
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";

// API_BASE_URLはモジュール読み込み時に環境変数から決まるため、ケースごとにモジュールを読み直す。
async function loadBaseUrl(envValue: string | undefined) {
  vi.resetModules();
  if (envValue === undefined) {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    vi.stubEnv("NEXT_PUBLIC_API_URL", envValue);
  }
  return (await import("../base-url")).API_BASE_URL;
}

describe("API_BASE_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("末尾スラッシュが無ければそのまま使う", async () => {
    expect(await loadBaseUrl("https://api.example.com")).toBe("https://api.example.com");
  });

  it("末尾スラッシュ(1個・複数)を除去する", async () => {
    expect(await loadBaseUrl("https://api.example.com/")).toBe("https://api.example.com");
    expect(await loadBaseUrl("https://api.example.com///")).toBe("https://api.example.com");
  });

  it("未設定ならhttp://localhost:8000にフォールバックする", async () => {
    expect(await loadBaseUrl(undefined)).toBe("http://localhost:8000");
  });

  // 実際の不具合: 末尾スラッシュ付きだとリクエストURLが`//api/...`になり、Cookieのpath
  // (/api/v1/auth)にマッチせずリフレッシュトークンが送られなかった。
  it("末尾スラッシュ付きの設定でも、apiFetchのリクエストURLに`//`が入らない", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com/");
    const stub = stubFetch();
    const { apiFetch } = await import("../client");

    await apiFetch("/api/v1/auth/refresh", { method: "POST" });

    expect(stub.requests[0].url).toBe("https://api.example.com/api/v1/auth/refresh");
    stub.restore();
  });
});
