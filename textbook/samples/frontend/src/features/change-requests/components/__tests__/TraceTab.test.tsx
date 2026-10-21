// 作成：Phase-87-3｜更新：Phase-98-2
// SUT: TraceTab(たどる記録の表と、行の指す先)
// ドライバ: Testing Library(描画)
// スタブ: ストアの fetchView(vi.fn)── 開いたときに読むことと、行の出し方だけを見るため
import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { TraceTab } from "../TraceTab";
import { useChangeRequestsStore } from "../../change-requests-store";
import { makeTrace } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme, resetChangeRequestsStore } from "../../test-utils/renderWithStore";

const store = () => useChangeRequestsStore.getState();

describe("TraceTab", () => {
  beforeEach(() => {
    resetChangeRequestsStore();
  });

  it("開いたときに記録を読む", () => {
    renderWithTheme(<TraceTab projectId="p1" number={1} />);

    expect(store().fetchView).toHaveBeenCalledWith("p1", 1, "trace");
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("行ごとに操作・状態の移り・指す先を出す(残っていない版・モデル・レビュー・版)", () => {
    useChangeRequestsStore.setState({ views: { ...store().views, trace: makeTrace() } });

    renderWithTheme(<TraceTab projectId="p1" number={1} />);

    expect(screen.getByText("基準: B-1 → 入れた版: B-2")).toBeInTheDocument();
    expect(screen.getByText("合意 → 反映済み")).toBeInTheDocument();
    expect(screen.getByText("要件定義書 版3")).toBeInTheDocument();
    expect(screen.getByText("外部設計書 版2(もう残っていない)")).toBeInTheDocument();
    expect(screen.getByText("モデル: gemini-2.5-flash")).toBeInTheDocument();
    expect(screen.getByText(/レビュー\(.*claude-sonnet\): 指摘 4・採用 2/)).toBeInTheDocument();
    expect(screen.getByText("合意済みの版 B-2")).toBeInTheDocument();
  });

  // Phase-98-2:追記
  it("直したの行は直した項目を、段階の承認の行は段階の版と結んだ印の数を出す", () => {
    const base = makeTrace().entries[0];
    const trace = makeTrace({
      entries: [
        { ...base, position: 1, action: "edit", action_label: "直した", edited_fields: ["タイトル", "対象"] },
        {
          ...base,
          position: 2,
          action: "approve_stage",
          action_label: "段階の承認で印を結んだ",
          stage: { stage: 3, version: 2 },
          mark_count: 4,
        },
      ],
    });
    useChangeRequestsStore.setState({ views: { ...store().views, trace } });

    renderWithTheme(<TraceTab projectId="p1" number={1} />);

    expect(screen.getByText("直した項目: タイトル・対象")).toBeInTheDocument();
    expect(screen.getByText("段階の承認で印を結んだ")).toBeInTheDocument();
    expect(screen.getByText(/段階3 .* 版2/)).toBeInTheDocument();
    expect(screen.getByText("結んだ印 4件")).toBeInTheDocument();
  });

  it("読み込みの失敗を出す", () => {
    useChangeRequestsStore.setState({ viewErrors: { trace: "失敗" } });

    renderWithTheme(<TraceTab projectId="p1" number={1} />);

    expect(screen.getByRole("alert")).toHaveTextContent("失敗");
  });
});
