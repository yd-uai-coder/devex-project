// 作成：Phase-3-5｜更新：Phase-6-6,15-6,35-3,35(完了後の調整)
// Phase-35-3:追記 ── CardAnswer, HearingCard(@/features/hearing/api/hearingApi)
import { refreshTokens, useAuthStore } from "@/components/auth/auth-store";

// Phase-6-6：更新(NEXT_PUBLIC_API_URLの末尾スラッシュで`//api/...`となりCookieのpathに一致せず、
// F5でログインが切れる不具合があったため、末尾スラッシュを除去する共通定数base-url.tsへ集約した)
// const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
// ↓↓
import { API_BASE_URL } from "@/lib/api/base-url";
import type { CardAnswer, HearingCard } from "@/features/hearing/api/hearingApi";

// Phase-15-6：更新(気づき#2: SSEの失敗イベントのcodeを持たせる)
// export class StreamChatError extends Error {}
// ↓↓
export class StreamChatError extends Error {
  // バックエンドの共通エラー形式の code(例: "LLM_QUOTA_EXCEEDED")。HTTPの失敗では持たない。
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "StreamChatError";
    this.code = code;
  }
}

// Phase-15-6：更新
// // POST /api/v1/projects/{id}/chat のSSEレスポンスを解釈する。バックエンドの形式は
// // `data: {"delta": "..."}\n\n` を`data: [DONE]\n\n`まで繰り返すだけの単純なものであり、
// // event:/id:/retry:等の他のSSEフィールドは使わないため、@microsoft/fetch-event-source等の
// // 汎用ライブラリは導入せず、fetch+ReadableStreamで直接パースする(#17: 依存追加より
// ↓↓
// Phase-35-3:追記
// ストリームから届くもの: 返信の本文(delta)と、本文の後の選択肢カード(cards)
export type ChatStreamEvent =
  | { kind: "delta"; delta: string }
  | { kind: "cards"; cards: HearingCard[] };

// POST /api/v1/projects/{id}/chat のSSEレスポンスを解釈する。バックエンドの形式は
// Phase-35-3：更新
// // `data: {"delta": "..."}\n\n` を`data: [DONE]\n\n`まで繰り返すだけの単純なもので、
// ↓↓
// `data: {"delta": "..."}\n\n`(本文)と`event: cards\ndata: {"cards": [...]}\n\n`(選択肢カード)を
// `data: [DONE]\n\n`まで送るだけの単純なもので、
// 途中で失敗したときだけ`event: error\ndata: {"code": "...", "detail": "..."}\n\n`を送って終わる
// Phase-35-3：更新
// // (200を返した後なのでステータスコードでは伝えられないため)。id:/retry:等は使わないため、
// ↓↓
// (200を返した後なのでステータスコードでは伝えられないため)。本文は構造化出力の1回で作るので、
// 今は1回の delta で全文が届く(形は断片の連続のまま受ける)。id:/retry:等は使わないため、
// @microsoft/fetch-event-source等の汎用ライブラリは導入せず、fetch+ReadableStreamで直接パースする(#17: 依存追加より
// 十数行の自前実装のほうが妥当と判断)。apiFetchの401リトライ機構はbodyのストリームを
// 一度しか読めないため使えず、このヘルパー自身で1回だけリフレッシュ→リトライする。
// Phase-35-3:追記
// cardAnswers は最新の AI の発言の選択肢カードへの回答(サーバーが選んだ内容を発言の本文に足す)。
// continueOptional は、必須がそろった後も任意の観点のヒアリングを続けるときに立てる。
export async function* streamChat(
  projectId: string,
  message: string,
  // Phase-35-3：更新
  // options?: { signal?: AbortSignal },
  // ): AsyncGenerator<string, void, void> {
  // let res = await sendRequest(projectId, message, options?.signal);
  // ↓↓
  // Phase-35(完了後の調整)：更新(continueOptional)
  // options?: { signal?: AbortSignal; cardAnswers?: CardAnswer[] },
  // ↓↓
  options?: { signal?: AbortSignal; cardAnswers?: CardAnswer[]; continueOptional?: boolean },
): AsyncGenerator<ChatStreamEvent, void, void> {
  // Phase-35(完了後の調整)：更新
  // const body = { message, card_answers: options?.cardAnswers ?? [] };
  // ↓↓
  const body = {
    message,
    card_answers: options?.cardAnswers ?? [],
    continue_optional: options?.continueOptional ?? false,
  };
  let res = await sendRequest(projectId, body, options?.signal);

  if (!res.ok && res.status === 401 && useAuthStore.getState().accessToken) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      // Phase-35-3：更新
      // res = await sendRequest(projectId, message, options?.signal);
      // ↓↓
      res = await sendRequest(projectId, body, options?.signal);
    }
  }

  if (!res.ok) {
    throw new StreamChatError(`チャットの送信に失敗しました(status: ${res.status})`);
  }
  if (!res.body) {
    throw new StreamChatError("ストリーミングレスポンスを読み取れませんでした");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) return;

    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      // Phase-15-6：更新
      // const delta = parseEvent(rawEvent);
      // if (delta === DONE_MARKER) return;
      // if (delta !== null) yield delta;
      // ↓↓
      const event = parseEvent(rawEvent);
      if (event.kind === "done") return;
      if (event.kind === "error") throw new StreamChatError(event.detail, event.code);
      // Phase-35-3：更新
      // if (event.kind === "delta") yield event.delta;
      // ↓↓
      if (event.kind === "delta") yield { kind: "delta", delta: event.delta };
      if (event.kind === "cards") yield { kind: "cards", cards: event.cards };
      boundary = buffer.indexOf("\n\n");
    }
  }
}

// Phase-35-3：更新
// function sendRequest(projectId: string, message: string, signal?: AbortSignal): Promise<Response> {
// ↓↓
function sendRequest(
  projectId: string,
  // Phase-35(完了後の調整)：更新
  // body: { message: string; card_answers: CardAnswer[] },
  // ↓↓
  body: { message: string; card_answers: CardAnswer[]; continue_optional: boolean },
  signal?: AbortSignal,
): Promise<Response> {
  const accessToken = useAuthStore.getState().accessToken;
  return fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/chat`, {
    method: "POST",
    credentials: "include",
    signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    // Phase-35-3：更新
    // body: JSON.stringify({ message }),
    // ↓↓
    body: JSON.stringify(body),
  });
}

// Phase-15-6：更新(error イベントを解釈し、種類つきの結果を返す)
// const DONE_MARKER = "__DONE__";
//
// function parseEvent(rawEvent: string): string | null {
//   const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data:"));
//   if (!dataLine) return null;
//   const payload = dataLine.slice("data:".length).trim();
//   if (payload === "[DONE]") return DONE_MARKER;
//   try {
//     const parsed = JSON.parse(payload) as { delta?: string };
//     return parsed.delta ?? null;
//   } catch {
//     return null;
//   }
// }
// ↓↓
type SseEvent =
  | { kind: "delta"; delta: string }
  // Phase-35-3:追記
  | { kind: "cards"; cards: HearingCard[] }
  | { kind: "done" }
  | { kind: "error"; code?: string; detail: string }
  | { kind: "ignored" };

const STREAM_ERROR_FALLBACK = "応答の生成中にエラーが発生しました。もう一度送信してください。";

export function parseEvent(rawEvent: string): SseEvent {
  const lines = rawEvent.split("\n");
  const eventName = lines.find((line) => line.startsWith("event:"))?.slice("event:".length).trim();
  const dataLine = lines.find((line) => line.startsWith("data:"));
  const payload = dataLine?.slice("data:".length).trim() ?? "";

  if (eventName === "error") {
    try {
      const parsed = JSON.parse(payload) as { code?: string; detail?: string };
      return { kind: "error", code: parsed.code, detail: parsed.detail || STREAM_ERROR_FALLBACK };
    } catch {
      return { kind: "error", detail: STREAM_ERROR_FALLBACK };
    }
  }
  // Phase-35-3:追記
  if (eventName === "cards") {
    try {
      const parsed = JSON.parse(payload) as { cards?: HearingCard[] };
      return Array.isArray(parsed.cards) ? { kind: "cards", cards: parsed.cards } : { kind: "ignored" };
    } catch {
      return { kind: "ignored" };
    }
  }
  if (!dataLine) return { kind: "ignored" };
  if (payload === "[DONE]") return { kind: "done" };
  try {
    const parsed = JSON.parse(payload) as { delta?: string };
    return parsed.delta ? { kind: "delta", delta: parsed.delta } : { kind: "ignored" };
  } catch {
    return { kind: "ignored" };
  }
}
