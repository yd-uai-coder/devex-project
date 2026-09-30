// 作成：Phase-13-6
import { describe, expect, it } from "vitest";
import { splitByAnchors, svgDataUri } from "../anchors";

const ID_A = "11111111-1111-1111-1111-111111111111";
const ID_B = "22222222-2222-2222-2222-222222222222";

function block(id: string, version: number, body: string): string {
  return `<!-- uml:diagram:${id}:start v=${version} -->\n\n${body}\n\n<!-- uml:diagram:${id}:end -->`;
}

describe("splitByAnchors", () => {
  it("アンカーが無ければ本文1つだけを返す", () => {
    expect(splitByAnchors("# 見出し\n本文")).toEqual([{ kind: "markdown", text: "# 見出し\n本文" }]);
  });

  it("アンカーの範囲を図のセグメントにし、前後の本文と分ける", () => {
    const content = `## 3.2\n\n${block(ID_A, 3, "| 表 |")}\n\n### テーブル: users\n`;

    const segments = splitByAnchors(content);

    expect(segments).toEqual([
      { kind: "markdown", text: "## 3.2\n\n" },
      { kind: "diagram", diagramId: ID_A, version: 3, body: "| 表 |" },
      { kind: "markdown", text: "\n\n### テーブル: users\n" },
    ]);
  });

  it("続けて並んだ2つの図は、間に空の本文を挟まない", () => {
    const content = `${block(ID_A, 1, "A")}\n\n${block(ID_B, 2, "B")}`;

    expect(splitByAnchors(content).map((s) => s.kind)).toEqual(["diagram", "diagram"]);
  });

  it("終了コメントの無い開始コメントは図として扱わない", () => {
    const content = `<!-- uml:diagram:${ID_A}:start v=1 -->\n本文`;

    expect(splitByAnchors(content)).toEqual([{ kind: "markdown", text: content }]);
  });

  it("何度呼んでも同じ結果になる(正規表現の状態を持ち越さない)", () => {
    const content = block(ID_A, 1, "A");

    expect(splitByAnchors(content)).toEqual(splitByAnchors(content));
  });
});

describe("svgDataUri", () => {
  it("SVG を URL エンコードした data URI にする(日本語も通る)", () => {
    const uri = svgDataUri("<svg><text>認証</text></svg>");

    expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(uri.split(",")[1])).toBe("<svg><text>認証</text></svg>");
  });
});
