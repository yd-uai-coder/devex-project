// 作成：Phase-108-1｜更新：Phase-108-2,108-3
// Phase-108-2：更新
// // SUT: SharedChangeRequestPageContent(SharedStateNotice・SectionChanges を通る)
// ↓↓
// Phase-108-3：更新
// // SUT: SharedChangeRequestPageContent(SharedStateNotice・SectionChanges・ClientNameField を通る)
// ↓↓
// SUT: SharedChangeRequestPageContent(SharedStateNotice・SectionChanges・ClientNameField・SharedDecisionForm・
// SharedComments を通る)
// ドライバ: React Testing Library(描いて、見える文を確かめる)
// スタブ: ストアの load(seedShareStore で差し替え)── 部品の出し分けだけを見るため
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { SharedChangeRequestPageContent } from "../SharedChangeRequestPageContent";
import { makeHiddenShared, makeShared } from "../../test-utils/sharedFixtures";
import { renderWithTamagui, seedShareStore } from "../../test-utils/renderShare";

describe("SharedChangeRequestPageContent", () => {
  beforeEach(() => {
    seedShareStore(null);
  });

  it("開いているリンクは、題・状態・期限・説明書を出す", () => {
    seedShareStore(makeShared());

    renderWithTamagui(<SharedChangeRequestPageContent token="tok-1" />);

    expect(screen.getByRole("heading", { name: "CR-3 検索に絞り込みを足す" })).toBeInTheDocument();
    expect(screen.getByLabelText("状態: 開いている")).toBeInTheDocument();
    expect(screen.getByText(/このリンクの期限/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "変更の説明書" })).toHaveTextContent("期間で絞り込める");
  });

  it("直しているときは説明書を出さず、その旨を伝える", () => {
    seedShareStore(makeHiddenShared("paused"));

    renderWithTamagui(<SharedChangeRequestPageContent token="tok-1" />);

    expect(screen.getByText(/開発者がこの変更の内容を直しています/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "変更の説明書" })).not.toBeInTheDocument();
  });

  it("判断済みなら、判断の結果を出す", () => {
    seedShareStore(
      makeShared({
        state: "decided",
        state_label: "判断済み",
        decision: {
          decision: "agreed",
          decision_label: "合意済み",
          decided_at: "2026-10-25T01:00:00Z",
          counterpart: "山田",
          option: "案B 期間だけ",
          source: "share_link",
          source_label: "共有リンク",
        },
      }),
    );

    renderWithTamagui(<SharedChangeRequestPageContent token="tok-1" />);

    const result = screen.getByLabelText("判断の結果");
    expect(result).toHaveTextContent("合意済み");
    expect(result).toHaveTextContent("選んだ案: 案B 期間だけ");
    expect(result).toHaveTextContent("判断した人: 山田");
  });

  it("前回から変わった点を節ごとに出す", () => {
    seedShareStore(
      makeShared({
        changed_since: "2026-10-20T00:00:00Z",
        changes: [{ name: "選択肢", removed: ["- 案A 全部"], added: ["- 案B 期間だけ"] }],
      }),
    );

    renderWithTamagui(<SharedChangeRequestPageContent token="tok-1" />);

    const changed = screen.getByLabelText("変わった節: 選択肢");
    expect(changed).toHaveTextContent("− - 案A 全部");
    expect(changed).toHaveTextContent("+ - 案B 期間だけ");
  });

  it("リンクが使えないときは、理由だけを出す(読み直しのボタンも出さない)", () => {
    seedShareStore(null, { status: "error", unavailable: true, error: "このリンクは期限が切れました。" });

    renderWithTamagui(<SharedChangeRequestPageContent token="tok-1" />);

    expect(screen.getByRole("alert")).toHaveTextContent("期限が切れました");
    expect(screen.queryByRole("button", { name: "読み直す" })).not.toBeInTheDocument();
  });

  it("開くとトークンで読み、読み直しで読み直す", () => {
    const load = vi.fn(async () => {});
    seedShareStore(makeShared(), { load });

    renderWithTamagui(<SharedChangeRequestPageContent token="tok-1" />);
    fireEvent.click(screen.getByRole("button", { name: "読み直す" }));

    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledWith("tok-1");
  });

  // Phase-108-2:追記
  it("開いているリンクだけ、お名前の欄を出す", () => {
    seedShareStore(makeShared());
    const { unmount } = renderWithTamagui(<SharedChangeRequestPageContent token="tok-1" />);
    expect(screen.getByLabelText("お名前")).toBeInTheDocument();
    unmount();

    seedShareStore(makeShared({ state: "decided", state_label: "判断済み" }));
    renderWithTamagui(<SharedChangeRequestPageContent token="tok-1" />);
    expect(screen.queryByLabelText("お名前")).not.toBeInTheDocument();
  });

  it("説明書が新しくなったら、読み直しを促す", () => {
    const load = vi.fn(async () => {});
    seedShareStore(makeShared(), { explanationChanged: true, load });

    renderWithTamagui(<SharedChangeRequestPageContent token="tok-1" />);
    fireEvent.click(screen.getByRole("button", { name: "説明書を読み直す" }));

    expect(load).toHaveBeenCalledTimes(2);
  });

  // Phase-108-3:追記
  it("開いているリンクは 説明書 → お名前 → ご判断 → コメント の順に出す", () => {
    seedShareStore(makeShared());

    renderWithTamagui(<SharedChangeRequestPageContent token="tok-1" />);

    const order = [
      screen.getByRole("region", { name: "変更の説明書" }),
      screen.getByLabelText("お名前"),
      screen.getByLabelText("ご判断"),
      screen.getByLabelText("コメント"),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("判断が断られて判断済みになっていたら、結果の上に断られた旨を出す", () => {
    seedShareStore(makeShared({ state: "decided", state_label: "判断済み" }), {
      decisionError: "この変更は今、書き込みを受け付けていません",
    });

    renderWithTamagui(<SharedChangeRequestPageContent token="tok-1" />);

    expect(screen.getByRole("alert")).toHaveTextContent("受け付けていません");
    expect(screen.queryByLabelText("ご判断")).not.toBeInTheDocument();
  });
});
