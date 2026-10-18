// 作成：Phase-3-2｜更新：Phase-76-2
// Phase-76-2：更新
// import { describe, expect, it, vi } from "vitest";
// ↓↓
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import LoginPage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Phase-76-2:追記
function renderPage() {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <LoginPage />
    </TamaguiProvider>,
  );
}

describe("LoginPage", () => {
  // Phase-76-2:追記
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ログインフォームと登録画面へのリンクを表示する", () => {
    // Phase-76-2：更新
    // render(
    //   <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
    //     <LoginPage />
    //   </TamaguiProvider>,
    // );
    // ↓↓
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    renderPage();

    expect(screen.getByRole("button", { name: "ログイン" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "こちらから登録" })).toHaveAttribute("href", "/register");
  });

  // Phase-76-2:追記
  it("Google のボタンを出せる環境では、フォームの下に「または」と Google のボタンを出す", () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_FAKE_GOOGLE", "true");
    renderPage();

    expect(screen.getByRole("button", { name: "ログイン" })).toBeInTheDocument();
    expect(screen.getByText("または")).toBeInTheDocument();
    expect(screen.getByLabelText("Google で続ける(E2E)")).toBeInTheDocument();
  });

  it("クライアント ID が無ければ Google の部分を出さない", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "");
    renderPage();

    expect(screen.queryByText("または")).not.toBeInTheDocument();
  });
});
