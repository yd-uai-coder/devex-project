// 作成：Phase-107-4｜更新：Phase-116-4
// SUT: ShareTab と、その中の ShareLinkPanel(共有リンクの作成・URL の表示・一覧・延長・取り消し)
// ドライバ: Testing Library(描画・入力・クリック)
// スタブ: ストアの関数(vi.fn)と navigator.clipboard ── 確かめのダイアログの文と、操作に渡す値だけを見るため。
// 作った後に CR を読み直すのはストアのテスト
// Phase-116-4:追記 ── @/features/materials/test-utils/materialFixtures.makeFreshness
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareTab } from "../ShareTab";
import { useChangeRequestsStore } from "../../change-requests-store";
import {
  makeChangeRequest,
  makeCreatedShareLink,
  makeExplanation,
  makeShareLink,
  makeSummary,
} from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";
import { makeFreshness } from "@/features/materials/test-utils/materialFixtures";

const store = () => useChangeRequestsStore.getState();
const setViews = (views: Partial<ReturnType<typeof store>["views"]>) =>
  useChangeRequestsStore.setState({ views: { ...store().views, ...views } });

describe("ShareLinkPanel", () => {
  beforeEach(() => {
    resetChangeRequestsStore();
  });

  it("開くとリンクの一覧と説明書を読む", () => {
    renderWithTheme(<ShareTab projectId="p1" cr={makeChangeRequest()} />);

    expect(store().fetchView).toHaveBeenCalledWith("p1", 1, "shareLinks");
    expect(store().fetchView).toHaveBeenCalledWith("p1", 1, "explanation");
  });

  it("下書きの CR で作ると説明済みになること、古い要約を確かめで知らせ、日数を渡して作る", async () => {
    setViews({
      shareLinks: [],
      explanation: makeExplanation({ summary: makeSummary({ state: "stale", needs_reconfirm: true }) }),
    });
    renderWithTheme(<ShareTab projectId="p1" cr={makeChangeRequest()} />);

    expect(screen.getByText("まだリンクはありません。")).toBeInTheDocument();
    const days = screen.getByLabelText(/期限/);
    await userEvent.clear(days);
    await userEvent.type(days, "30");
    await userEvent.click(screen.getByRole("button", { name: "共有リンクを作る" }));
    expect(await screen.findByText(/CR は説明済みになります/)).toBeInTheDocument();
    expect(screen.getByText(/確認済みの要約が、その後の説明書の変化で古くなっています/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("作る"));

    expect(store().createShare).toHaveBeenCalledWith("p1", 1, 30);
  });

  it("有効なリンクがあれば作り直しになり、前のリンクが使えなくなると確かめる。期限が範囲の外なら押せない", async () => {
    setViews({ shareLinks: [makeShareLink()], explanation: makeExplanation() });
    renderWithTheme(<ShareTab projectId="p1" cr={makeChangeRequest({ status: "explained" })} />);

    await userEvent.click(screen.getByRole("button", { name: "リンクを作り直す" }));
    expect(await screen.findByText(/今のリンクは使えなくなります/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("キャンセル"));

    const days = screen.getByLabelText(/期限/);
    await userEvent.clear(days);
    await userEvent.type(days, "91");
    expect(screen.getByText("期限は1〜90日で入れてください")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "リンクを作り直す" })).toHaveAttribute("aria-disabled", "true");
  });

  it("作った直後だけ URL を出してコピーでき、閉じると消す", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setViews({ shareLinks: [makeShareLink()], explanation: makeExplanation() });
    useChangeRequestsStore.setState({ createdLink: { number: 1, link: makeCreatedShareLink() } });
    renderWithTheme(<ShareTab projectId="p1" cr={makeChangeRequest({ status: "explained" })} />);

    const box = screen.getByLabelText("作ったリンク");
    expect(within(box).getByText(`${window.location.origin}/share/tok123`)).toBeInTheDocument();
    await userEvent.click(within(box).getByRole("button", { name: "URL をコピー" }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/share/tok123`);
    expect(await within(box).findByText("コピーしました")).toBeInTheDocument();
    await userEvent.click(within(box).getByRole("button", { name: "閉じる" }));
    expect(store().dismissCreatedLink).toHaveBeenCalled();
  });

  it("ほかの CR で作ったリンクの URL は出さない", () => {
    setViews({ shareLinks: [], explanation: makeExplanation() });
    useChangeRequestsStore.setState({ createdLink: { number: 2, link: makeCreatedShareLink() } });
    renderWithTheme(<ShareTab projectId="p1" cr={makeChangeRequest()} />);

    expect(screen.queryByLabelText("作ったリンク")).toBeNull();
  });

  it("一覧に状態・期限・最後に見られた日時を出し、取り消していないリンクだけを延ばす・取り消す", async () => {
    setViews({
      shareLinks: [
        makeShareLink({ last_viewed_at: "2026-10-25T00:12:00Z" }),
        makeShareLink({ id: "l0", state: "revoked", state_label: "取り消し", revoked_at: "2026-10-24T02:00:00Z" }),
      ],
      explanation: makeExplanation(),
    });
    renderWithTheme(<ShareTab projectId="p1" cr={makeChangeRequest({ status: "agreed", allowed_actions: [] })} />);

    expect(screen.getByText("リンクを作れるのは、下書きと説明済みの CR だけです。")).toBeInTheDocument();
    const rows = within(screen.getByRole("table", { name: "共有リンクの一覧" })).getAllByRole("row");
    expect(within(rows[1]).getByText("開いている")).toBeInTheDocument();
    expect(within(rows[2]).queryByRole("button")).toBeNull();

    await userEvent.click(within(rows[1]).getByRole("button", { name: "期限を延ばす" }));
    await userEvent.click(await screen.findByLabelText("延ばす"));
    expect(store().extendShare).toHaveBeenCalledWith("p1", 1, "l1", 14);

    await userEvent.click(within(rows[1]).getByRole("button", { name: "取り消す" }));
    await userEvent.click(await screen.findByLabelText("取り消す"));
    expect(store().revokeShare).toHaveBeenCalledWith("p1", 1, "l1");
  });

  // Phase-116-4:追記
  it("作ったリンクの説明書の規模の束が古ければ、作った知らせの中で知らせる", () => {
    setViews({ shareLinks: [makeShareLink()], explanation: makeExplanation() });
    useChangeRequestsStore.setState({
      createdLink: {
        number: 1,
        link: makeCreatedShareLink({ baseline_freshness: makeFreshness({ baseline_number: 1, fresh: false, outdated_stages: [5] }) }),
      },
    });
    renderWithTheme(<ShareTab projectId="p1" cr={makeChangeRequest({ status: "explained" })} />);

    const box = screen.getByLabelText("作ったリンク");
    expect(within(box).getByLabelText("B-1 が古いことの知らせ")).toHaveTextContent("クライアントに見せる説明書の規模");
  });
});
