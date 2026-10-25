// 作成：Phase-107-1
// SUT: ScaleTable(変更の規模の表と、理由・注記)
// ドライバ: Testing Library(描画)
// スタブ不要 ── 説明書の応答を受け取って描くだけで、ストアも API も呼ばないため
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { ScaleTable } from "../ScaleTable";
import { makeExplanation, makeScale } from "../../test-utils/changeRequestFixtures";
import { renderWithTheme } from "../../test-utils/renderWithStore";

describe("ScaleTable", () => {
  it("案の無い CR は1列と内訳。数えられない種類は理由を表の下に出す", () => {
    renderWithTheme(<ScaleTable explanation={makeExplanation()} />);

    const table = screen.getByRole("table", { name: "変更の規模" });
    expect(within(table).getByRole("columnheader", { name: "内訳" })).toBeInTheDocument();
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
    const unitRow = within(table).getByRole("row", { name: /作業単位/ });
    expect(within(unitRow).getByText("4件")).toBeInTheDocument();
    expect(within(unitRow).getByText("3件")).toBeInTheDocument();
  });
});
