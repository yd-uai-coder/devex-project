// 作成：Phase-88-3｜更新：Phase-88(完了後の調整),98-1,109-2
// Phase-88(完了後の調整)：更新
// // SUT: BaselinesPageContent(束の一覧と作成の画面)と、その中の BaselineList
// ↓↓
// SUT: BaselinesPageContent(束の一覧と作成の画面)と、その中の BaselineList・DetailedModeOnlyNotice
// ドライバ: Testing Library(描画・クリック)
// スタブ: 束と CR のストアの取得・作成の関数(vi.fn)と next/navigation の router ── 画面の配線
// (読み込み・作成のフォームを開いたときの読み直し・作った後の移動)だけを見るため
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BaselinesPageContent } from "../BaselinesPageContent";
import { useBaselinesStore } from "../../baselines-store";
import { makeBaseline, makeBaselineSummary } from "../../test-utils/baselineFixtures";
import { resetBaselinesStore } from "../../test-utils/resetBaselinesStore";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { makeChangeRequest } from "@/features/change-requests/test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "@/features/change-requests/test-utils/renderWithStore";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("BaselinesPageContent", () => {
  beforeEach(() => {
    push.mockReset();
    resetBaselinesStore();
    resetChangeRequestsStore();
    // Phase-109-2：更新
    // useBaselinesStore.setState({ list: [makeBaselineSummary({ number: 2, label: "B-2" }), makeBaselineSummary()] });
    // ↓↓
    useBaselinesStore.setState({
      list: [
        makeBaselineSummary({ number: 2, label: "B-2", included_change_requests: [{ number: 3, title: "入れた CR" }] }),
        makeBaselineSummary(),
      ],
    });
    useChangeRequestsStore.setState({
      list: [
        makeChangeRequest({ number: 3, label: "CR-3", status: "verified", included_baseline_number: 2 }),
        makeChangeRequest({ number: 4, label: "CR-4", status: "verified", title: "まだ入れていない" }),
      ],
    });
  });

  // Phase-109-2：更新
  // it("束と CR の一覧を読み、束ごとに入れた CR と入った段階の数を出す", () => {
  // ↓↓
  it("束と CR の一覧を読み、束ごとに入れた CR(束の応答)と入った段階の数を出す", () => {
    renderWithTheme(<BaselinesPageContent projectId="p1" />);

    expect(useBaselinesStore.getState().fetchList).toHaveBeenCalledWith("p1");
    expect(useChangeRequestsStore.getState().fetchList).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("link", { name: "B-2" })).toHaveAttribute("href", "/projects/p1/baselines/2");
    // Phase-88(完了後の調整):追記
    // 番号のほかに、行の末尾からも中身へ移れる(押せることが見て分かるように)
    expect(screen.getByRole("link", { name: "B-2 の中身を見る" })).toHaveAttribute("href", "/projects/p1/baselines/2");
    expect(screen.getByRole("link", { name: "CR-3" })).toHaveAttribute("href", "/projects/p1/change-requests/3");
    expect(screen.getAllByText("6 / 8 入った")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "← 変更要求(CR)" })).toHaveAttribute("href", "/projects/p1/change-requests");
    // Phase-98-1:追記
    expect(screen.getByRole("link", { name: "確認事項" })).toHaveAttribute("href", "/projects/p1/confirmations");
  });

  it("作成のフォームを開くと段階と CR を読み直し、入れられる CR だけを選ばせる", async () => {
    const user = userEvent.setup();
    renderWithTheme(<BaselinesPageContent projectId="p1" />);

    await user.click(screen.getByRole("button", { name: "合意済みの版を作る" }));

    expect(useBaselinesStore.getState().fetchStages).toHaveBeenCalledWith("p1");
    expect(useChangeRequestsStore.getState().fetchList).toHaveBeenCalledWith("p1", { force: true });
    expect(screen.getByRole("checkbox", { name: /CR-4/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /CR-3/ })).not.toBeInTheDocument();
  });

  it("作ると、作った束の中身へ移る", async () => {
    useBaselinesStore.setState({ create: vi.fn().mockResolvedValue(makeBaseline({ number: 3 })) });
    const user = userEvent.setup();
    renderWithTheme(<BaselinesPageContent projectId="p1" />);

    await user.click(screen.getByRole("button", { name: "合意済みの版を作る" }));
    await user.type(screen.getByLabelText("理由"), "初版");
    await user.click(screen.getAllByRole("button", { name: "合意済みの版を作る" }).at(-1)!);

    expect(useBaselinesStore.getState().create).toHaveBeenCalledWith("p1", expect.objectContaining({ reason: "初版" }));
    expect(push).toHaveBeenCalledWith("/projects/p1/baselines/3");
  });

  // Phase-88(完了後の調整):追記
  it("簡易モードのプロジェクトでは、詳細設計モードだけと知らせる", () => {
    useBaselinesStore.setState({ unavailable: true });

    renderWithTheme(<BaselinesPageContent projectId="p1" />);

    expect(screen.getByText(/詳細設計モードのプロジェクトだけで使えます/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "合意済みの版を作る" })).not.toBeInTheDocument();
  });
});
