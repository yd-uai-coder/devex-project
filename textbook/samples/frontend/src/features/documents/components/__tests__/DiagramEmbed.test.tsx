// 作成：Phase-13-6
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DiagramEmbed, embedNotices } from "../DiagramEmbed";
import { makeEmbed } from "@/features/uml/test-utils/umlFixtures";
import type { UmlEmbedRead } from "@/features/uml/api/types";

function renderEmbed(embed: UmlEmbedRead | undefined, loaded = true) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DiagramEmbed embed={embed} loaded={loaded}>
        <p>要素表</p>
      </DiagramEmbed>
    </TamaguiProvider>,
  );
}

describe("DiagramEmbed", () => {
  it("承認済みの図は SVG を img の data URI で表示し、その下に要素表を出す", () => {
    renderEmbed(makeEmbed());

    const image = screen.getByRole("img", { name: "コンポーネント図(全体)" });
    expect(image.getAttribute("src")).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(screen.getByText("要素表")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("レビュー中の図は画像を出さず、要素表が前回承認した内容だと伝える", () => {
    renderEmbed(makeEmbed({ status: "reviewing", doc_state: "outdated", svg: null }));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("前回承認した内容です");
  });
});

describe("embedNotices", () => {
  it("取得前は「見つからない」と言わず、取得後に見つからなければ伝える", () => {
    expect(embedNotices(undefined, false)).toEqual([]);
    expect(embedNotices(undefined, true)[0]).toContain("見つかりません");
  });

  it("承認済みでも反映が古ければ再反映を、元の文書が古ければ再生成を促す", () => {
    const notices = embedNotices(makeEmbed({ doc_state: "outdated", source_outdated: true }), true);

    expect(notices).toHaveLength(2);
    expect(notices[0]).toContain("図を再反映");
    expect(notices[1]).toContain("再生成");
  });
});
