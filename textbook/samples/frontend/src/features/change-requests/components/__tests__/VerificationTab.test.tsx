// 作成：Phase-87-4｜更新：Phase-98-2
// SUT: VerificationTab(印の今の状態・文書の側の確認・レビューを結ぶ・検証済みにする)
// ドライバ: Testing Library(描画・クリック)
// スタブ: ストアの関数(vi.fn)── タブを開いたときの読み込みと、操作で渡す引数・ボタンの出し分けだけを見るため
import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerificationTab } from "../VerificationTab";
import { useChangeRequestsStore } from "../../change-requests-store";
import { makeChangeRequest, makeVerification } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";

const store = () => useChangeRequestsStore.getState();
const RUN = {
  review_run_id: "r1",
  gate: "stage6",
  model: "claude-sonnet",
  status: "succeeded",
  started_at: "2026-10-19T05:00:00Z",
  finished_at: "2026-10-19T05:03:00Z",
  findings: 3,
  adopted: 1,
};

describe("VerificationTab", () => {
  beforeEach(() => {
    resetChangeRequestsStore();
  });

  it("反映済みは検証とレビューの候補を読む。検証済みは候補を読まない", () => {
    renderWithTheme(<VerificationTab projectId="p1" cr={makeChangeRequest({ status: "applied" })} />);
    expect(store().fetchView).toHaveBeenCalledWith("p1", 1, "verification");
    expect(store().fetchView).toHaveBeenCalledWith("p1", 1, "candidates");
  });

  it("印の3つの状態を段階へのリンクと一緒に出し、未確認があれば検証済みにできない", () => {
    useChangeRequestsStore.setState({ views: { ...store().views, verification: makeVerification(), candidates: [] } });

    renderWithTheme(<VerificationTab projectId="p1" cr={makeChangeRequest({ status: "applied" })} />);

    expect(screen.getByText("未確認: 段階の印 1 件・文書の側 1 件")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "段階1 機能一覧" })).toHaveAttribute(
      "href",
      "/projects/p1/detailed-design?stage=1",
    );
    expect(screen.getByText("未確認")).toBeInTheDocument();
    expect(screen.getByText("承認で済んだ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "検証済みにする" })).toHaveAttribute("aria-disabled", "true");
  });

  // Phase-98-2:追記
  it("作り直した後に未承認の段階を、段階へのリンクと一緒に出す", () => {
    useChangeRequestsStore.setState({
      views: { ...store().views, verification: makeVerification({ pending_stages: [2, 5] }), candidates: [] },
    });

    renderWithTheme(<VerificationTab projectId="p1" cr={makeChangeRequest({ status: "applied" })} />);

    const section = screen.getByLabelText("未承認の段階");
    expect(section).toHaveTextContent("すべて承認するまで検証済みにできません");
    expect(screen.getAllByRole("link", { name: /を承認する →$/ }).map((a) => a.getAttribute("href"))).toEqual([
      "/projects/p1/detailed-design?stage=2",
      "/projects/p1/detailed-design?stage=5",
    ]);
  });

  it("未承認の段階が無ければ、その節を出さない", () => {
    useChangeRequestsStore.setState({ views: { ...store().views, verification: makeVerification(), candidates: [] } });

    renderWithTheme(<VerificationTab projectId="p1" cr={makeChangeRequest({ status: "applied" })} />);

    expect(screen.queryByLabelText("未承認の段階")).not.toBeInTheDocument();
  });

  it("文書の側の項目を確認済みにする", async () => {
    useChangeRequestsStore.setState({ views: { ...store().views, verification: makeVerification(), candidates: [] } });
    renderWithTheme(<VerificationTab projectId="p1" cr={makeChangeRequest({ status: "applied" })} />);

    await userEvent.click(screen.getByRole("checkbox", { name: /SCR-004/ }));

    expect(store().checkDocuments).toHaveBeenCalledWith("p1", 1, ["SCR-004"], true);
  });

  it("候補のレビューを選んで結び、未確認が0件なら確かめて検証済みにする", async () => {
    useChangeRequestsStore.setState({
      views: {
        ...store().views,
        verification: makeVerification({ can_verify: true, open_marks: 0, open_documents: 0 }),
        candidates: [RUN],
      },
    });
    renderWithTheme(<VerificationTab projectId="p1" cr={makeChangeRequest({ status: "applied" })} />);

    await userEvent.click(screen.getByRole("button", { name: "結ぶ" }));
    expect(store().linkReview).toHaveBeenCalledWith("p1", 1, "r1");

    await userEvent.click(screen.getByRole("button", { name: "検証済みにする" }));
    await userEvent.type(await screen.findByLabelText("メモ(任意)"), "確かめた");
    await userEvent.click(screen.getByLabelText("検証を記録する"));
    expect(store().verify).toHaveBeenCalledWith("p1", 1, "確かめた");
  });

  it("検証済みは結んだレビューを出し、確認の項目は変えられない", () => {
    useChangeRequestsStore.setState({
      views: { ...store().views, verification: makeVerification({ status: "verified", can_verify: false }) },
    });
    const cr = makeChangeRequest({
      status: "verified",
      reviews: [{ ...RUN, linked_at: "2026-10-19T06:00:00Z", linked_by: "u1" }],
    });

    renderWithTheme(<VerificationTab projectId="p1" cr={cr} />);

    expect(screen.getByText("検証済みです。")).toBeInTheDocument();
    expect(screen.getByText(/claude-sonnet.*指摘 3・採用 1/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /SCR-004/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "検証済みにする" })).not.toBeInTheDocument();
  });
});
