// 更新：Phase-108-1
"use client";

// Phase-108-1:追記 ── next/navigation.usePathname, ./client-page.isClientPage
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { YStack } from "tamagui";
import { Header} from "./Header";
import { Menu } from "./Menu";
import { Footer } from "./Footer";
import { HEADER_HEIGHT, FOOTER_HEIGHT } from "./layout-constants";
import { isClientPage } from "./client-page";

// Phase-108-1:追記
// クライアント向けのページ(共有リンク)では、開発者向けのメニュー・フッターを出さず、題もリンクにしない
export function AppShell({ children }: { children: ReactNode }) {
  // Phase-108-1:追記
  const plain = isClientPage(usePathname());
  return (
    <YStack minHeight="100vh">
      {/* Phase-108-1：更新 */}
      {/* <Header /> */}
      {/* <Menu /> */}
      {/* ↓↓ */}
      <Header plain={plain} />
      {plain ? null : <Menu />}
      <YStack
        paddingTop={HEADER_HEIGHT + 16}
        // Phase-108-1：更新
        // paddingBottom={FOOTER_HEIGHT + 16}
        // ↓↓
        paddingBottom={(plain ? 0 : FOOTER_HEIGHT) + 16}
        paddingHorizontal="$6"
      >
        {children}
      </YStack>
      {/* Phase-108-1：更新 */}
      {/* <Footer /> */}
      {/* ↓↓ */}
      {plain ? null : <Footer />}
    </YStack>
  );
}
