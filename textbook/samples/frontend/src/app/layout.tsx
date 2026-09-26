// 更新：Phase-3-1
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
  title: "Next + Tamagui Templates",
  description: "Next.js + Tamagui UI template collection",
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
