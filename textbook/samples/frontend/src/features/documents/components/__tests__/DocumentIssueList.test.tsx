// 作成：Phase-37-3
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DocumentIssueList } from "../DocumentIssueList";

// SUT: DocumentIssueList。ドライバ: このテスト。スタブ不要 ── props だけで描く表示の部品のため。
describe("DocumentIssueList", () => {
  it("重要度の見出しを付けて指摘を並べる", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <DocumentIssueList
          label="外部設計書の指摘"
          issues={[
            { level: "major", code: "A", message: "本文の欄が空の API があります", targets: [] },
            { level: "minor", code: "B", message: "要件の無い画面があります", targets: [] },
          ]}
        />
      </TamaguiProvider>,
    );

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "【中程度】本文の欄が空の API があります",
      "【軽微】要件の無い画面があります",
    ]);
    expect(screen.getByRole("list", { name: "外部設計書の指摘" })).toBeInTheDocument();
  });

  it("指摘が無ければ何も出さない", () => {
    const { container } = render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <DocumentIssueList label="x" issues={[]} />
      </TamaguiProvider>,
    );

    expect(container.querySelector("[role=list]")).toBeNull();
  });
});
