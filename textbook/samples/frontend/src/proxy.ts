// 作成：Phase-63-2
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOGIN_FLAG_COOKIE } from "@/lib/auth-flag";
import { safeRedirectPath } from "@/lib/redirect-path";

const DEFAULT_AFTER_LOGIN = "/dashboard";

// ログイン済み(ログインの印の cookie がある)で認証ページを開いたら、画面を出さずに
// ダッシュボード(?redirect= があればその先)へ送る。印は推し量るだけの楽観的な確認で、
// 古い印のときは送り先の RequireAuth がログイン必須ダイアログを出す。
export function proxy(request: NextRequest) {
  if (!request.cookies.get(LOGIN_FLAG_COOKIE)?.value) return NextResponse.next();

  const target = safeRedirectPath(request.nextUrl.searchParams.get("redirect")) ?? DEFAULT_AFTER_LOGIN;
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  matcher: ["/login", "/register"],
};
