// 更新：Phase-3-1,3-4
import { refreshTokens, useAuthStore } from "@/components/auth/auth-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
// Phase-3-1：更新(リフレッシュエンドポイントの仕様がhttpOnly Cookie方式で確定したため、
// 「実際のエンドポイントに合わせて変更する」という保留コメントを削除)
// サイレントリフレッシュの無限ループを避けるため、リフレッシュ自身のリクエストは
// 401でも再リフレッシュ対象から除外する。実際のバックエンドのリフレッシュエンドポイントに合わせて変更する。
// ↓↓
// サイレントリフレッシュの無限ループを避けるため、リフレッシュ自身のリクエストは
// 401でも再リフレッシュ対象から除外する。
const REFRESH_PATH = "/api/v1/auth/refresh";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// FastAPI/Pydanticのエラーレスポンス({detail: string} または 422時の
// {detail: [{msg: string, ...}, ...]})からメッセージを取り出す。
async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      return body.detail.map((issue: { msg?: string }) => issue.msg).filter(Boolean).join(", ");
    }
  } catch {
    // レスポンスがJSONでない場合はstatusTextにフォールバックする
  }
  return res.statusText || `リクエストに失敗しました(status: ${res.status})`;
}

// バックエンド(FastAPI想定)への薄いfetchラッパー。認証トークンの付与・401時の
// サイレントリフレッシュ+1回だけの透過的リトライ・エラーレスポンスのパースをまとめて担う。
export async function apiFetch<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;

  // Phase-3-1：更新(リフレッシュトークンをhttpOnly Cookieでやり取りするため、
  // 全リクエストでCookie送信を有効にする)
  // const res = await fetch(`${API_BASE_URL}${path}`, {
  //   ...init,
  //   headers: {
  // ↓↓
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    // リフレッシュトークンはhttpOnly Cookieでやり取りするため、全リクエストでCookie送信を
    // 有効にする(devex-ui:3000→devex-api:8000のクロスオリジンでも送るために必要)。実際に
    // refresh_token Cookieが送信されるかはCookie自身のpath=/api/v1/auth属性で決まるため、
    // 他のエンドポイントへは送られない。
    credentials: "include",
    // Phase-3-4：更新(multipart/form-data送信時にContent-Typeを固定してしまうと
    // 境界(boundary)が欠落しバックエンドがパースできなくなるため、FormData送信時は
    // ブラウザに自動設定させる)
    // headers: {
    //   Accept: "application/json",
    //   ...(init?.body ? { "Content-Type": "application/json" } : {}),
    //   ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    //   ...init?.headers,
    // },
    // ↓↓
    headers: {
      Accept: "application/json",
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    // accessTokenを送った上での401は「セッション切れ・トークン無効」を意味する
    // (トークンを送っていない401は未ログイン状態そのものなので対象外)。
    // まだリトライしていなければ、まずリフレッシュトークンでの再発行を試み、
    // 成功したら新しいアクセストークンで1回だけリクエストをやり直す(サイレントリフレッシュ)。
    if (res.status === 401 && accessToken && !isRetry && path !== REFRESH_PATH) {
      const refreshed = await refreshTokens();
      if (refreshed) {
        return apiFetch<T>(path, init, true);
      }
      // リフレッシュに失敗した場合はrefreshTokens()内で既にログアウト済み
      throw new ApiError(res.status, await extractErrorMessage(res));
    }

    // リフレッシュを試みなかった/リトライ後も失敗した401は、ログアウト状態に落とす。
    // RequireAuthはaccessTokenの変化に反応して自動的に未認証ガードを表示する。
    if (res.status === 401 && accessToken) {
      useAuthStore.getState().logout();
    }
    throw new ApiError(res.status, await extractErrorMessage(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
