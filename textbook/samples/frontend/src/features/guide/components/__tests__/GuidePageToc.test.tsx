// 作成：Phase-118(完了後の調整3)
import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderGuide } from "../../test-utils/renderGuide";
import { GuidePageLayout } from "../GuidePageLayout";
import { collectTocItems, currentTocId } from "../GuidePageToc";

describe("collectTocItems", () => {
  it("節の見出し(h2)と手順のまとまり(data-toc-title)を、文書の順に集める", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <h2 id="a">使う場面</h2>
      <h2>id の無い見出しは入れない</h2>
      <section><h2 id="b">手順</h2><div id="b-1" data-toc-title="登録する"><h3>登録する</h3></div></section>
      <div id="c">id だけのものは入れない</div>`;

    expect(collectTocItems(root)).toEqual([
      { id: "a", title: "使う場面", level: 2 },
      { id: "b", title: "手順", level: 2 },
      { id: "b-1", title: "登録する", level: 3 },
    ]);
  });
});

describe("currentTocId", () => {
  const items = [
    { id: "a", title: "A", level: 2 as const },
    { id: "b", title: "B", level: 2 as const },
    { id: "c", title: "C", level: 2 as const },
  ];

  it("ヘッダーの下の位置を越えた最後の見出しを、今見ている節にする", () => {
    expect(currentTocId(items, { a: -500, b: 40, c: 600 }, 96)).toBe("b");
  });

  it("まだどれも越えていなければ最初の見出し、項目が無ければ null", () => {
    expect(currentTocId(items, { a: 300, b: 700, c: 900 }, 96)).toBe("a");
    expect(currentTocId([], {}, 96)).toBeNull();
  });
});

describe("GuidePageToc(ページの中で)", () => {
  it("本文の節と手順のまとまりを、このページの目次のリンクにする", () => {
    renderGuide(
      <GuidePageLayout
        slug="hearing"
        intro="説明"
        scenes={["場面"]}
        prerequisites={[]}
        procedures={[{ id: "answer", title: "質問に答える", steps: ["書く"] }]}
        screens={[]}
        tips={["コツ"]}
      />,
    );

    const toc = screen.getByRole("navigation", { name: "このページの目次" });
    const links = within(toc).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["使う場面", "手順", "質問に答える", "うまく使うコツ・注意", "次に読む"]);
    expect(within(toc).getByRole("link", { name: "質問に答える" })).toHaveAttribute("href", "#answer");
    // 今見ている節は1つだけ強調する(jsdom では位置がすべて 0 なので、どれかは決めない)
    expect(links.filter((link) => link.getAttribute("aria-current") === "location")).toHaveLength(1);
  });
});
