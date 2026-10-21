// 作成：Phase-87-2｜更新：Phase-88-2,88-3,88(完了後の調整),98-1
// Phase-88(完了後の調整)：更新(作成のテストを ChangeRequestCreateContent.test.tsx へ移し、案内のリンクと簡易モードの知らせを確かめる。全体を書き換えた)
// // SUT: ChangeRequestsPageContent(一覧と作成の画面)と、その中の ChangeRequestList・StatusBadge
// // ドライバ: Testing Library(描画・クリック)
// // スタブ: ストアの取得・作成の関数(vi.fn)と next/navigation の router ── 画面の配線
// // (読み込み・束が無いときの止め方・作った後の移動)だけを見るため。ストア自体は store のテストで確かめる
// import { beforeEach, describe, expect, it, vi } from "vitest";
// import { render, screen } from "@testing-library/react";
// import userEvent from "@testing-library/user-event";
// import { TamaguiProvider } from "tamagui";
// import tamaguiConfig from "@/tamagui.config";
// import { ChangeRequestsPageContent } from "../ChangeRequestsPageContent";
// import { useChangeRequestsStore } from "../../change-requests-store";
// import { makeChangeRequest } from "../../test-utils/changeRequestFixtures";
// import { makeBaselineSummary } from "@/features/baselines/test-utils/baselineFixtures";
//
// const push = vi.fn();
// vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
//
// const BASELINE = makeBaselineSummary();
//
// function renderContent() {
//   return render(
//     <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
//       <ChangeRequestsPageContent projectId="p1" />
//     </TamaguiProvider>,
//   );
// }
//
// describe("ChangeRequestsPageContent", () => {
//   beforeEach(() => {
//     push.mockReset();
//     useChangeRequestsStore.setState({
//       projectId: "p1",
//       list: [],
//       status: "success",
//       error: null,
//       notFound: false,
//       baselines: [BASELINE],
//       requirements: { 1: [{ id: "FR-005", kind: "FR", priority: "Must", category: "", text: "3件まで" }] },
//       acting: false,
//       actionError: null,
//       fetchList: vi.fn().mockResolvedValue(undefined),
//       fetchBaselines: vi.fn().mockResolvedValue(undefined),
//       fetchRequirements: vi.fn().mockResolvedValue(undefined),
//       create: vi.fn().mockResolvedValue(makeChangeRequest({ number: 7 })),
//     });
//   });
//
//   it("開くと一覧と束を読み、一覧の行から詳細へのリンクと状態を出す", () => {
//     useChangeRequestsStore.setState({ list: [makeChangeRequest({ status: "agreed", status_label: "合意" })] });
//
//     renderContent();
//
//     expect(useChangeRequestsStore.getState().fetchList).toHaveBeenCalledWith("p1");
//     expect(useChangeRequestsStore.getState().fetchBaselines).toHaveBeenCalledWith("p1");
//     expect(screen.getByRole("link", { name: "CR-1" })).toHaveAttribute("href", "/projects/p1/change-requests/1");
//     // 基準の版から束の中身へ、見出しから束の一覧へ移れる
//     expect(screen.getByRole("link", { name: "B-1" })).toHaveAttribute("href", "/projects/p1/baselines/1");
//     expect(screen.getByRole("link", { name: "合意済みの版" })).toHaveAttribute("href", "/projects/p1/baselines");
//     expect(screen.getByLabelText("状態: 合意")).toBeInTheDocument();
//     expect(screen.getByText("FR-005(内容の変更)")).toBeInTheDocument();
//   });
//
//   it("束が無ければ作成のボタンを押せず、理由を出す", () => {
//     useChangeRequestsStore.setState({ baselines: [] });
//
//     renderContent();
//
//     expect(screen.getByRole("button", { name: "変更要求を作る" })).toHaveAttribute("aria-disabled", "true");
//     expect(screen.getByText(/合意済みの版がまだありません/)).toBeInTheDocument();
//     expect(screen.getAllByRole("link", { name: "合意済みの版" })).toHaveLength(2); // 見出しと理由の文
//     expect(screen.getByText("変更要求はまだありません。")).toBeInTheDocument();
//   });
//
//   it("作成のフォームで作ると、作った CR の詳細へ移る", async () => {
//     renderContent();
//
//     await userEvent.click(screen.getByRole("button", { name: "変更要求を作る" }));
//     expect(useChangeRequestsStore.getState().fetchRequirements).toHaveBeenCalledWith("p1", 1);
//     await userEvent.type(screen.getByLabelText("タイトル"), "t");
//     await userEvent.type(screen.getByLabelText("内容"), "c");
//     await userEvent.click(screen.getByRole("checkbox"));
//     await userEvent.click(screen.getByRole("button", { name: "下書きで作る" }));
//
//     expect(useChangeRequestsStore.getState().create).toHaveBeenCalledWith(
//       "p1",
//       expect.objectContaining({ title: "t", adds_requirement: true, baseline_number: 1 }),
//     );
//     expect(push).toHaveBeenCalledWith("/projects/p1/change-requests/7");
//   });
//
//   it("プロジェクトが無ければ知らせだけを出す", () => {
//     useChangeRequestsStore.setState({ notFound: true });
//
//     renderContent();
//
//     expect(screen.queryByRole("button", { name: "変更要求を作る" })).not.toBeInTheDocument();
//   });
// });
// ↓↓
// SUT: ChangeRequestsPageContent(一覧の画面)と、その中の ChangeRequestList・StatusBadge・DetailedModeOnlyNotice
// ドライバ: Testing Library(描画)
// スタブ: ストアの取得の関数(vi.fn)── 画面の配線(読み込み・リンク・作成は束の中身から、と知らせる・
// 簡易モードの知らせ)だけを見るため。ストア自体は store のテストで確かめる
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ChangeRequestsPageContent } from "../ChangeRequestsPageContent";
import { useChangeRequestsStore } from "../../change-requests-store";
import { makeChangeRequest } from "../../test-utils/changeRequestFixtures";

function renderContent() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ChangeRequestsPageContent projectId="p1" />
    </TamaguiProvider>,
  );
}

describe("ChangeRequestsPageContent", () => {
  beforeEach(() => {
    useChangeRequestsStore.setState({
      projectId: "p1",
      list: [],
      status: "success",
      error: null,
      notFound: false,
      unavailable: false,
      fetchList: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("開くと一覧を読み、一覧の行から詳細と基準の版へのリンクと状態を出す", () => {
    useChangeRequestsStore.setState({ list: [makeChangeRequest({ status: "agreed", status_label: "合意" })] });

    renderContent();

    expect(useChangeRequestsStore.getState().fetchList).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("link", { name: "CR-1" })).toHaveAttribute("href", "/projects/p1/change-requests/1");
    expect(screen.getByRole("link", { name: "B-1" })).toHaveAttribute("href", "/projects/p1/baselines/1");
    expect(screen.getByLabelText("状態: 合意")).toBeInTheDocument();
    expect(screen.getByText("FR-005(内容の変更)")).toBeInTheDocument();
  });

  it("作成のボタンは置かず、作成は合意済みの版の中身から、と束の一覧へのリンクを出す", () => {
    renderContent();

    expect(screen.queryByRole("button", { name: "変更要求を作る" })).not.toBeInTheDocument();
    expect(screen.getByText(/の中身のページから作ります/)).toBeInTheDocument();
    // 見出しと案内の文の2つ
    const links = screen.getAllByRole("link", { name: "合意済みの版" });
    expect(links).toHaveLength(2);
    expect(links[1]).toHaveAttribute("href", "/projects/p1/baselines");
    // Phase-98-1:追記
    expect(screen.getByRole("link", { name: "確認事項" })).toHaveAttribute("href", "/projects/p1/confirmations");
    expect(screen.getByText("変更要求はまだありません。")).toBeInTheDocument();
  });

  it("プロジェクトが無ければ知らせだけを出す", () => {
    useChangeRequestsStore.setState({ notFound: true });

    renderContent();

    expect(screen.getByText("このプロジェクトは見つかりません")).toBeInTheDocument();
  });

  it("簡易モードのプロジェクトでは、詳細設計モードだけと知らせる", () => {
    useChangeRequestsStore.setState({ unavailable: true });

    renderContent();

    expect(screen.getByText(/詳細設計モードのプロジェクトだけで使えます/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ドキュメントへ戻る →" })).toHaveAttribute("href", "/projects/p1/documents");
    expect(screen.queryByText("変更要求はまだありません。")).not.toBeInTheDocument();
  });
});
