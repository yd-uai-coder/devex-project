// 作成：Phase-3-5
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streamChat, StreamChatError } from "../streamChat";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("@/components/auth/auth-store", async () => {
  const actual =
    await vi.importActual<typeof import("@/components/auth/auth-store")>(
      "@/components/auth/auth-store",
    );
  return { ...actual, refreshTokens: vi.fn() };
});

function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status });
}

describe("streamChat", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, status: "idle", error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("data: {delta}のフレームを順にyieldし、[DONE]で終了する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse(['data: {"delta":"こん"}\n\n', 'data: {"delta":"にちは"}\n\n', "data: [DONE]\n\n"]),
      ),
    );

    const deltas: string[] = [];
    for await (const delta of streamChat("p1", "はじめまして")) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(["こん", "にちは"]);
  });

  it("フレームが複数回のreadにまたがって分割されても正しく解釈する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse(['data: {"del', 'ta":"こんにちは"}\n\n', "data: [DONE]\n\n"]),
      ),
    );

    const deltas: string[] = [];
    for await (const delta of streamChat("p1", "はじめまして")) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(["こんにちは"]);
  });

  it("401かつaccessToken有りならrefreshTokensを試み、成功すれば1回だけリトライする", async () => {
    const { refreshTokens } = await import("@/components/auth/auth-store");
    vi.mocked(refreshTokens).mockResolvedValue(true);
    useAuthStore.setState({ accessToken: "old-token" });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(sseResponse(['data: {"delta":"ok"}\n\n', "data: [DONE]\n\n"]));
    vi.stubGlobal("fetch", fetchMock);

    const deltas: string[] = [];
    for await (const delta of streamChat("p1", "hello")) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(["ok"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("401以外のエラーはStreamChatErrorを投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(async () => {
      for await (const _delta of streamChat("p1", "hello")) {
        // 何もしない
      }
    }).rejects.toThrow(StreamChatError);
  });
});
