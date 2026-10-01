// 作成：Phase-3-4｜更新：Phase-15-7
// Phase-15-7：更新(searchParams を渡してモードを確かめる)
// import { describe, expect, it, vi } from "vitest";
// import { render, screen } from "@testing-library/react";
// import { TamaguiProvider } from "tamagui";
// import tamaguiConfig from "@/tamagui.config";
// import NewProjectPage from "../page";
// import { useAuthStore } from "@/components/auth/auth-store";
//
// vi.mock("next/navigation", () => ({
//   usePathname: () => "/projects/new",
//   useRouter: () => ({ push: vi.fn() }),
// }));
//
// describe("NewProjectPage", () => {
//   it("ログイン済みならヒアリング入力フォームを表示する", () => {
//     useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });
//
//     render(
//       <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
//         <NewProjectPage />
//       </TamaguiProvider>,
//     );
//
//     expect(screen.getByRole("button", { name: "ヒアリングを始める" })).toBeInTheDocument();
//   });
// });
// ↓↓
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import NewProjectPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/new",
  useRouter: () => ({ push: vi.fn() }),
}));

async function renderPage(query: { [key: string]: string | undefined }) {
  useAuthStore.setState({ accessToken: "header.payload.sig", status: "success", error: null });
  const element = await NewProjectPage({ searchParams: Promise.resolve(query) });
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {element}
    </TamaguiProvider>,
  );
}

describe("NewProjectPage", () => {
  it("ログイン済みならヒアリング入力フォームを表示する", async () => {
    await renderPage({});

    expect(screen.getByRole("button", { name: "ヒアリングを始める" })).toBeInTheDocument();
    // ?mode= が無ければ簡易ドキュメントモード
    expect(screen.getByText("モード: 簡易ドキュメントモード")).toBeInTheDocument();
  });

  it("?mode=detailed なら詳細設計モードで作成する", async () => {
    await renderPage({ mode: "detailed" });

    expect(screen.getByText("モード: 詳細設計モード")).toBeInTheDocument();
  });
});
