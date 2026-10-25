// 作成：Phase-107-5
// SUT: CommentThread(コメント欄と返信)
// ドライバ: Testing Library(描画・入力・クリック)
// スタブ: ストアの関数(vi.fn)── 読み込みと、返信に渡す値・返信の欄の出し分けだけを見るため
import { beforeEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentThread } from "../CommentThread";
import { useChangeRequestsStore } from "../../change-requests-store";
import { makeChangeRequest, makeComment, makeExplanation } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";

const store = () => useChangeRequestsStore.getState();

describe("CommentThread", () => {
  beforeEach(() => {
    resetChangeRequestsStore();
  });

  it("開くとコメント欄を読み、無ければそう出す", () => {
    const { unmount } = renderWithTheme(<CommentThread projectId="p1" cr={makeChangeRequest()} />);
    expect(store().fetchView).toHaveBeenCalledWith("p1", 1, "comments");
    unmount();

    useChangeRequestsStore.setState({ views: { ...store().views, comments: [] } });
    renderWithTheme(<CommentThread projectId="p1" cr={makeChangeRequest()} />);
    expect(screen.getByText(/まだコメントはありません/)).toBeInTheDocument();
  });

  it("コメントごとに返信をまとめ、前の版を見たコメントに印を付け、返信を送る", async () => {
    const reply = makeComment({
      id: "r1",
      from_developer: true,
      author_name: "",
      author_id: "u1",
      body: "3種類で考えています",
      can_reply: false,
    });
    useChangeRequestsStore.setState({
      views: {
        ...store().views,
        explanation: makeExplanation({ fingerprint: "now" }),
        comments: [makeComment({ fingerprint: "old", replies: [reply] })],
      },
    });
    renderWithTheme(<CommentThread projectId="p1" cr={makeChangeRequest()} />);

    const thread = screen.getByLabelText("佐藤のコメント");
    expect(within(thread).getByText((text) => text.startsWith("佐藤") && text.endsWith("前の版の説明書を見て書かれました"))).toBeInTheDocument();
    expect(within(thread).getByText((text) => text.startsWith("開発者"))).toBeInTheDocument();
    expect(within(thread).getByText("3種類で考えています")).toBeInTheDocument();

    await userEvent.type(within(thread).getByLabelText("佐藤のコメントへの返信"), "  案3 も足しました ");
    await userEvent.click(within(thread).getByRole("button", { name: "返信する" }));
    expect(store().reply).toHaveBeenCalledWith("p1", 1, "c1", "案3 も足しました");
  });

  it("返信できないコメントには欄を出さず、返信の失敗を出す", () => {
    useChangeRequestsStore.setState({
      views: { ...store().views, comments: [makeComment({ can_reply: false })] },
      replyError: "返信には返信できません。",
    });
    renderWithTheme(<CommentThread projectId="p1" cr={makeChangeRequest()} />);

    expect(screen.queryByLabelText("佐藤のコメントへの返信")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("返信には返信できません。");
  });
});
