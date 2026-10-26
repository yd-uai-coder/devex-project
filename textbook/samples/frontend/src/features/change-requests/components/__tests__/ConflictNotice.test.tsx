// 作成：Phase-112-4
// SUT: ConflictNotice(重なる CR の競合の知らせと、確かめの印)
// ドライバ: Testing Library(描画・クリック)
// スタブ: ストアの関数(vi.fn)── 知らせの出し分けと、確かめのボタンが呼ぶ操作だけを見るため
import { beforeEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConflictNotice } from "../ConflictNotice";
import { useChangeRequestsStore } from "../../change-requests-store";
import { makeChangeRequest, makeConflict } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";

const store = () => useChangeRequestsStore.getState();

describe("ConflictNotice", () => {
  beforeEach(() => {
    resetChangeRequestsStore();
  });

  it("競合が無ければ何も出さない", () => {
    renderWithTheme(<ConflictNotice projectId="p1" cr={makeChangeRequest()} />);

    expect(screen.queryByLabelText("先にほかの CR が変えた対象の要件")).not.toBeInTheDocument();
  });

  it("要件ごとに先に変えた CR・束の文・今の文を出し、確かめると印を付ける", async () => {
    const cr = makeChangeRequest({
      status: "agreed",
      conflicts: [makeConflict(), makeConflict({ requirement_id: "FR-006", current_text: null })],
    });

    renderWithTheme(<ConflictNotice projectId="p1" cr={cr} />);

    const notice = screen.getByLabelText("先にほかの CR が変えた対象の要件");
    expect(within(notice).getByText(/文書への反映は、見比べて確かめるまでできません/)).toBeInTheDocument();
    const row = within(notice).getByText("FR-005").closest("tr") as HTMLElement;
    expect(within(row).getByText("3件まで添付できる")).toBeInTheDocument();
    expect(within(row).getByText("4件まで添付できる")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "CR-2" })).toHaveAttribute(
      "href",
      "/projects/p1/change-requests/2?tab=impact&focus=req%3AFR-005",
    );
    expect(within(notice).getByText("(消えています)")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "今の文と見比べて確かめた" }));
    expect(store().checkConflicts).toHaveBeenCalledWith("p1", 1);
  });

  it("すべて確かめ済みなら、ボタンを出さず確かめ済みと出す", () => {
    const cr = makeChangeRequest({ conflicts: [makeConflict({ checked: true })] });

    renderWithTheme(<ConflictNotice projectId="p1" cr={cr} />);

    expect(screen.getByText("確かめ済み")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "今の文と見比べて確かめた" })).not.toBeInTheDocument();
    expect(screen.queryByText(/見比べて確かめるまでできません/)).not.toBeInTheDocument();
  });
});
