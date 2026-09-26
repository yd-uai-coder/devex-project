// 作成：Phase-3-1
"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/components/auth/auth-store";

// アプリ起動時に一度だけ呼ばれ、httpOnly Cookieに残っているリフレッシュトークンから
// ログインセッションの復元を試みる(画面には何も描画しない)。src/app/layout.tsxの
// <Providers>内に一度だけマウントする。
export function AuthBootstrap() {
  useEffect(() => {
    void useAuthStore.getState().bootstrap();
  }, []);

  return null;
}
