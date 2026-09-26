// 更新：Phase-3-1
"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/components/auth/auth-store";
import { useHasMounted } from "@/hooks/useHasMounted";
import { LoginRequiredDialog } from "@/components/auth/LoginRequiredDialog";

// 未ログイン時にログイン必須ダイアログを表示し、保護対象のchildrenを隠す。
// ページ全体やレイアウト単位で <RequireAuth>...</RequireAuth> のように使う。
export function RequireAuth({ children }: { children: ReactNode }) {
  const mounted = useHasMounted();
  const accessToken = useAuthStore((s) => s.accessToken);
  // Phase-3-1:追記 ── AuthBootstrapによるセッション復元中はダイアログの表示を保留するため
  const status = useAuthStore((s) => s.status);
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  // Phase-3-1：更新(復元完了前のちらつき防止のため、status==="loading"の間も非表示にする)
  // // マウント前はハイドレーション不一致を避けるため非表示
  // if (!mounted) return null;
  // ↓↓
  // マウント前はハイドレーション不一致を避けるため非表示。加えて、AuthBootstrapによる
  // セッション復元(httpOnly Cookieからのサイレントリフレッシュ)が完了するまでは
  // 「未ログイン」と確定できないため、ログイン必須ダイアログの表示を保留する
  // (保留しないと、ログイン済みでも復元が終わるまでの一瞬ダイアログが出てすぐ消える)。
  if (!mounted || status === "loading") return null;

  // 未ログイン時はログイン必須ダイアログを表示
  if (!accessToken) {
    return (
      <LoginRequiredDialog
        open={open}
        onClose={() => setOpen(false)}
        redirectTo={pathname}
        closeBehavior="redirectHome"
      />
    );
  }

  return <>{children}</>;
}
