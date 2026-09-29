// 作成：Phase-6-6
// 写経レベル: コア ── 「末尾スラッシュ付きのAPI URLでもCookieのpathに一致させる」という、
// F5でログインが切れた不具合の再発防止を体現する定数。
// NEXT_PUBLIC_API_URLの末尾スラッシュを除去する。付いたままだと`${API_BASE_URL}${path}`が
// `https://host//api/...`になり、Cookieのpath=/api/v1/authにマッチせず、
// リフレッシュトークンが送られない(F5でログイン状態が切れる)。
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
  /\/+$/,
  "",
);
