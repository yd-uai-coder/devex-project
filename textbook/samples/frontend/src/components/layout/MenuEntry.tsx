// 作成：Phase-62-2
"use client";

import Link from "next/link";
import { Text, type FontSizeTokens } from "tamagui";
import { useLogout } from "@/components/auth/useLogout";
import type { MenuItem } from "@/lib/menu-tree";
import styles from "./Menu.module.css";

// メニューの項目1つ。サイドメニュー・トップページ・404 ページで共有する。
// link は遷移、action は処理(ログアウト)。onSelect は押したときに呼ぶ(メニューを閉じる等)。
export function MenuEntry({
  item,
  fontSize,
  onSelect,
}: {
  item: MenuItem;
  fontSize: FontSizeTokens;
  onSelect?: () => void;
}) {
  const logout = useLogout();

  if (item.kind === "link") {
    return (
      <Text fontSize={fontSize} color="$color11" onPress={onSelect}>
        <Link href={item.href} className={styles.navLink}>
          {item.label}
        </Link>
      </Text>
    );
  }

  // 処理の項目はキーボードでも押せるよう素の button にし、見た目はリンクにそろえる
  return (
    <Text fontSize={fontSize} color="$color11">
      <button
        type="button"
        className={styles.navButton}
        onClick={() => {
          onSelect?.();
          void logout();
        }}
      >
        {item.label}
      </button>
    </Text>
  );
}
