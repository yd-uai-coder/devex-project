// 作成：Phase-107-3｜更新：Phase-110(完了後の調整)
// SUT: OptionDraftReview(選択肢の LLM の下書きの確かめと取り込み)
// ドライバ: Testing Library(描画・クリック)
// スタブ: ストアの関数(vi.fn)── 下書きの読み込み・作る・取り込むの呼び出しと、照合の結果の出し分けだけを見るため
import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OptionDraftReview } from "../OptionDraftReview";
import { useChangeRequestsStore } from "../../change-requests-store";
import { makeChangeRequest, makeOptionDraft } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";

const store = () => useChangeRequestsStore.getState();
const withDraft = (draft: ReturnType<typeof makeOptionDraft> | null) =>
  useChangeRequestsStore.setState({ views: { ...store().views, optionDraft: { draft } } });

describe("OptionDraftReview", () => {
  beforeEach(() => {
    resetChangeRequestsStore();
  });

  it("開くと下書きを読む", () => {
    renderWithTheme(<OptionDraftReview projectId="p1" cr={makeChangeRequest()} />);
    expect(store().fetchView).toHaveBeenCalledWith("p1", 1, "optionDraft");
  });

  it("下書きが無いことを出し、作ると LLM の下書きを頼む", async () => {
    withDraft(null);
    renderWithTheme(<OptionDraftReview projectId="p1" cr={makeChangeRequest()} />);

    expect(screen.getByText("下書きはありません。")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "LLM で下書きを作る" }));
    expect(store().draftOptions).toHaveBeenCalledWith("p1", 1);
  });

  it("取り込める下書きは、確かめてから取り込む。説明書に無い数字は知らせるだけ", async () => {
    withDraft(makeOptionDraft({ unknown_numbers: ["2"] }));
    renderWithTheme(<OptionDraftReview projectId="p1" cr={makeChangeRequest({ status: "explained" })} />);

    expect(screen.getByText(/説明書に無い要件 ID・数字があります.*2/)).toBeInTheDocument();
    expect(screen.getByLabelText("案1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "下書きを取り込む" }));
    expect(await screen.findByText(/説明済みの CR は下書きに戻ります/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("取り込む"));
    expect(store().adoptDraft).toHaveBeenCalledWith("p1", 1);
  });

  it("取り込めない下書きは理由を出して取り込みを止め、古い下書きは作り直しを勧める", () => {
    withDraft(
      makeOptionDraft({ adoptable: false, stale: true, problems: ["案2の対象が CR の対象にありません: FR-099"] }),
    );
    renderWithTheme(<OptionDraftReview projectId="p1" cr={makeChangeRequest()} />);

    expect(screen.getByLabelText("取り込めない理由")).toHaveTextContent("FR-099");
    expect(screen.getByText(/作った後に説明書が変わりました/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下書きを取り込む" })).toHaveAttribute("aria-disabled", "true");
  });

  it("取り込み済みの下書きは取り込むボタンを出さない", () => {
    withDraft(makeOptionDraft({ status: "adopted", status_label: "取り込み済み" }));
    renderWithTheme(<OptionDraftReview projectId="p1" cr={makeChangeRequest()} />);

    expect(screen.getByText(/取り込み済み/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下書きを取り込む" })).toBeNull();
  });

  // Phase-110(完了後の調整):追記
  it("取り込み済みの下書きは、取り込みで説明書が変わっても古いと知らせない", () => {
    withDraft(makeOptionDraft({ status: "adopted", status_label: "取り込み済み", stale: true }));
    renderWithTheme(<OptionDraftReview projectId="p1" cr={makeChangeRequest()} />);

    expect(screen.queryByText(/作った後に説明書が変わりました/)).toBeNull();
  });
});
