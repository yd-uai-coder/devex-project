// 作成：Phase-99(完了後の調整)
// SUT: ChangeRequestVerifyDialog(詳細設計の画面で開く CR の検証のモーダル。中身は VerificationTab)
// ドライバ: Testing Library(描画・クリック)
// スタブ: ストアの関数(vi.fn)── 開いたときに詳細を読むこと、段階へのリンクで移らずに段階を選んで閉じること、
//         「閉じる」で onClose を呼ぶことだけを見るため
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangeRequestVerifyDialog } from "../ChangeRequestVerifyDialog";
import { useChangeRequestsStore } from "../../change-requests-store";
import { makeChangeRequest, makeVerification } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";

const store = () => useChangeRequestsStore.getState();

describe("ChangeRequestVerifyDialog", () => {
  beforeEach(() => {
    resetChangeRequestsStore();
  });

  it("開くと詳細を読み、検証のタブを出す。段階へのリンクはその段階を選んで閉じる", async () => {
    useChangeRequestsStore.setState({
      detail: makeChangeRequest({ number: 4, title: "TOP20 にする", status: "applied" }),
      views: { ...store().views, verification: makeVerification({ number: 4 }), candidates: [] },
    });
    const onClose = vi.fn();
    const onSelectStage = vi.fn();

    renderWithTheme(
      <ChangeRequestVerifyDialog projectId="p1" number={4} onClose={onClose} onSelectStage={onSelectStage} />,
    );

    expect(store().fetchDetail).toHaveBeenCalledWith("p1", 4);
    expect(await screen.findByText("CR-4 の検証")).toBeInTheDocument();
    expect(screen.getByText("未確認: 段階の印 1 件・文書の側 1 件")).toBeInTheDocument();
    // ダイアログの中は jsdom ではロールのクエリで「隠れている」扱いになるため、文で取る
    await userEvent.click(screen.getByText("段階1 機能一覧"));
    expect(onSelectStage).toHaveBeenCalledWith(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("「閉じる」で onClose を呼ぶ。閉じているときは何も読まない", async () => {
    const onClose = vi.fn();
    const closed = renderWithTheme(
      <ChangeRequestVerifyDialog projectId="p1" number={null} onClose={onClose} onSelectStage={vi.fn()} />,
    );
    expect(store().fetchDetail).not.toHaveBeenCalled();
    closed.unmount();

    useChangeRequestsStore.setState({ detail: makeChangeRequest({ number: 4, status: "applied" }) });
    renderWithTheme(<ChangeRequestVerifyDialog projectId="p1" number={4} onClose={onClose} onSelectStage={vi.fn()} />);
    await userEvent.click(await screen.findByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalled();
  });
});
