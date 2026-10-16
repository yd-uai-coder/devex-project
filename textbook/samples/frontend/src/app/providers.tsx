// 更新：Phase-64-3
"use client";

import { useRef, type ReactNode } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { NextThemeProvider, useRootTheme } from "@tamagui/next-theme";
import { TamaguiProvider } from "tamagui";
// Phase-64-3:追記
import { AppToastProvider } from "@/components/layout/AppToast";
import tamaguiConfig from "../../tamagui.config";

// NextThemeProvider's own theme-detection script (below) is injected via
// next/script strategy="beforeInteractive", which on the App Router doesn't
// actually run as a blocking inline script - it's queued into `self.__next_s`
// and only executed once Next's client runtime chunks have loaded, well
// after the page's HTML (including this app's colors) has already painted
// once in the light-mode default. That's what caused the brief flash of
// light mode on every reload even after Header stopped depending on React
// state for its colors (see theme-gradients.ts). useServerInsertedHTML
// (the mechanism Next's own CSS-in-JS guide uses for styled-jsx/
// styled-components) injects raw HTML directly into the stream instead of
// going through React's tree reconciliation, so this genuinely runs as a
// parser-blocking <script> before any body content paints - with none of
// the "Encountered a script tag while rendering React component" warning
// that a plain skipNextHead-rendered <script> child would trigger (that's
// why skipNextHead alone isn't used - see CLAUDE.md). This is a verbatim
// copy of the script NextThemeProvider generates from its defaults below
// (storageKey="theme", value={dark:"t_dark",light:"t_light"},
// enableSystem=true, attribute="class") - keep it in sync if those change.
const EARLY_THEME_SCRIPT = `!function(){try {var d=document.documentElement.classList;d.remove('t_dark');d.remove('t_light');var e=localStorage.getItem('theme');if("system"===e||(!e&&true)){var t="(prefers-color-scheme: dark)",m=window.matchMedia(t);m.media!==t||m.matches?d.add('t_dark'):d.add('t_light')}else if(e){var x={"dark":"t_dark","light":"t_light"};d.add(x[e])}}catch(e){}}()`;

export function Providers({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useRootTheme();
  // useServerInsertedHTML's callback re-fires on every streaming flush
  // boundary during SSR, not just once - without this guard the script gets
  // duplicated into the HTML once per flush (observed 8x in this app,
  // including one copy injected after the closing </html> tag).
  const insertedThemeScript = useRef(false);

  useServerInsertedHTML(() => {
    if (insertedThemeScript.current) return null;
    insertedThemeScript.current = true;
    return (
      <script
        id="early-theme-script"
        dangerouslySetInnerHTML={{ __html: EARLY_THEME_SCRIPT }}
      />
    );
  });

  return (
    <NextThemeProvider
      onChangeTheme={(next) => setTheme(next as "light" | "dark")}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
        // Phase-64-3：更新
        // {children}
        // ↓↓
        {/* 操作の完了の知らせ(トースト)。ルートに置くので、画面を移っても消えない */}
        <AppToastProvider>{children}</AppToastProvider>
      </TamaguiProvider>
    </NextThemeProvider>
  );
}
