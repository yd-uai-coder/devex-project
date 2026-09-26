// 作成：Phase-3-5
import { refreshTokens, useAuthStore } from "@/components/auth/auth-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class StreamChatError extends Error {}

// POST /api/v1/projects/{id}/chat のSSEレスポンスを解釈する。バックエンドの形式は
// `data: {"delta": "..."}\n\n` を`data: [DONE]\n\n`まで繰り返すだけの単純なものであり、
// event:/id:/retry:等の他のSSEフィールドは使わないため、@microsoft/fetch-event-source等の
// 汎用ライブラリは導入せず、fetch+ReadableStreamで直接パースする(#17: 依存追加より
// 十数行の自前実装のほうが妥当と判断)。apiFetchの401リトライ機構はbodyのストリームを
// 一度しか読めないため使えず、このヘルパー自身で1回だけリフレッシュ→リトライする。
export async function* streamChat(
  projectId: string,
  message: string,
  options?: { signal?: AbortSignal },
): AsyncGenerator<string, void, void> {
  let res = await sendRequest(projectId, message, options?.signal);

  if (!res.ok && res.status === 401 && useAuthStore.getState().accessToken) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      res = await sendRequest(projectId, message, options?.signal);
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
      const delta = parseEvent(rawEvent);
      if (delta === DONE_MARKER) return;
      if (delta !== null) yield delta;
      boundary = buffer.indexOf("\n\n");
    }
  }
}

function sendRequest(projectId: string, message: string, signal?: AbortSignal): Promise<Response> {
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
    body: JSON.stringify({ message }),
  });
}

const DONE_MARKER = "__DONE__";

function parseEvent(rawEvent: string): string | null {
  const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) return null;
  const payload = dataLine.slice("data:".length).trim();
  if (payload === "[DONE]") return DONE_MARKER;
  try {
    const parsed = JSON.parse(payload) as { delta?: string };
    return parsed.delta ?? null;
  } catch {
    return null;
  }
}
