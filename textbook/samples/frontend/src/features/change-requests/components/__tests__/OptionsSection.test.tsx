// 作成：Phase-107-2
// SUT: OptionsSection(選択肢の節)と OptionsEditor(案の編集欄)
// ドライバ: Testing Library(描画・クリック・入力)
// スタブ: ストアの関数(vi.fn)── 案を保存したときに送る本文と、編集欄の出し分けだけを見るため
import { beforeEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OptionsSection } from "../OptionsSection";
import { useChangeRequestsStore } from "../../change-requests-store";
import { makeChangeRequest, makeOptions } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";

const store = () => useChangeRequestsStore.getState();

describe("OptionsSection", () => {
  beforeEach(() => {
    resetChangeRequestsStore();
  });

  it("案ごとに名前・おすすめ・変える要件・結果を出し、合意した案に印を付ける", () => {
    const decision = {
      counterpart: "佐藤",
      decided_at: "2026-10-19T01:00:00Z",
      memo: "",
      reason: "共有リンクで合意",
      recorded_by: null,
      option: 2,
      source: "share_link",
      source_label: "共有リンク",
      fingerprint: "f1",
    };
    renderWithTheme(
      <OptionsSection
        projectId="p1"
        cr={makeChangeRequest({ status: "agreed", allowed_actions: [], options: makeOptions(), decision })}
      />,
    );

    expect(screen.getByText("おすすめは案1です。理由: 手間が小さい")).toBeInTheDocument();
    const first = screen.getByLabelText("案1");
    expect(within(first).getByText("おすすめ")).toBeInTheDocument();
    expect(within(first).getByText("5件まで添付できる")).toBeInTheDocument();
    expect(within(screen.getByLabelText("案2")).getByText("合意した案")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "案を直す" })).toBeNull();
  });

  it("案の無い CR は、書けることを知らせる", () => {
    renderWithTheme(<OptionsSection projectId="p1" cr={makeChangeRequest()} />);

    expect(screen.getByText(/案はありません/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "案を書く" })).toBeInTheDocument();
  });

  it("案を2つ書いて保存し、規則に合わなければ送らない", async () => {
    renderWithTheme(<OptionsSection projectId="p1" cr={makeChangeRequest()} />);

    await userEvent.click(screen.getByRole("button", { name: "案を書く" }));
    await userEvent.click(screen.getByRole("button", { name: "案を2つ足す" }));
    await userEvent.click(screen.getByRole("button", { name: "案を保存する" }));
    expect(screen.getByRole("alert")).toHaveTextContent("案1に名前と結果を書いてください");
    expect(store().updateOptions).not.toHaveBeenCalled();

    for (const [i, name] of [
      [1, "5件まで"],
      [2, "上限なし"],
    ] as const) {
      const card = screen.getByLabelText(`案${i}の編集`);
      await userEvent.type(within(card).getByLabelText("名前"), name);
      await userEvent.click(within(card).getByLabelText(`案${i}で FR-005 を変える`));
      await userEvent.type(within(card).getByLabelText("結果(手間・影響・トレードオフ)"), "結果");
    }
    await userEvent.click(screen.getByRole("button", { name: "案を保存する" }));

    expect(store().updateOptions).toHaveBeenCalledWith("p1", 1, {
      items: [
        { name: "5件まで", targets: [{ requirement_id: "FR-005", kind: "content", proposed_text: "5件まで添付できる" }], outcome: "結果" },
        { name: "上限なし", targets: [{ requirement_id: "FR-005", kind: "content", proposed_text: "5件まで添付できる" }], outcome: "結果" },
      ],
      recommended: null,
      reason: "",
    });
  });

  it("説明済みの CR は、保存すると下書きに戻ることをボタンで示し、案を全部消すと空の案で送る", async () => {
    renderWithTheme(
      <OptionsSection
        projectId="p1"
        cr={makeChangeRequest({ status: "explained", allowed_actions: ["edit", "agree"], options: makeOptions() })}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "案を直す" }));
    await userEvent.click(screen.getByRole("button", { name: "案1を消す" }));
    await userEvent.click(screen.getByRole("button", { name: "案1を消す" }));
    expect(screen.queryByLabelText("おすすめの案")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "案を保存する(下書きに戻る)" }));

    expect(store().updateOptions).toHaveBeenCalledWith("p1", 1, { items: [], recommended: null, reason: "" });
  });
});
