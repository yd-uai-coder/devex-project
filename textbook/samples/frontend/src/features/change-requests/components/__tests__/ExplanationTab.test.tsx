// 作成：Phase-88-4｜更新：Phase-107-4
// SUT: ExplanationTab(説明書のタブ)と、その中の SummaryReview(要約の確認)・ExplanationDownloadButton・
//      MarkdownBody(出力のプレビュー)
// ドライバ: Testing Library(描画・入力・クリック)
// スタブ: ストアの取得・要約の操作の関数(vi.fn)と説明書の API(vi.mock)・saveFile ── タブの配線
// (読み込み・札・印・保存と確認の出し分け・出力に載るかの文・プレビュー)だけを見るため。
// 要約の操作の後に説明書を置き換えるのはストアのテスト
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplanationTab } from "../ExplanationTab";
import { useChangeRequestsStore } from "../../change-requests-store";
import { makeChangeRequest, makeExplanation, makeSummary } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";

const downloadExplanation = vi.fn();
vi.mock("@/features/change-requests/api/changeRequestsApi", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadExplanation: (...args: unknown[]) => downloadExplanation(...args),
}));
const saveFile = vi.fn();
vi.mock("@/lib/api/download", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  saveFile: (...args: unknown[]) => saveFile(...args),
}));

const CR = makeChangeRequest({ status: "agreed" });
const setExplanation = (explanation: ReturnType<typeof makeExplanation>) =>
  useChangeRequestsStore.setState({ detail: CR, views: { ...useChangeRequestsStore.getState().views, explanation } });

describe("ExplanationTab", () => {
  beforeEach(() => {
    resetChangeRequestsStore();
    saveFile.mockReset();
    downloadExplanation.mockReset().mockResolvedValue({ filename: "cr-1-explanation.md", content: "# CR-1" });
  });

  it("開くと説明書を読み、読み込み中を出す", () => {
    renderWithTheme(<ExplanationTab projectId="p1" cr={CR} />);

    expect(useChangeRequestsStore.getState().fetchView).toHaveBeenCalledWith("p1", 1, "explanation");
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("要約が無ければ作るボタンだけを出し、出力は5節だけと示す。プレビューとダウンロードを置く", async () => {
    setExplanation(makeExplanation());
    const user = userEvent.setup();
    renderWithTheme(<ExplanationTab projectId="p1" cr={CR} />);

    expect(screen.getByText(/出力は5節だけです/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "説明書のプレビュー" })).toHaveTextContent("CR の内容と背景");
    expect(screen.getByText(/作業単位 1 件 ・結合テスト 1 件 ・総合テスト 0 件/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "要約を作る" }));
    expect(useChangeRequestsStore.getState().summarize).toHaveBeenCalledWith("p1", 1);

    await user.click(screen.getByRole("button", { name: "説明書をダウンロード(.md)" }));
    await waitFor(() => expect(saveFile).toHaveBeenCalledWith("cr-1-explanation.md", "# CR-1", "text/markdown"));
  });

  it("元の文と直す欄を並べ、照合で合わない所に印を付け、札で状態を出す", () => {
    setExplanation(
      makeExplanation({ summary: makeSummary({ unknown_requirement_ids: ["FR-099"], generated_text: "FR-099 と 7件" }) }),
    );
    renderWithTheme(<ExplanationTab projectId="p1" cr={CR} />);

    expect(screen.getByLabelText("要約の状態: 未確認")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("5節に無い: FR-099 / 7");
    const original = screen.getByLabelText("LLM の元の文");
    expect(within(original).getAllByTitle("5節に無い").map((m) => m.textContent)).toEqual(["FR-099", "7"]);
    expect(screen.getByLabelText("直す欄")).toHaveValue(makeSummary().text);
    expect(screen.getByText(/未確認の間は、出力に要約は載りません/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "要約を作り直す" })).toBeInTheDocument();
  });

  it("直して保存し、保存していない直しがある間は確認できない", async () => {
    setExplanation(makeExplanation({ summary: makeSummary() }));
    const user = userEvent.setup();
    renderWithTheme(<ExplanationTab projectId="p1" cr={CR} />);

    expect(screen.getByRole("button", { name: "保存" })).toHaveAttribute("aria-disabled", "true");
    await user.clear(screen.getByLabelText("直す欄"));
    await user.type(screen.getByLabelText("直す欄"), "参考資料を5件まで添付できるようにします。");

    expect(screen.getByRole("button", { name: "確認した" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/保存していない直しがあります/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(useChangeRequestsStore.getState().editSummary).toHaveBeenCalledWith(
      "p1",
      1,
      "参考資料を5件まで添付できるようにします。",
    );
  });

  it("確認すると確認の操作を呼ぶ。確認済み・古いは札と、出力に載るかの文で示す", async () => {
    setExplanation(makeExplanation({ summary: makeSummary() }));
    const user = userEvent.setup();
    const { unmount } = renderWithTheme(<ExplanationTab projectId="p1" cr={CR} />);
    await user.click(screen.getByRole("button", { name: "確認した" }));
    expect(useChangeRequestsStore.getState().confirmSummary).toHaveBeenCalledWith("p1", 1);
    unmount();

    setExplanation(
      makeExplanation({ summary: makeSummary({ state: "confirmed", state_label: "確認済み", confirmed_at: "2026-10-20T02:00:00Z" }) }),
    );
    const confirmed = renderWithTheme(<ExplanationTab projectId="p1" cr={CR} />);
    expect(screen.getByLabelText("要約の状態: 確認済み")).toBeInTheDocument();
    expect(screen.getByText(/出力の先頭に要約が載ります/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "確認した" })).toHaveAttribute("aria-disabled", "true");
    confirmed.unmount();

    setExplanation(makeExplanation({ summary: makeSummary({ state: "stale", state_label: "古い" }) }));
    renderWithTheme(<ExplanationTab projectId="p1" cr={CR} />);
    expect(screen.getByLabelText("要約の状態: 古い")).toBeInTheDocument();
    expect(screen.getByText(/確かめ直すまで、出力に要約は載りません/)).toBeInTheDocument();
  });

  // Phase-107-4:追記
  it("確認済みのまま古くなった要約は、共有の前に確かめ直すよう知らせる", () => {
    setExplanation(makeExplanation({ summary: makeSummary({ state: "stale", needs_reconfirm: true }) }));
    renderWithTheme(<ExplanationTab projectId="p1" cr={CR} />);

    expect(screen.getByText(/共有する前に確かめ直してください/)).toBeInTheDocument();
  });

  it("要約の失敗と、説明書の読み込みの失敗を出す", () => {
    setExplanation(makeExplanation());
    useChangeRequestsStore.setState({ summaryError: "要約を作れませんでした" });
    const { unmount } = renderWithTheme(<ExplanationTab projectId="p1" cr={CR} />);
    expect(screen.getByRole("alert")).toHaveTextContent("要約を作れませんでした");
    unmount();

    useChangeRequestsStore.setState({ viewErrors: { explanation: "読み込みに失敗しました" } });
    renderWithTheme(<ExplanationTab projectId="p1" cr={CR} />);
    expect(screen.getByRole("alert")).toHaveTextContent("読み込みに失敗しました");
  });
});
