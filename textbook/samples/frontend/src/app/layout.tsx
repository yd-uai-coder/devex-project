// 更新：Phase-3-1,24(T2同期)
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/AppShell";
// Phase-3-1:追記 ── @/components/auth/AuthBootstrap
import { AuthBootstrap } from "@/components/auth/AuthBootstrap";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Phase-24(T2同期)：更新(テンプレートの表題を Devex の表題にした)
  // title: "Next + Tamagui Templates",
  // description: "Next.js + Tamagui UI template collection",
  // ↓↓
  title: "Devex",
  description: "AIによるシステム開発を支援するAIツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>
          {/* Phase-3-1:追記 ── 起動時に一度だけセッション復元を試みる(画面には何も描画しない) */}
          <AuthBootstrap />
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
