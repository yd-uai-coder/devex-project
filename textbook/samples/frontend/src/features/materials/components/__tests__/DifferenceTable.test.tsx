// 作成：Phase-116-3｜更新：Phase-116-4
// SUT: DifferenceTable(違いの一覧・選んで CR の下書き・捨てる / 戻す)と、その中の DismissForm
// ドライバ: Testing Library(描画・チェック・クリック・入力)
// スタブ: 資料のストアの捨てる・戻す・CR の下書きの関数(vi.fn)と next/navigation の router ── 群の並び・
// 選べる違い・候補の要件の外し方から作る本文・作った後の移動の配線だけを見るため
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DifferenceTable } from "../DifferenceTable";
import { DismissForm } from "../DismissForm";
import { useMaterialsStore } from "../../materials-store";
import { makeDifference, makeDifferences } from "../../test-utils/materialFixtures";
import { resetMaterialsStore } from "../../test-utils/resetMaterialsStore";
import { renderWithTheme } from "@/features/change-requests/test-utils/renderWithStore";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const VIEW = makeDifferences({
  differences: [
    makeDifference({ id: "r", status: "rejected", content: "30位まで", reasons: ["引用が資料に無い"] }),
    makeDifference({ id: "a", kind: "add", target_key: "", origin_key: "screen:SCR-001", content: "要約を出す" }),
    makeDifference({
      id: "s",
      target_key: "screen:SCR-001",
      content: "検索結果を開く",
      requirement_candidates: ["FR-003", "FR-004"],
    }),
    makeDifference({ id: "q", kind: "question", target_key: "", content: "メール通知" }),
    makeDifference({ id: "c", status: "converted", change_request_number: 7, content: "API を用意" }),
    makeDifference({ id: "x", status: "dismissed", dismiss_reason: "12時間のまま", content: "6時間ごと" }),
  ],
});

describe("DifferenceTable", () => {
  beforeEach(() => {
    push.mockReset();
    resetMaterialsStore();
  });

  it("状態で群に分け、未確認を上に。CR にした違いは CR へのリンク、捨てた理由・弾いた理由を出す", () => {
    renderWithTheme(<DifferenceTable projectId="p1" materialId="m1" view={VIEW} />);

    const tables = screen.getAllByRole("table").map((t) => t.getAttribute("aria-label"));
    expect(tables).toEqual(["違い(未確認)", "違い(CR にした)", "違い(捨てた)", "違い(弾いた)"]);
    const open = screen.getByRole("table", { name: "違い(未確認)" });
    expect(within(open).getAllByRole("row")).toHaveLength(4);
    // 確かめる点は選べない
    expect(within(open).queryByRole("checkbox", { name: "「メール通知」を選ぶ" })).not.toBeInTheDocument();
    expect(within(open).getAllByText("SCR-001", { selector: "span" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "CR-7 にした" })).toHaveAttribute("href", "/projects/p1/change-requests/7");
    expect(screen.getByText("捨てた: 12時間のまま")).toBeInTheDocument();
    expect(screen.getByText("弾いた(検査): 引用が資料に無い")).toBeInTheDocument();
  });

  it("選んだ違いから CR の下書きを作る。候補を外すと残りの要件だけ送り、全部外すと作れない。作ったら CR へ移る", async () => {
    const createChangeRequest = vi.fn().mockResolvedValue({ number: 8 });
    useMaterialsStore.setState({ createChangeRequest });
    const user = userEvent.setup();
    renderWithTheme(<DifferenceTable projectId="p1" materialId="m1" view={VIEW} />);

    const make = screen.getByRole("button", { name: "選んだ違いから CR の下書きを作る" });
    expect(make).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("checkbox", { name: "「要約を出す」を選ぶ" }));
    await user.click(screen.getByRole("checkbox", { name: "「検索結果を開く」を選ぶ" }));
    const candidates = screen.getByLabelText("SCR-001 の対象の要件");
    await user.click(within(candidates).getByRole("checkbox", { name: "FR-003" }));
    await user.click(within(candidates).getByRole("checkbox", { name: "FR-004" }));
    expect(screen.getByText("SCR-001 の対象にする要件を1つ以上選んでください。")).toBeInTheDocument();
    expect(make).toHaveAttribute("aria-disabled", "true");

    await user.click(within(candidates).getByRole("checkbox", { name: "FR-004" }));
    expect(screen.getByText(/^2 件を選んでいます/)).toBeInTheDocument();
    await user.click(make);

    expect(createChangeRequest).toHaveBeenCalledWith("p1", "m1", { difference_ids: ["a", "s"], requirement_ids: ["FR-004"] });
    expect(push).toHaveBeenCalledWith("/projects/p1/change-requests/8");
  });

  it("取り出した後に束が作られていれば、CR の下書きを作れない", async () => {
    const user = userEvent.setup();
    renderWithTheme(<DifferenceTable projectId="p1" materialId="m1" view={{ ...VIEW, latest_baseline_number: 3 }} />);

    await user.click(screen.getByRole("checkbox", { name: "「要約を出す」を選ぶ" }));
    expect(screen.getByRole("button", { name: "選んだ違いから CR の下書きを作る" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("取り出し直してから CR にしてください。")).toBeInTheDocument();
  });

  it("確かめる点は理由をつけて閉じ、捨てた違いは戻せる", async () => {
    const dismiss = vi.fn().mockResolvedValue(true);
    useMaterialsStore.setState({ dismiss });
    const user = userEvent.setup();
    renderWithTheme(<DifferenceTable projectId="p1" materialId="m1" view={VIEW} />);

    await user.click(screen.getByRole("button", { name: "閉じる(理由)" }));
    const form = screen.getByLabelText("捨てる理由");
    expect(within(form).getByRole("button", { name: "閉じる" })).toHaveAttribute("aria-disabled", "true");
    await user.type(within(form).getByLabelText("理由"), " 次回に持ち越し ");
    await user.click(within(form).getByRole("button", { name: "閉じる" }));
    expect(dismiss).toHaveBeenCalledWith("p1", "m1", "q", "次回に持ち越し");
    expect(screen.queryByLabelText("捨てる理由")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "未確認に戻す" }));
    expect(useMaterialsStore.getState().restore).toHaveBeenCalledWith("p1", "m1", "x");
  });

  // Phase-116-4:追記
  it("CR にできる違いが残っていなければ、選んで作る操作を出さない", () => {
    renderWithTheme(
      <DifferenceTable
        projectId="p1"
        materialId="m1"
        view={makeDifferences({
          differences: [
            makeDifference({ id: "q", kind: "question" }),
            makeDifference({ id: "c", status: "converted", change_request_number: 7 }),
          ],
        })}
      />,
    );
    expect(screen.queryByRole("button", { name: "選んだ違いから CR の下書きを作る" })).toBeNull();
  });

  it("取り出して違いが無ければ、そう出す", () => {
    renderWithTheme(<DifferenceTable projectId="p1" materialId="m1" view={makeDifferences({ differences: [] })} />);
    expect(screen.getByText("合意済みの内容と違う点は見つかりませんでした。")).toBeInTheDocument();
  });

  it("DismissForm は追加・変更・削除なら「捨てる」", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderWithTheme(<DismissForm difference={makeDifference()} submitting={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText("理由"), "決まった");
    await user.click(screen.getByRole("button", { name: "捨てる" }));
    expect(onSubmit).toHaveBeenCalledWith("決まった");
  });
});
