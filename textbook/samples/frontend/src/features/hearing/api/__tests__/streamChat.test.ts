// 作成：Phase-3-5｜更新：Phase-15-6,35-3,35(完了後の調整)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Phase-15-6:追記 ── parseEvent
import { parseEvent, streamChat, StreamChatError } from "../streamChat";
// Phase-35-3:追記
import type { ChatStreamEvent } from "../streamChat";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("@/components/auth/auth-store", async () => {
  const actual =
    await vi.importActual<typeof import("@/components/auth/auth-store")>(
      "@/components/auth/auth-store",
    );
  return { ...actual, refreshTokens: vi.fn() };
});

// Phase-35-3:追記
function deltaOf(event: ChatStreamEvent): string {
  return event.kind === "delta" ? event.delta : "";
}

const CARD = {
  id: "c1",
  point_key: "scale",
  label: "規模",
  question: "使うのは誰ですか",
  options: [
    { label: "自分だけ", result: "少ない" },
    { label: "社内", result: "多い" },
  ],
  recommended: 0,
  reason: "小さく始める",
  selected: null,
};

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
    // Phase-35-3：更新
    // for await (const delta of streamChat("p1", "はじめまして")) {
    //   deltas.push(delta);
    // ↓↓
    for await (const event of streamChat("p1", "はじめまして")) {
      deltas.push(deltaOf(event));
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
    // Phase-35-3：更新
    // for await (const delta of streamChat("p1", "はじめまして")) {
    //   deltas.push(delta);
    // ↓↓
    for await (const event of streamChat("p1", "はじめまして")) {
      deltas.push(deltaOf(event));
    }

    expect(deltas).toEqual(["こんにちは"]);
  // Phase-35-3:追記
  });

  it("本文の後のevent: cardsを、カードのイベントとしてyieldする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"delta":"教えてください"}\n\n',
          `event: cards\ndata: ${JSON.stringify({ cards: [CARD] })}\n\n`,
          "data: [DONE]\n\n",
        ]),
      ),
    );

    const events: ChatStreamEvent[] = [];
    for await (const event of streamChat("p1", "はじめまして")) events.push(event);

    expect(events).toEqual([
      { kind: "delta", delta: "教えてください" },
      { kind: "cards", cards: [CARD] },
    ]);
  });

  it("カードへの回答をcard_answersとして本文に入れて送る(無ければ空の配列)", async () => {
    // Response の本体は1回しか読めないので、呼び出しごとに作る
    const fetchMock = vi.fn().mockImplementation(async () => sseResponse(["data: [DONE]\n\n"]));
    vi.stubGlobal("fetch", fetchMock);

    await Array.fromAsync(streamChat("p1", "", { cardAnswers: [{ card_id: "c1", option: 1 }] }));
    await Array.fromAsync(streamChat("p1", "文だけ"));

    // Phase-35(完了後の調整)：更新(continue_optional も送る)
    // expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    //   message: "",
    //   card_answers: [{ card_id: "c1", option: 1 }],
    // });
    // expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ message: "文だけ", card_answers: [] });
    // ↓↓
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      message: "",
      card_answers: [{ card_id: "c1", option: 1 }],
      continue_optional: false,
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      message: "文だけ",
      card_answers: [],
      continue_optional: false,
    });
  });

  // Phase-35(完了後の調整):追記
  it("任意の観点を続けるときは continue_optional を立てて送る", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => sseResponse(["data: [DONE]\n\n"]));
    vi.stubGlobal("fetch", fetchMock);

    await Array.fromAsync(streamChat("p1", "続けて", { continueOptional: true }));

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ continue_optional: true });
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
    // Phase-35-3：更新
    // for await (const delta of streamChat("p1", "hello")) {
    //   deltas.push(delta);
    // ↓↓
    for await (const event of streamChat("p1", "hello")) {
      deltas.push(deltaOf(event));
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
  // Phase-15-6:追記
  it("event: error を受け取ったら、code と detail を持つ StreamChatError を投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"delta":"途中まで"}\n\n',
          'event: error\ndata: {"code":"LLM_QUOTA_EXCEEDED","detail":"本日の利用上限に達しました。"}\n\n',
        ]),
      ),
    );

    const deltas: string[] = [];
    const error = await (async () => {
      try {
        // Phase-35-3：更新
        // for await (const delta of streamChat("p1", "hello")) deltas.push(delta);
        // ↓↓
        for await (const event of streamChat("p1", "hello")) deltas.push(deltaOf(event));
      } catch (err) {
        return err;
      }
    })();

    expect(deltas).toEqual(["途中まで"]);
    expect(error).toBeInstanceOf(StreamChatError);
    expect((error as StreamChatError).code).toBe("LLM_QUOTA_EXCEEDED");
    expect((error as StreamChatError).message).toBe("本日の利用上限に達しました。");
  });
});

// Phase-15-6:追記
describe("parseEvent", () => {
  it("data の無いイベントや delta の無い JSON は無視する", () => {
    expect(parseEvent(": keep-alive")).toEqual({ kind: "ignored" });
    expect(parseEvent('data: {"other":1}')).toEqual({ kind: "ignored" });
  });

  it("壊れた error イベントは既定の文言にする", () => {
    expect(parseEvent("event: error\ndata: not-json")).toMatchObject({ kind: "error" });
  });

  // Phase-35-3:追記
  it("cards イベントはカードの配列を取り出し、壊れていれば無視する", () => {
    expect(parseEvent(`event: cards\ndata: ${JSON.stringify({ cards: [CARD] })}`)).toEqual({
      kind: "cards",
      cards: [CARD],
    });
    expect(parseEvent("event: cards\ndata: not-json")).toEqual({ kind: "ignored" });
    expect(parseEvent('event: cards\ndata: {"cards":1}')).toEqual({ kind: "ignored" });
  });
});
