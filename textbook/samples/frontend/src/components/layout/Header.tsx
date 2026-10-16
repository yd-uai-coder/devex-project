// 更新：Phase-62-1
"use client";

// Phase-62-1:追記 ── Link(next/link), styles(./Menu.module.css)
import Link from "next/link";
import { H3, XStack } from "tamagui";
import { MenuToggleButton } from "@/components/ui/primitives/MenuToggleButton";
import { ThemeToggleButton } from "@/components/ui/primitives/ThemeToggleButton";
import { HEADER_HEIGHT } from "./layout-constants";
import styles from "./Menu.module.css";

export function Header() {
  return (
    <XStack
      position="fixed"
      top={0}
      left={0}
      right={0}
      height={HEADER_HEIGHT}
      zIndex={300}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      paddingHorizontal="$4"
      paddingVertical="$4"
      borderBottomWidth={1}
      borderColor="$borderColor"
      backgroundImage="$headerFooterGradient"
    >
      <MenuToggleButton />
      <H3
        flexShrink={1}
        minWidth={0}
        fontSize="$7"
        $md={{ fontSize: "$9" }}
      >
        {/* Phase-62-1：更新(タイトルはトップページへのリンク)
        Devex
            ↓↓ */}
        <Link href="/" className={styles.titleLink}>
          Devex
        </Link>
      </H3>
      <ThemeToggleButton />
    </XStack>
  );
}
