// 作成：Phase-3-4｜更新：Phase-15-7,62-3
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
// Phase-62-3:追記 ── userEvent(@testing-library/user-event)
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import NewProjectPage from "../page";
import { useAuthStore } from "@/components/auth/auth-store";

// Phase-62-3:追記
const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/projects/new",
  // Phase-62-3：更新
  // useRouter: () => ({ push: vi.fn() }),
  // ↓↓
  useRouter: () => ({ push }),
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
  // Phase-62-3：更新(mode なしはモード選択ダイアログになったので、簡易ドキュメントモードは ?mode=simple で開く)
  // it("ログイン済みならヒアリング入力フォームを表示する", async () => {
  //   await renderPage({});
  //
  //   expect(screen.getByRole("button", { name: "ヒアリングを始める" })).toBeInTheDocument();
  //   // ?mode= が無ければ簡易ドキュメントモード
  //   expect(screen.getByText("モード: 簡易ドキュメントモード")).toBeInTheDocument();
  // });
  // ↓↓
  it("ログイン済みで ?mode=simple ならヒアリング入力フォームを表示する", async () => {
    await renderPage({ mode: "simple" });

    expect(screen.getByRole("button", { name: "ヒアリングを始める" })).toBeInTheDocument();
    expect(screen.getByText("モード: 簡易ドキュメントモード")).toBeInTheDocument();
  });

  // Phase-62-3:追記
  it.each([{}, { mode: "unknown" }])("mode が無い・不正(%o)ならモード選択ダイアログを出し、フォームを出さない", async (query) => {
    await renderPage(query);

    // Tamagui の Dialog は jsdom ではロールのクエリで隠れている扱いのため、文と aria-label で取る
    expect(screen.getByText("モードを選んでください")).toBeInTheDocument();
    expect(screen.getByLabelText("詳細設計モードで作成する")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ヒアリングを始める" })).toBeNull();
  });

  // Phase-62-3:追記
  it("mode なしのダイアログでキャンセルするとダッシュボードへ戻る", async () => {
    push.mockClear();
    const user = userEvent.setup();
    await renderPage({});

    await user.click(screen.getByText("キャンセル"));

    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("?mode=detailed なら詳細設計モードで作成する", async () => {
    await renderPage({ mode: "detailed" });

    expect(screen.getByText("モード: 詳細設計モード")).toBeInTheDocument();
  });
});
