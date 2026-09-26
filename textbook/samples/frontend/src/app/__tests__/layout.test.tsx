// 作成：Phase-3-1
import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import RootLayout from "../layout";
import { AuthBootstrap } from "@/components/auth/AuthBootstrap";

// このテストはRootLayout自身の構造(AuthBootstrapを含むかどうか)だけを見たいので、
// Providers/AppShellの実装(Tamagui本体・next-themeなど)は評価しない。
vi.mock("../providers", () => ({ Providers: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => children,
}));
// next/font/googleはNext.jsのビルド時マクロで、Vitest(Vite)環境では実行時関数として
// 動作しないため、変数名を返すだけのダミーに差し替える。
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "mock-geist-sans" }),
  Geist_Mono: () => ({ variable: "mock-geist-mono" }),
}));

// RootLayoutは<html><body>を返すためRTLでのDOMレンダリングとは相性が悪い(jsdomの
// documentへ二重にhtml/bodyをマウントすることになる)。ここでは要素ツリーを直接
// 関数呼び出しで取得し、AuthBootstrapが含まれているかどうかだけを構造的に確認する。
function includesComponent(node: ReactNode, Component: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((child) => includesComponent(child, Component));
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element.type === Component) return true;
  return includesComponent(element.props?.children, Component);
}

describe("RootLayout", () => {
  it("Providers配下にAuthBootstrapを含む(起動時のセッション復元を必ず走らせるため)", () => {
    const tree = RootLayout({ children: <div>child</div> });

    expect(includesComponent(tree, AuthBootstrap)).toBe(true);
  });
});
