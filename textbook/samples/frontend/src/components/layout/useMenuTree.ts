// 作成：Phase-62-2
"use client";

import { useAuthStore } from "@/components/auth/auth-store";
import { useHasMounted } from "@/hooks/useHasMounted";
import { MENU_TREE, visibleMenuTree, type MenuAuth, type MenuGroup } from "@/lib/menu-tree";

// 今のログインの状態に合わせたメニューの木。マウント前と、セッションの復元中(status が
// loading)は状態が決まらないため、認証の項目を出さない(SSR とハイドレーションの一致も保つ)。
export function useMenuTree(): MenuGroup[] {
  const mounted = useHasMounted();
  const accessToken = useAuthStore((s) => s.accessToken);
  const status = useAuthStore((s) => s.status);

  let auth: MenuAuth | null = null;
  if (mounted && status !== "loading") auth = accessToken ? "user" : "guest";
  return visibleMenuTree(MENU_TREE, auth);
}
