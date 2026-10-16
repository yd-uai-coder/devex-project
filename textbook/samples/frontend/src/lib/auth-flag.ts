// 作成：Phase-63-1
// UI のオリジンに置く「ログインの印」の cookie。refresh cookie は API のオリジンにあり、
// アクセストークンはメモリにしかないため、proxy(src/proxy.ts)はこの印でログインの状態を推し量る。
// 値は意味を持たない印で、秘密を入れない。認証の判定には使わない(判定は API)。印が古くても、
// 保護ページの RequireAuth と起動時の復元(失敗で印を消す)が受け止める。
// proxy からも名前を読むため、"use client" を付けない。
export const LOGIN_FLAG_COOKIE = "devex_logged_in";

// refresh トークンの寿命(devex-api の REFRESH_TOKEN_EXPIRE_DAYS)に合わせる。
// login・refresh のたびに付け直すので、使っている間は延びる。
const LOGIN_FLAG_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

function secureAttribute(): string {
  return window.location.protocol === "https:" ? "; Secure" : "";
}

export function setLoginFlag(): void {
  if (typeof document === "undefined") return;
  document.cookie =
    `${LOGIN_FLAG_COOKIE}=1; Path=/; Max-Age=${LOGIN_FLAG_MAX_AGE_SECONDS}; SameSite=Lax` +
    secureAttribute();
}

export function clearLoginFlag(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOGIN_FLAG_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax` + secureAttribute();
}
