// 作成：Phase-116-4
// SUT: BaselineFreshnessNotice(束が古いときの知らせ)
// ドライバ: Testing Library(描画)
// スタブ不要 ── 鮮度の応答を受け取って描くだけで、ストアも API も呼ばないため
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { BaselineFreshnessNotice } from "../BaselineFreshnessNotice";
import { renderWithTheme } from "@/features/change-requests/test-utils/renderWithStore";
import { makeFreshness } from "@/features/materials/test-utils/materialFixtures";

describe("BaselineFreshnessNotice", () => {
  it("新しい束・鮮度が無いときは何も出さない", () => {
    const { container } = renderWithTheme(
      <>
        <BaselineFreshnessNotice projectId="p1" freshness={makeFreshness()} />
        <BaselineFreshnessNotice projectId="p1" freshness={null} />
      </>,
    );
    expect(container.textContent).toBe("");
  });

  it("束の後の CR(書き換えた要素)と古い段階を出し、段階を最新にして作り直すよう案内する", () => {
    renderWithTheme(
      <BaselineFreshnessNotice
        projectId="p1"
        lead="規模は B-6 の設計から数えています。"
        freshness={makeFreshness({
          baseline_number: 6,
          fresh: false,
          applied_after: [{ number: 6, keys: ["req:FR-001", "screen:SCR-001"] }],
          outdated_stages: [5, 7],
        })}
      />,
    );

    expect(screen.getByText("合意済みの版 B-6 は、今の合意と食い違っているかもしれません")).toBeInTheDocument();
    expect(screen.getByText("規模は B-6 の設計から数えています。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CR-6" })).toHaveAttribute("href", "/projects/p1/change-requests/6");
    expect(screen.getByText(/FR-001・SCR-001 を書き換え/)).toBeInTheDocument();
    expect(screen.getByText(/段階5・段階7 が承認のままではありませんでした/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "合意済みの版を作り直す →" })).toHaveAttribute("href", "/projects/p1/baselines?create=1");
    expect(screen.getByRole("link", { name: "詳細設計で段階を見る →" })).toHaveAttribute("href", "/projects/p1/detailed-design");
  });

  it("後の束があるだけなら、作り直さずに最新の束へ案内する", () => {
    renderWithTheme(
      <BaselineFreshnessNotice
        projectId="p1"
        freshness={makeFreshness({ baseline_number: 2, fresh: false, is_latest: false, newer_numbers: [3, 4] })}
      />,
    );

    expect(screen.getByText(/B-2 の後に B-3・B-4 を作りました/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "最新の B-4 を見る →" })).toHaveAttribute("href", "/projects/p1/baselines/4");
    expect(screen.queryByRole("link", { name: "合意済みの版を作り直す →" })).toBeNull();
  });
});
