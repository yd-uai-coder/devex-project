// 作成：Phase-87-3｜更新：Phase-98-2,107-1,112-2,112-4
// Phase-112-2：更新
// // SUT: ImpactTab(予測・比較・文書への反映のボタン)
// ↓↓
// Phase-112-4：更新
// // SUT: ImpactTab(予測・比較・文書への反映のボタン・反映で変わった所)
// ↓↓
// SUT: ImpactTab(予測・比較・文書への反映のボタンと競合での止め・反映で変わった所)
// ドライバ: Testing Library(描画・クリック)
// スタブ: ストアの関数(vi.fn)── タブを開いたときの読み込みと、反映のボタンの出し分けだけを見るため
// Phase-107-1:追記 ── @testing-library/react.within
// Phase-112-2:追記 ── ../../test-utils/changeRequestFixtures.makeReflection
// Phase-112-4:追記 ── ../../test-utils/changeRequestFixtures.makeConflict
import { beforeEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImpactTab } from "../ImpactTab";
import { useChangeRequestsStore } from "../../change-requests-store";
import {
  makeChangeRequest,
  makeComparison,
  makeConflict,
  makeImpact,
  makeReflection,
} from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";

const store = () => useChangeRequestsStore.getState();

describe("ImpactTab", () => {
  beforeEach(() => {
    resetChangeRequestsStore();
  });

  it("合意の前は予測だけを読み、段階ごとに出す。反映のボタンは出さない", () => {
    useChangeRequestsStore.setState({
      views: { ...store().views, impact: makeImpact({ unpredicted_new_requirement: true, excluded: [{ key: "stage:4", state: "draft" }] }) },
    });

    renderWithTheme(<ImpactTab projectId="p1" cr={makeChangeRequest({ status: "explained" })} />);

    expect(store().fetchView).not.toHaveBeenCalled();
    expect(screen.getByText(/基準の合意済みの版\(B-1\)から求めた予測/)).toBeInTheDocument();
    expect(screen.getByText("文書の側(画面・API)(1)")).toBeInTheDocument();
    expect(screen.getByText("段階1 機能一覧(1)")).toBeInTheDocument();
    expect(screen.getByText(/新しい要件を足す分は/)).toBeInTheDocument();
    expect(screen.getByText(/stage:4/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /文書へ反映する/ })).not.toBeInTheDocument();
  // Phase-98-2:追記
  });

  it("起点を使った予測は、起点と要素ごとに届いた起点を出す", () => {
    const origins = [{ key: "screen:SCR-004", label: "SCR-004 チャットヒアリング画面" }];
    const impact = makeImpact({ origins });
    impact.items = impact.items.map((item) => ({ ...item, origin_keys: item.stage === 1 ? ["screen:SCR-004"] : [] }));
    useChangeRequestsStore.setState({ views: { ...store().views, impact } });

    renderWithTheme(<ImpactTab projectId="p1" cr={makeChangeRequest({ adds_requirement: true, origins })} />);

    expect(screen.getByText("新しい要件の予測の起点: SCR-004 チャットヒアリング画面")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: "届いた起点" })).toHaveLength(2);
    // 文書の側の要素の名前(SCR-004)と、段階1の要素に届いた起点の2つ
    expect(screen.getAllByRole("cell", { name: "SCR-004 チャットヒアリング画面" })).toHaveLength(2);
  });

  it("開いたときに予測を読む", () => {
    renderWithTheme(<ImpactTab projectId="p1" cr={makeChangeRequest()} />);

    expect(store().fetchView).toHaveBeenCalledWith("p1", 1, "impact");
    expect(store().fetchView).not.toHaveBeenCalledWith("p1", 1, "comparison");
  });

  it("合意した CR は確かめてから文書へ反映する", async () => {
    useChangeRequestsStore.setState({ views: { ...store().views, impact: makeImpact({ saved: true }) } });
    renderWithTheme(<ImpactTab projectId="p1" cr={makeChangeRequest({ status: "agreed" })} />);

    expect(screen.getByText(/判断の時点で保存した予測/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "文書へ反映する(要件定義書から再生成)" }));
    await userEvent.click(await screen.findByLabelText("反映する"));

    expect(store().reflectDocuments).toHaveBeenCalledWith("p1", 1);
  });

  // Phase-112-4:追記
  it("重なる CR の競合を確かめるまでは、文書へ反映するボタンを押せず、理由を出す", () => {
    useChangeRequestsStore.setState({ views: { ...store().views, impact: makeImpact({ saved: true }) } });
    const { unmount } = renderWithTheme(
      <ImpactTab projectId="p1" cr={makeChangeRequest({ status: "agreed", conflicts: [makeConflict()] })} />,
    );

    expect(screen.getByRole("button", { name: "文書へ反映する(要件定義書から再生成)" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText(/今の文と見比べて確かめてから反映してください/)).toBeInTheDocument();

    unmount();
    renderWithTheme(
      <ImpactTab
        projectId="p1"
        cr={makeChangeRequest({ status: "agreed", conflicts: [makeConflict({ checked: true })] })}
      />,
    );
    expect(screen.queryByText(/今の文と見比べて確かめてから反映してください/)).not.toBeInTheDocument();
  });

  it("反映済みは比較も読み、予測の外 → 予測だけ → 一致の順に出す。段階へのリンクも出す", () => {
    useChangeRequestsStore.setState({
      views: { ...store().views, impact: makeImpact({ saved: true }), comparison: makeComparison() },
      reflecting: true,
    });

    renderWithTheme(<ImpactTab projectId="p1" cr={makeChangeRequest({ status: "applied" })} />);

    const titles = screen.getAllByText(/^(実際だけ|予測だけ|一致)/).map((el) => el.textContent);
    expect(titles).toEqual(["実際だけ(予測の外)(1)", "予測だけ(1)", "一致(1)"]);
    expect(screen.getByText(/文書の側\(印が付かない\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "反映中(文書を作り直しています)..." })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "詳細設計画面で段階へ反映する →" })).toBeInTheDocument();
  });

  // Phase-107-1:追記
  it("反映済みは、規模の予測と実際の数を並べる(数えられなければそう書く)", () => {
    const scale = [
      { kind: "unit" as const, label: "作業単位", predicted: 2, actual: 3, basis: "marks" as const },
      { kind: "api" as const, label: "API", predicted: null, actual: null, basis: "document_checks" as const },
    ];
    useChangeRequestsStore.setState({
      views: { ...store().views, impact: makeImpact({ saved: true }), comparison: makeComparison({ scale }) },
    });
    renderWithTheme(<ImpactTab projectId="p1" cr={makeChangeRequest({ status: "applied" })} />);

    const table = screen.getByRole("table", { name: "規模の予測と実際" });
    const unit = within(table).getByRole("row", { name: /作業単位/ });
    expect(within(unit).getByText("2件")).toBeInTheDocument();
    expect(within(unit).getByText("3件")).toBeInTheDocument();
    expect(within(within(table).getByRole("row", { name: /API/ })).getAllByText("数えられない")).toHaveLength(2);
  });

  it("比較の読み込みの失敗を出す", () => {
    useChangeRequestsStore.setState({ viewErrors: { comparison: "反映の前です" } });

    renderWithTheme(<ImpactTab projectId="p1" cr={makeChangeRequest({ status: "verified" })} />);

    expect(screen.getByText("反映の前です")).toBeInTheDocument();
  });

  // Phase-112-2:追記
  it("反映の後は、反映で変わった所を比較の上に出し、確認事項から来た要素を目立たせる", () => {
    useChangeRequestsStore.setState({
      views: {
        ...store().views,
        impact: makeImpact({ saved: true }),
        comparison: makeComparison({ reflections: [makeReflection()] }),
      },
    });

    renderWithTheme(
      <ImpactTab projectId="p1" cr={makeChangeRequest({ status: "applied" })} focusKey="req:FR-005" />,
    );

    const section = screen.getByLabelText("反映で変わった所");
    expect(within(section).getByText("CR の対象(1)")).toBeInTheDocument();
    expect(section.compareDocumentPosition(screen.getByLabelText("予測と実際の比較"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(document.querySelectorAll('tr[data-focused="true"]')).toHaveLength(1);
  });
});
