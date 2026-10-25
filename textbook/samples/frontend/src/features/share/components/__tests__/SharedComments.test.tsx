// 作成：Phase-108-2
// SUT: SharedComments(コメントの一覧と書く欄)
// ドライバ: React Testing Library
// スタブ: ストアの comment(seedShareStore で差し替え)── 送る・送れないときの欄の振る舞いだけを見るため
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { SharedComments } from "../SharedComments";
import { makeShared } from "../../test-utils/sharedFixtures";
import { renderWithTamagui, seedShareStore } from "../../test-utils/renderShare";

const withThread = () =>
  makeShared({
    comments: [
      {
        author: "山田",
        from_developer: false,
        body: "期間は何日まで?",
        created_at: "2026-10-24T00:00:00Z",
        replies: [
          { author: "開発者", from_developer: true, body: "90日までです", created_at: "2026-10-24T02:00:00Z", replies: [] },
        ],
      },
    ],
  });

describe("SharedComments", () => {
  beforeEach(() => {
    seedShareStore(makeShared());
  });

  it("コメントと開発者の返信を出す", () => {
    renderWithTamagui(<SharedComments shared={withThread()} />);

    const thread = screen.getByLabelText("山田のコメント");
    expect(thread).toHaveTextContent("期間は何日まで?");
    expect(thread).toHaveTextContent("開発者");
    expect(thread).toHaveTextContent("90日までです");
  });

  it("開いていないリンクでは書く欄を出さない", () => {
    renderWithTamagui(<SharedComments shared={makeShared({ state: "decided", state_label: "判断済み" })} />);

    expect(screen.queryByLabelText("コメントの本文")).not.toBeInTheDocument();
  });

  it("名前が無いと送らない", () => {
    const comment = vi.fn(async () => true);
    seedShareStore(makeShared(), { comment });
    renderWithTamagui(<SharedComments shared={makeShared()} />);

    fireEvent.change(screen.getByLabelText("コメントの本文"), { target: { value: "質問" } });
    fireEvent.click(screen.getByRole("button", { name: "コメントを送る" }));

    expect(screen.getByRole("alert")).toHaveTextContent("お名前を入れて");
    expect(comment).not.toHaveBeenCalled();
  });

  it("送れたら本文を消し、送れなければ残す", async () => {
    const comment = vi.fn(async () => true);
    seedShareStore(makeShared(), { name: "山田", comment });
    const { unmount } = renderWithTamagui(<SharedComments shared={makeShared()} />);

    fireEvent.change(screen.getByLabelText("コメントの本文"), { target: { value: " 質問 " } });
    fireEvent.click(screen.getByRole("button", { name: "コメントを送る" }));

    await waitFor(() => expect(screen.getByLabelText("コメントの本文")).toHaveValue(""));
    expect(comment).toHaveBeenCalledWith("質問");
    unmount();

    seedShareStore(makeShared(), { name: "山田", comment: vi.fn(async () => false), commentError: "送れませんでした" });
    renderWithTamagui(<SharedComments shared={makeShared()} />);
    fireEvent.change(screen.getByLabelText("コメントの本文"), { target: { value: "質問" } });
    fireEvent.click(screen.getByRole("button", { name: "コメントを送る" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("送れませんでした"));
    expect(screen.getByLabelText("コメントの本文")).toHaveValue("質問");
  });
});
