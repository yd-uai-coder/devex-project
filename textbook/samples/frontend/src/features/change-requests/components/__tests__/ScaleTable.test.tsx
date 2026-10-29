// 作成：Phase-107-1｜更新：Phase-110(完了後の調整),116-4
// SUT: ScaleTable(変更の規模の表と、理由・注記)
// ドライバ: Testing Library(描画)
// スタブ不要 ── 説明書の応答を受け取って描くだけで、ストアも API も呼ばないため
// Phase-116-4:追記 ── @/features/materials/test-utils/materialFixtures.makeFreshness
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { ScaleTable } from "../ScaleTable";
import { makeExplanation, makeScale } from "../../test-utils/changeRequestFixtures";
import { makeFreshness } from "@/features/materials/test-utils/materialFixtures";
import { renderWithTheme } from "../../test-utils/renderWithStore";

describe("ScaleTable", () => {
  it("案の無い CR は1列と内訳。数えられない種類は理由を表の下に出す", () => {
    renderWithTheme(<ScaleTable explanation={makeExplanation()} />);

    const table = screen.getByRole("table", { name: "変更の規模" });
    expect(within(table).getByRole("columnheader", { name: "内訳" })).toBeInTheDocument();
    // Phase-110(完了後の調整):追記
    expect(table).toHaveStyle({ width: "100%" });
    const fileRow = within(table).getByRole("row", { name: /ファイル/ });
    expect(within(fileRow).getByText("2件")).toBeInTheDocument();
    expect(within(fileRow).getByText("app/a.py、app/b.py")).toBeInTheDocument();
    expect(within(within(table).getByRole("row", { name: /API/ })).getByText("数えられない")).toBeInTheDocument();
    expect(screen.getByText("APIは数えられない: 要る文書が束に無い(外部設計書)")).toBeInTheDocument();
  });

  it("案のある CR の合意の前は、種類 × 案の表にし、おすすめに印を付ける", () => {
    const explanation = makeExplanation({
      option_scales: [
        { number: 1, label: "案1", name: "一緒に", recommended: true, scale: makeScale({ unit: { count: 4 } }) },
        { number: 2, label: "案2", name: "先に", recommended: false, scale: makeScale({ unit: { count: 3 } }) },
      ],
    });
    renderWithTheme(<ScaleTable explanation={explanation} />);

    const table = screen.getByRole("table", { name: "変更の規模" });
    expect(within(table).getByRole("columnheader", { name: "案1 一緒に(おすすめ)" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "案2 先に" })).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "内訳" })).toBeNull();
    // Phase-110(完了後の調整):追記
    // 内訳の列が無いので、表は内容の幅(数が項目の名前から離れない)
    expect(table).toHaveStyle({ width: "auto", alignSelf: "flex-start" });
    const unitRow = within(table).getByRole("row", { name: /作業単位/ });
    expect(within(unitRow).getByText("4件")).toBeInTheDocument();
    expect(within(unitRow).getByText("3件")).toBeInTheDocument();
  });

  // Phase-116-4:追記
  it("表の上に基準の束を出し、古い段階から数えた種類は「(古い)」を添えて数えられないと分ける", () => {
    const explanation = makeExplanation({
      scale: makeScale({ unit: { count: 3, state: "stale" } }),
      baseline_freshness: makeFreshness({ baseline_number: 6, fresh: false, applied_after: [{ number: 6, keys: [] }] }),
    });
    renderWithTheme(<ScaleTable explanation={explanation} />);

    expect(screen.getByText(/合意済みの版 B-6 の設計から数えました。B-6 は古い版なので/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "変更の規模" });
    expect(within(within(table).getByRole("row", { name: /作業単位/ })).getByText("3件(古い)")).toBeInTheDocument();
    expect(within(within(table).getByRole("row", { name: /API/ })).getByText("数えられない")).toBeInTheDocument();
  });

  it("新しい束なら、どの束から数えたかだけを出す", () => {
    renderWithTheme(<ScaleTable explanation={makeExplanation({ baseline_freshness: makeFreshness({ baseline_number: 1 }) })} />);
    expect(screen.getByText("合意済みの版 B-1 の設計から数えました。")).toBeInTheDocument();
  });
});
