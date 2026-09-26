// 作成：Phase-3-1
import { vi } from "vitest";

type StubbedResponse = {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
};

type CapturedRequest = { url: string; init?: RequestInit };

// global.fetchを差し替え、キューに積んだレスポンスを呼び出し順に返す最小限のスタブ。
// MSWは導入せず、apiFetchという単一のfetch呼び出し口をそのまま差し替えるこの方式で足りる
// (devex-ui/CLAUDE.md: React Query/SWR不採用と同じくYAGNIの判断)。
// 実際に送られたリクエスト(url・init)を記録するので、method/credentials/bodyの検証に使う。
export function stubFetch() {
  const responses: StubbedResponse[] = [];
  const requests: CapturedRequest[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    requests.push({ url, init });
    const next = responses.shift() ?? { status: 200, body: {} };
    return new Response(JSON.stringify(next.body ?? {}), {
      status: next.status ?? 200,
      headers: { "Content-Type": "application/json", ...next.headers },
    });
  });

  vi.stubGlobal("fetch", fetchMock);

  return {
    // 次にfetchが呼ばれたときに返すレスポンスを1件積む(FIFO)。
    queue: (response: StubbedResponse) => responses.push(response),
    requests,
    fetchMock,
    restore: () => vi.unstubAllGlobals(),
  };
}
