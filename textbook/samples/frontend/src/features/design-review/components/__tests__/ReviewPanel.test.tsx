// 作成：Phase-53-4｜更新：Phase-53(完了後の調整)
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { ReviewPanel } from "../ReviewPanel";
import { useReviewStore } from "@/features/design-review/review-store";
import type { TargetActionOf } from "@/features/design-review/model";
import { finding, gate, run, user } from "../../test-utils/reviewFixtures";

// SUT: ReviewPanel(と、その中の FindingTable)/ ドライバ: render と操作 / スタブ: レビューのストアの
// fetchMe・fetchGates・setReviewEnabled・runReview・decide(API を呼ばずに、呼ばれ方を確かめる)。

function renderPanel(props: { gates?: ("documents" | "stage6" | "stage7")[]; targetAction?: TargetActionOf } = {}) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ReviewPanel projectId="p1" {...props} />
    </TamaguiProvider>,
  );
}

const DETAILED_GATES = [
  gate({
    gate: "documents",
    status: "reviewed",
    run: run({
      findings: [
        finding({ id: "f-minor", level: "minor", position: 0, problem: "軽い問題", targets: ["観点 規模"] }),
        finding({
          id: "f-critical",
          level: "critical",
          position: 1,
          cause: "hearing",
          point_key: "security",
          problem: "アクセス制御が無い",
          targets: ["FR-001"],
        }),
      ],
    }),
  }),
  gate({ gate: "stage6", status: "unreviewed" }),
  gate({ gate: "stage7", ready: false, status: "not_ready" }),
];

describe("ReviewPanel", () => {
  beforeEach(() => {
    useReviewStore.setState({
      projectId: "p1",
      me: user(),
      gates: DETAILED_GATES,
      status: "success",
      error: null,
      fetchedAt: Date.now(),
      savingSetting: false,
      requesting: null,
      decidingId: null,
      actionError: null,
      fetchMe: vi.fn().mockResolvedValue(undefined),
      fetchGates: vi.fn().mockResolvedValue(undefined),
      setReviewEnabled: vi.fn().mockResolvedValue(undefined),
      runReview: vi.fn().mockResolvedValue(true),
      decide: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("superuser でなければ何も出さない", () => {
    useReviewStore.setState({ me: user({ is_superuser: false, review_enabled: false, review_effective: false }) });
    renderPanel();

    expect(useReviewStore.getState().fetchMe).toHaveBeenCalled();
    expect(screen.queryByLabelText("AI 設計レビュー")).not.toBeInTheDocument();
    expect(screen.queryByText("AI 設計レビューを使う")).not.toBeInTheDocument();
  });

  it("オフなら切り替えだけを出し、オンにすると設定を変える", async () => {
    useReviewStore.setState({ me: user({ review_enabled: false, review_effective: false }) });
    const u = userEvent.setup();
    renderPanel();

    expect(screen.getByText("オフ(生成の後は、今の自己診断をチャットに出します)")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "レビューの区切り" })).not.toBeInTheDocument();
    expect(useReviewStore.getState().fetchGates).not.toHaveBeenCalled();
    await u.click(screen.getByLabelText("AI 設計レビューを使う"));
    expect(useReviewStore.getState().setReviewEnabled).toHaveBeenCalledWith(true);
  });

  it("区切りの状態と、押せる操作を出す", async () => {
    const u = userEvent.setup();
    renderPanel();

    expect(useReviewStore.getState().fetchGates).toHaveBeenCalledWith("p1");
    const table = screen.getByRole("table", { name: "レビューの区切り" });
    expect(within(table).getByText("レビュー済み")).toBeInTheDocument();
    expect(within(table).getByText("未レビュー")).toBeInTheDocument();
    expect(within(table).getByText("文書がまだ無い")).toBeInTheDocument();
    expect(within(table).getByText("要件定義書・外部設計書")).toBeInTheDocument();
    expect(within(table).queryByRole("button", { name: "段階7の承認の後をレビューする" })).not.toBeInTheDocument();
    await u.click(within(table).getByRole("button", { name: "段階6の承認の後をレビューする" }));
    expect(useReviewStore.getState().runReview).toHaveBeenCalledWith("p1", "stage6");
  });

  it("指摘を重要度の順に出し、採否を付ける(押し直すと未判断)", async () => {
    useReviewStore.setState({
      gates: [
        gate({
          status: "reviewed",
          run: run({
            findings: [
              finding({ id: "f-minor", level: "minor", position: 0, problem: "軽い問題" }),
              finding({ id: "f-critical", level: "critical", position: 1, problem: "重い問題", decision: "adopted" }),
            ],
          }),
        }),
      ],
    });
    const u = userEvent.setup();
    renderPanel();

    // Phase-53(完了後の調整):追記
    // 指摘の表は初めは閉じていて、件数と採否の件数だけを出す
    expect(screen.queryByRole("table", { name: "指摘の一覧" })).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "文書の生成の後の指摘を開く" }));
    const rows = within(screen.getByRole("table", { name: "指摘の一覧" })).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("最重要");
    expect(rows[2]).toHaveTextContent("軽微");
    expect(screen.getByText("採用 1 ・ 却下 0 ・ 保留 0 ・ 未判断 1")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "指摘2を保留" }));
    expect(useReviewStore.getState().decide).toHaveBeenCalledWith("p1", "f-minor", "held");
    await u.click(screen.getByRole("button", { name: "指摘1を採用" }));
    expect(useReviewStore.getState().decide).toHaveBeenCalledWith("p1", "f-critical", "pending");
  });

  it("対象は飛べるものだけ押せる。観点のキーと、古い版のレビューを出す", async () => {
    useReviewStore.setState({ gates: [{ ...DETAILED_GATES[0], run: { ...DETAILED_GATES[0].run!, is_current: false } }] });
    const onPress = vi.fn();
    const targetAction: TargetActionOf = (target) => (target === "FR-001" ? { label: "開く", onPress } : null);
    const u = userEvent.setup();
    renderPanel({ gates: ["documents"], targetAction });
    // Phase-53(完了後の調整):追記
    await u.click(screen.getByRole("button", { name: "文書の生成の後の指摘を開く" }));

    await u.click(screen.getByRole("button", { name: "FR-001" }));
    expect(onPress).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "観点 規模" })).not.toBeInTheDocument();
    expect(screen.getByText("観点 規模")).toBeInTheDocument();
    expect(screen.getByText(/観点 security/)).toBeInTheDocument();
    expect(screen.getByText(/文書・段階が変わる前のレビューです/)).toBeInTheDocument();
    // 区切りを絞ると、ほかの区切りは出さない
    expect(screen.queryByText("段階6の承認の後")).not.toBeInTheDocument();
  });

  it("操作の失敗を出す", () => {
    useReviewStore.setState({ actionError: "上限に達しました" });
    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent("上限に達しました");
  });

  // Phase-53(完了後の調整):追記
  it("指摘ごとに関連する文書を凡例の文字で出し、文書の無い古い指摘は対象から推定する", async () => {
    useReviewStore.setState({
      gates: [
        gate({
          status: "reviewed",
          run: run({
            findings: [
              finding({ id: "f1", position: 0, documents: ["internal_design", "external_design"] }),
              finding({ id: "f2", position: 1, documents: null, targets: ["FR-001", "SCR-002"] }),
            ],
          }),
        }),
        gate({ gate: "stage6", status: "reviewed", run: run({ id: "r6", gate: "stage6", findings: [finding({ id: "f6", documents: ["detailed_design"] })] }) }),
      ],
    });
    const u = userEvent.setup();
    renderPanel();

    await u.click(screen.getByRole("button", { name: "文書の生成の後の指摘を開く" }));
    expect(screen.getByLabelText("文書の凡例")).toHaveTextContent("A 要件定義 B 外部設計 C 内部設計 D 実装計画");
    const rows = within(screen.getByRole("table", { name: "指摘の一覧" })).getAllByRole("row");
    expect(within(rows[1]).getByText("B・C")).toBeInTheDocument();
    expect(within(rows[2]).getByTitle("対象の書き方から推定")).toHaveTextContent("A・B");
    await u.click(screen.getByRole("button", { name: "文書の生成の後の指摘を閉じる" }));
    expect(screen.queryByLabelText("文書の凡例")).not.toBeInTheDocument();

    // 段階の区切りでは C が詳細設計
    await u.click(screen.getByRole("button", { name: "段階6の承認の後の指摘を開く" }));
    expect(screen.getByLabelText("文書の凡例")).toHaveTextContent("C 詳細設計 D 実装計画(詳細)");
  });
});
