// 作成：Phase-88(完了後の調整)｜更新：Phase-98-2
// SUT: ChangeRequestCreateContent(合意済みの版を基準に CR を作るページ)と、その中の ChangeRequestForm
// ドライバ: Testing Library(描画・入力・クリック)
// スタブ: ストアの取得・作成の関数(vi.fn)と next/navigation の router ── 画面の配線(基準の版の固定・
// 要件の読み込み・作った後とやめた後の移動・版が無い・簡易モード)だけを見るため
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangeRequestCreateContent } from "../ChangeRequestCreateContent";
import { useChangeRequestsStore } from "../../change-requests-store";
import { makeChangeRequest } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";
import { makeBaselineSummary } from "@/features/baselines/test-utils/baselineFixtures";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("ChangeRequestCreateContent", () => {
  beforeEach(() => {
    push.mockReset();
    resetChangeRequestsStore();
    useChangeRequestsStore.setState({
      baselines: [makeBaselineSummary({ number: 2, label: "B-2" }), makeBaselineSummary()],
      requirements: { 2: [{ id: "FR-005", kind: "FR", priority: "Must", category: "", text: "3件まで" }] },
      create: vi.fn().mockResolvedValue(makeChangeRequest({ number: 7 })),
    });
  });

  it("束と、遷移元の版の要件を読み、基準の版は固定して選ばせない", () => {
    renderWithTheme(<ChangeRequestCreateContent projectId="p1" baselineNumber={2} />);

    expect(useChangeRequestsStore.getState().fetchBaselines).toHaveBeenCalledWith("p1");
    expect(useChangeRequestsStore.getState().fetchRequirements).toHaveBeenCalledWith("p1", 2);
    // Phase-98-2:追記
    expect(useChangeRequestsStore.getState().fetchOrigins).toHaveBeenCalledWith("p1", 2);
    expect(screen.getByText(/基準の合意済みの版: B-2/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "基準の合意済みの版" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← B-2 合意済みの版" })).toHaveAttribute("href", "/projects/p1/baselines/2");
  });

  it("作ると、遷移元の版を基準にして、作った CR の詳細へ移る", async () => {
    renderWithTheme(<ChangeRequestCreateContent projectId="p1" baselineNumber={2} />);

    await userEvent.type(screen.getByLabelText("タイトル"), "t");
    await userEvent.type(screen.getByLabelText("内容"), "c");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "下書きで作る" }));

    expect(useChangeRequestsStore.getState().create).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ title: "t", adds_requirement: true, baseline_number: 2 }),
    );
    expect(push).toHaveBeenCalledWith("/projects/p1/change-requests/7");
  });

  it("やめると、遷移元の版の中身へ戻る", async () => {
    renderWithTheme(<ChangeRequestCreateContent projectId="p1" baselineNumber={2} />);

    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(push).toHaveBeenCalledWith("/projects/p1/baselines/2");
  });

  it("番号の版が無ければ、見つからないと一覧へのリンクを出す", () => {
    renderWithTheme(<ChangeRequestCreateContent projectId="p1" baselineNumber={9} />);

    expect(screen.getByText(/合意済みの版 B-9 は見つかりません/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← 合意済みの版の一覧" })).toHaveAttribute("href", "/projects/p1/baselines");
    expect(screen.queryByRole("button", { name: "下書きで作る" })).not.toBeInTheDocument();
  });

  it("簡易モードのプロジェクトでは、詳細設計モードだけと知らせる", () => {
    useChangeRequestsStore.setState({ unavailable: true });

    renderWithTheme(<ChangeRequestCreateContent projectId="p1" baselineNumber={2} />);

    expect(screen.getByText(/詳細設計モードのプロジェクトだけで使えます/)).toBeInTheDocument();
  });
});
