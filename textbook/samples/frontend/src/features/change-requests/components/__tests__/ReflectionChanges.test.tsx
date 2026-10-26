// 作成：Phase-112-2
// SUT: ReflectionChanges(影響のタブの、反映で変わった所)
// ドライバ: Testing Library(描画)
// スタブ: スタブ不要 ── 応答を props で渡して描くだけで、ストアも API も呼ばないため
// (scrollIntoView は vitest.setup.ts のポリフィルを spy で見る)
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { ReflectionChanges } from "../ReflectionChanges";
import { makeReflection } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme } from "../../test-utils/renderWithStore";

describe("ReflectionChanges", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("反映ごとに、見出しで分けた要素の前 → 後を出す", () => {
    renderWithTheme(<ReflectionChanges reflections={[makeReflection()]} />);

    const section = screen.getByLabelText("反映で変わった所");
    expect(within(section).getByText(/の反映\(要件定義書 v3・外部設計書 v3\)/)).toBeInTheDocument();
    expect(within(section).getByText("CR の対象(1)")).toBeInTheDocument();
    expect(within(section).getByText("範囲の外(予測に無い所)(1)")).toBeInTheDocument();
    expect(within(section).getByText("合意の形に戻した(範囲の外の書き換えを戻した)(1)")).toBeInTheDocument();
    const row = screen.getByText("FR-005 資料を添付できる").closest("tr") as HTMLElement;
    expect(within(row).getByText("3件まで添付できる")).toBeInTheDocument();
    expect(within(row).getByText("5件まで添付できる")).toBeInTheDocument();
    expect(screen.getByText("LLM が書き換えたのを戻した")).toBeInTheDocument();
  });

  it("前 → 後を残す前の反映と、変わらなかった反映は一文にする。反映が無ければ何も出さない", () => {
    const { unmount } = renderWithTheme(
      <ReflectionChanges
        reflections={[makeReflection({ changes: [] }), makeReflection({ recorded: false, changes: [] })]}
      />,
    );
    expect(screen.getByText("合意の対象の要素は変わりませんでした。")).toBeInTheDocument();
    expect(screen.getByText(/前 → 後を残す前のものです/)).toBeInTheDocument();
    unmount();

    renderWithTheme(<ReflectionChanges reflections={[]} />);
    expect(screen.queryByLabelText("反映で変わった所")).not.toBeInTheDocument();
  });

  it("目立たせる要素は、それが出る最新の反映の行だけを目立たせ、そこへ移る", () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const older = makeReflection({ occurred_at: "2026-10-20T10:00:00+09:00" });

    renderWithTheme(<ReflectionChanges reflections={[makeReflection(), older]} focusKey="req:FR-005" />);

    const focused = document.querySelectorAll('tr[data-focused="true"]');
    expect(focused).toHaveLength(1);
    expect(within(focused[0] as HTMLElement).getByText("FR-005 資料を添付できる")).toBeInTheDocument();
    expect(scroll).toHaveBeenCalled();
  });
});
