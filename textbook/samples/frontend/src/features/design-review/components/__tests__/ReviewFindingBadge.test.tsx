// 作成：Phase-53(完了後の調整)｜更新：Phase-54-1
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ReviewFindingBadge } from "../ReviewFindingBadge";
import { useReviewStore } from "@/features/design-review/review-store";
import type { StageReviewItem } from "@/features/detailed-design/reviewMarks";
import { finding } from "../../test-utils/reviewFixtures";

// SUT: ReviewFindingBadge(バッジとダイアログ)/ ドライバ: render と操作 / スタブ: レビューのストアの
// decide(採否を記録せず、呼ばれ方を確かめる)。

function renderBadge(items: StageReviewItem[], projectId: string | null = "p1") {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ReviewFindingBadge projectId={projectId} items={items} />
    </TamaguiProvider>,
  );
}

const ITEMS: StageReviewItem[] = [
  {
    finding: finding({ id: "f1", level: "critical", problem: "持ち主の確認が無い", suggestion: "持ち主を確かめる", decision: "adopted" }),
    gate: "stage6",
    isCurrent: true,
  },
  { finding: finding({ id: "f2", level: "minor", problem: "名前が揃っていない" }), gate: "stage7", isCurrent: false },
];

describe("ReviewFindingBadge", () => {
  beforeEach(() => {
    useReviewStore.setState({ decidingId: null, decide: vi.fn().mockResolvedValue(undefined) });
  });

  it("指摘が無ければ何も出さない", () => {
    renderBadge([]);
    expect(screen.queryByRole("button", { name: /AI レビューの指摘/ })).not.toBeInTheDocument();
  });

  it("件数をバッジに出し、押すと問題と根拠・改善案・判断を出す", async () => {
    const u = userEvent.setup();
    renderBadge(ITEMS);

    const badge = screen.getByRole("button", { name: "AI レビューの指摘 2件" });
    expect(badge).toHaveTextContent("AI 指摘 2");
    await u.click(badge);

    expect(await screen.findByText("持ち主の確認が無い")).toBeInTheDocument();
    expect(screen.getByText("持ち主を確かめる")).toBeInTheDocument();
    expect(screen.getAllByText("問題と根拠")).toHaveLength(2);
    expect(screen.getByText("段階6の承認の後のレビュー")).toBeInTheDocument();
    expect(screen.getByText("段階7の承認の後のレビュー(段階・文書が変わる前)")).toBeInTheDocument();
    // 採用済みの指摘は採用が押された状態
    expect(screen.getByLabelText("指摘1を採用")).toHaveAttribute("aria-pressed", "true");
  });

  it("判断を押すと採否を記録し、押し直すと未判断に戻す", async () => {
    const u = userEvent.setup();
    renderBadge(ITEMS);
    await u.click(screen.getByRole("button", { name: "AI レビューの指摘 2件" }));

    await u.click(await screen.findByLabelText("指摘2を却下"));
    expect(useReviewStore.getState().decide).toHaveBeenCalledWith("p1", "f2", "rejected");
    await u.click(screen.getByLabelText("指摘1を採用"));
    expect(useReviewStore.getState().decide).toHaveBeenCalledWith("p1", "f1", "pending");
  });

  it("指摘が無くなったら(すべて却下)ダイアログごと消える", async () => {
    const u = userEvent.setup();
    const { rerender } = renderBadge(ITEMS.slice(0, 1));
    await u.click(screen.getByRole("button", { name: "AI レビューの指摘 1件" }));
    expect(await screen.findByText("持ち主の確認が無い")).toBeInTheDocument();

    rerender(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <ReviewFindingBadge projectId="p1" items={[]} />
      </TamaguiProvider>,
    );
    await waitFor(() => expect(screen.queryByText("持ち主の確認が無い")).not.toBeInTheDocument());
  });

  // Phase-54-1:追記
  it("採用したまま直していない指摘があれば、数を添えて強調し、ダイアログに追跡を出す", async () => {
    const u = userEvent.setup();
    renderBadge([
      { ...ITEMS[0], finding: { ...ITEMS[0].finding, followup: "unaddressed" } },
      ITEMS[1],
    ]);
    const badge = screen.getByRole("button", { name: "AI レビューの指摘 2件(未対応 1件)" });
    expect(badge).toHaveTextContent("AI 指摘 2・未対応 1");
    await u.click(badge);
    expect(await screen.findByLabelText("追跡: 未対応")).toBeInTheDocument();
  });
});
