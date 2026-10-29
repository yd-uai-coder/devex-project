// 作成：Phase-88-3｜更新：Phase-88(完了後の調整),109-2,116-4
// SUT: BaselineDetailContent(束の中身の画面)と、写した文書の md を描く MarkdownBody
// ドライバ: Testing Library(描画・クリック)
// Phase-88(完了後の調整)：更新
// // スタブ: 束と CR のストアの取得の関数(vi.fn)── 画面の配線(読み込み・合意の記録・入れた CR・文書・段階)だけを見るため
// import { beforeEach, describe, expect, it } from "vitest";
// ↓↓
// Phase-109-2：更新
// // スタブ: 束と CR のストアの取得の関数(vi.fn)と next/navigation の router ── 画面の配線(読み込み・合意の記録・
// ↓↓
// スタブ: 束のストアの取得の関数(vi.fn)と next/navigation の router ── 画面の配線(読み込み・合意の記録・
// 入れた CR・文書・段階・CR の作成へ移る・簡易モード)だけを見るため
// Phase-109-2：削除 ── @/features/change-requests/test-utils/changeRequestFixtures.makeChangeRequest
// Phase-116-4:追記 ── @/features/materials/test-utils/materialFixtures.makeFreshness
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BaselineDetailContent } from "../BaselineDetailContent";
import { useBaselinesStore } from "../../baselines-store";
import { makeBaseline } from "../../test-utils/baselineFixtures";
import { resetBaselinesStore } from "../../test-utils/resetBaselinesStore";
import { makeFreshness } from "@/features/materials/test-utils/materialFixtures";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { renderWithTheme, resetChangeRequestsStore } from "@/features/change-requests/test-utils/renderWithStore";

// Phase-88(完了後の調整):追記
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("BaselineDetailContent", () => {
  beforeEach(() => {
    // Phase-88(完了後の調整):追記
    push.mockReset();
    resetBaselinesStore();
    resetChangeRequestsStore();
  });

  // Phase-109-2：更新
  // it("中身と CR の一覧を読み、読み込み中を出す", () => {
  // ↓↓
  it("中身を読み(入れた CR は束の応答が持つので、CR の一覧は読まない)、読み込み中を出す", () => {
    renderWithTheme(<BaselineDetailContent projectId="p1" number={1} />);

    expect(useBaselinesStore.getState().fetchDetail).toHaveBeenCalledWith("p1", 1);
    // Phase-109-2：更新
    // expect(useChangeRequestsStore.getState().fetchList).toHaveBeenCalledWith("p1");
    // ↓↓
    expect(useChangeRequestsStore.getState().fetchList).not.toHaveBeenCalled();
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("合意の記録・入れた CR・段階の表を出し、文書の md は開いたときに描く", async () => {
    // Phase-109-2：更新
    // useBaselinesStore.setState({ detail: makeBaseline() });
    // useChangeRequestsStore.setState({
    //   list: [makeChangeRequest({ number: 2, label: "CR-2", status: "verified", status_label: "検証済み", included_baseline_number: 1 })],
    // ↓↓
    useBaselinesStore.setState({
      detail: makeBaseline({ included_change_requests: [{ number: 2, title: "画面を足す" }] }),
    });
    const user = userEvent.setup();
    renderWithTheme(<BaselineDetailContent projectId="p1" number={1} />);

    expect(screen.getByText("相手: 山田(発注者)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CR-2" })).toHaveAttribute("href", "/projects/p1/change-requests/2");
    // Phase-109-2:追記
    expect(screen.getByText("画面を足す")).toBeInTheDocument();
    expect(screen.getByText("テスト仕様書: 無い(作った時点で無かった)")).toBeInTheDocument();
    const stages = screen.getByRole("table", { name: "束の段階" });
    expect(stages).toHaveTextContent("段階6 処理ロジックの詳細(任意)入った古いv2");
    expect(stages).toHaveTextContent("段階8 実装手順書入っていない未着手─");

    expect(screen.queryByRole("region", { name: "要件定義書の写し" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "要件定義書を見る" }));
    expect(screen.getByRole("region", { name: "要件定義書の写し" })).toHaveTextContent("FR-001 ログイン");
  });

  it("取得の失敗を出す", () => {
    useBaselinesStore.setState({ detailStatus: "error", detailError: "合意済みの版の取得に失敗しました" });

    renderWithTheme(<BaselineDetailContent projectId="p1" number={9} />);

    expect(screen.getByRole("alert")).toHaveTextContent("合意済みの版の取得に失敗しました");
  });

  // Phase-88(完了後の調整):追記
  it("この版を基準に変更要求を作るページへ移る", async () => {
    useBaselinesStore.setState({ detail: makeBaseline({ number: 2, label: "B-2" }) });
    const user = userEvent.setup();
    renderWithTheme(<BaselineDetailContent projectId="p1" number={2} />);

    await user.click(screen.getByRole("button", { name: "この版を基準に変更要求を作る →" }));

    expect(push).toHaveBeenCalledWith("/projects/p1/baselines/2/change-requests/new");
  });

  it("簡易モードのプロジェクトでは、詳細設計モードだけと知らせる", () => {
    useBaselinesStore.setState({ unavailable: true });

    renderWithTheme(<BaselineDetailContent projectId="p1" number={1} />);

    expect(screen.getByText(/詳細設計モードのプロジェクトだけで使えます/)).toBeInTheDocument();
  });

  // Phase-116-4:追記
  it("束が古ければ知らせ、判定できない束はそう出す", () => {
    useBaselinesStore.setState({
      detail: makeBaseline(),
      freshness: makeFreshness({ baseline_number: 1, fresh: false, applied_after: [{ number: 2, keys: ["req:FR-001"] }] }),
    });
    const { unmount } = renderWithTheme(<BaselineDetailContent projectId="p1" number={1} />);
    expect(screen.getByLabelText("B-1 が古いことの知らせ")).toBeInTheDocument();
    unmount();

    useBaselinesStore.setState({ freshness: makeFreshness({ baseline_number: 1, tracked: false }) });
    renderWithTheme(<BaselineDetailContent projectId="p1" number={1} />);
    expect(screen.queryByLabelText("B-1 が古いことの知らせ")).toBeNull();
    expect(screen.getByText(/後に反映した変更要求があるかは判定できません/)).toBeInTheDocument();
  });
});
