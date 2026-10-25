// 作成：Phase-87-3｜更新：Phase-88-3,98-2,107-1,107-2,107-3
// SUT: ContentTab(内容・対象・合意の記録・重なり・写しの元と先、直すフォーム)
// ドライバ: Testing Library(描画・クリック)
// スタブ: ストアの関数(vi.fn)── 束の要件の読み込みと、直したときに送る本文だけを見るため
// Phase-107-1:追記 ── ../../test-utils/changeRequestFixtures.makeExplanation
// Phase-107-2:追記 ── ../../test-utils/changeRequestFixtures.makeOptions
import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContentTab } from "../ContentTab";
import { useChangeRequestsStore } from "../../change-requests-store";
import { makeChangeRequest, makeExplanation, makeOptions } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";

const store = () => useChangeRequestsStore.getState();

describe("ContentTab", () => {
  beforeEach(() => {
    resetChangeRequestsStore();
    useChangeRequestsStore.setState({
      requirements: { 1: [{ id: "FR-005", kind: "FR", priority: "Must", category: "", text: "3件まで添付できる" }] },
    });
  });

  it("基準の束の要件を読み、対象を合意済みの文と案の表で出す", () => {
    renderWithTheme(<ContentTab projectId="p1" cr={makeChangeRequest()} />);

    expect(store().fetchRequirements).toHaveBeenCalledWith("p1", 1);
    expect(screen.getByText("対象の要件(基準: B-1)")).toBeInTheDocument();
    expect(screen.getByText("3件まで添付できる")).toBeInTheDocument();
    expect(screen.getByText("5件まで添付できる")).toBeInTheDocument();
  // Phase-98-2:追記
  });

  // Phase-107-1:追記
  it("説明書のビューを読み、変更の規模を出す", () => {
    const { unmount } = renderWithTheme(<ContentTab projectId="p1" cr={makeChangeRequest()} />);

    expect(store().fetchView).toHaveBeenCalledWith("p1", 1, "explanation");
    // Phase-107-3：更新
    // expect(screen.getByText("読み込み中...")).toBeInTheDocument();
    // ↓↓
    expect(screen.getByRole("table", { name: "対象の要件" })).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "変更の規模" })).toBeNull();
    unmount();
    useChangeRequestsStore.setState({ views: { ...store().views, explanation: makeExplanation() } });
    renderWithTheme(<ContentTab projectId="p1" cr={makeChangeRequest()} />);
    expect(screen.getByRole("table", { name: "変更の規模" })).toBeInTheDocument();
  });

  // Phase-107-2:追記
  it("合意の記録に、選んだ案と出どころを出し、選択肢の節も出す", () => {
    const decision = {
      counterpart: "佐藤",
      decided_at: "2026-10-19T01:00:00Z",
      memo: "",
      reason: "共有リンクで合意",
      recorded_by: null,
      option: 1,
      source: "share_link",
      source_label: "共有リンク",
      fingerprint: "f1",
    };
    renderWithTheme(
      <ContentTab projectId="p1" cr={makeChangeRequest({ status: "agreed", options: makeOptions(), decision })} />,
    );

    expect(screen.getByText("選んだ案: 案1 5件まで")).toBeInTheDocument();
    expect(screen.getByText("出どころ: 共有リンク")).toBeInTheDocument();
    expect(screen.getByText("選択肢(案)")).toBeInTheDocument();
  });

  it("新しい要件を足す CR は予測の起点を出し、直すときだけ起点の候補を読む", async () => {
    const origins = [{ key: "screen:SCR-004", label: "SCR-004 チャットヒアリング画面" }];
    renderWithTheme(<ContentTab projectId="p1" cr={makeChangeRequest({ adds_requirement: true, origins })} />);

    expect(screen.getByText("予測の起点: SCR-004 チャットヒアリング画面")).toBeInTheDocument();
    expect(store().fetchOrigins).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "内容を直す" }));
    expect(store().fetchOrigins).toHaveBeenCalledWith("p1", 1);
  });

  it("起点の無い新しい要件は、予測に入らないことを出す", () => {
    renderWithTheme(<ContentTab projectId="p1" cr={makeChangeRequest({ adds_requirement: true })} />);

    expect(screen.getByText(/予測の起点を選んでいないので/)).toBeInTheDocument();
  });

  it("合意の記録・重なり・写しの元と先・入れた版を出す。直せない状態では直すボタンを出さない", () => {
    const cr = makeChangeRequest({
      status: "verified",
      allowed_actions: [],
      // Phase-107-2：更新
      // decision: { counterpart: null, decided_at: "2026-10-19T01:00:00Z", memo: "定例", reason: "合意した", recorded_by: "u1" },
      // ↓↓
      decision: { counterpart: null, decided_at: "2026-10-19T01:00:00Z", memo: "定例", reason: "合意した", recorded_by: "u1", option: null, source: null, source_label: null, fingerprint: null },
      overlapping: [{ number: 2, label: "CR-2", requirement_ids: ["FR-005"] }],
      derived_from_number: 3,
      derived_numbers: [6],
      included_baseline_number: 2,
    });

    renderWithTheme(<ContentTab projectId="p1" cr={cr} />);

    expect(screen.getByText("相手: (記録なし)")).toBeInTheDocument();
    expect(screen.getByText("理由: 合意した")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CR-2(FR-005)" })).toHaveAttribute("href", "/projects/p1/change-requests/2");
    expect(screen.getByRole("link", { name: "写しの元: CR-3" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "写しの先: CR-6" })).toBeInTheDocument();
    // Phase-88-3：更新
    // expect(screen.getByText("合意済みの版 B-2 に入れました。")).toBeInTheDocument();
    // ↓↓
    expect(screen.getByRole("link", { name: "合意済みの版 B-2 に入れました。" })).toHaveAttribute(
      "href",
      "/projects/p1/baselines/2",
    );
    expect(screen.queryByRole("button", { name: "内容を直す" })).not.toBeInTheDocument();
  });

  it("説明済みで直すと、下書きに戻ることを示して本文を送る", async () => {
    renderWithTheme(
      <ContentTab projectId="p1" cr={makeChangeRequest({ status: "explained", allowed_actions: ["edit", "agree"] })} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "内容を直す" }));
    await userEvent.clear(screen.getByLabelText("タイトル"));
    await userEvent.type(screen.getByLabelText("タイトル"), "直した");
    await userEvent.click(screen.getByRole("button", { name: "直す(下書きに戻る)" }));

    expect(store().update).toHaveBeenCalledWith(
      "p1",
      1,
      expect.objectContaining({ title: "直した", targets: [{ requirement_id: "FR-005", kind: "content", proposed_text: "5件まで添付できる" }] }),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "内容を直す" })).toBeInTheDocument());
  });
});
