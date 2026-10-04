// 作成：Phase-17-6｜更新：Phase-18-9
// 写経レベル: 定型
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { StageIssueList } from "../StageIssueList";
import { CELL, HEAD, TABLE } from "../tableStyles";

describe("StageIssueList", () => {
  it("エラーと警告を分けて表示し、指摘が無ければ何も出さない", () => {
    const { rerender } = render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <StageIssueList
          issues={[
            { severity: "error", code: "E", message: "エラーの中身", target: null },
            { severity: "warning", code: "W", message: "警告の中身", target: "F-01" },
          ]}
        />
      </TamaguiProvider>,
    );

    expect(screen.getByText("エラー: エラーの中身")).toBeInTheDocument();
    expect(screen.getByText("警告: 警告の中身")).toBeInTheDocument();

    rerender(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <StageIssueList issues={[]} />
      </TamaguiProvider>,
    );
    expect(screen.queryByLabelText("検証の結果")).not.toBeInTheDocument();
  });

  // Phase-18-9:追記
  it("図の未承認のエラーは一覧に出さない(承認を押したときに出す。Phase 18)", () => {
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <StageIssueList
          issues={[
            { severity: "error" as const, code: "ER_NOT_APPROVED", message: "ER が承認されていません。", target: null },
            { severity: "error", code: "DFD_NOT_APPROVED", message: "DFD が承認されていません。", target: "g" },
          ]}
        />
      </TamaguiProvider>,
    );

    expect(screen.queryByLabelText("検証の結果")).not.toBeInTheDocument();
  });

  it("表の見た目は段階のパネルで共有する(見出しのセルはセルの見た目を引き継ぐ)", () => {
    expect(HEAD.padding).toBe(CELL.padding);
    expect(TABLE.borderCollapse).toBe("collapse");
  });
});
