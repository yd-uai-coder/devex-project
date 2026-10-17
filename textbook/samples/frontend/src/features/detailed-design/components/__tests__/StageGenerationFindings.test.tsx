// 作成：Phase-69-4
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { StageGenerationFindings } from "../StageGenerationFindings";

// SUT: StageGenerationFindings / ドライバ: このテスト / スタブ不要 ── 渡した指摘を出すだけで外部を呼ばないため。

function renderList(findings: Parameters<typeof StageGenerationFindings>[0]["findings"]) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <StageGenerationFindings findings={findings} />
    </TamaguiProvider>,
  );
}

describe("StageGenerationFindings", () => {
  it("渡した指摘を、重要度・対象・問題の順に渡した順で並べる", () => {
    renderList([
      { id: "f2", level: "minor", targets: [], problem: "一覧の並び順が無い" },
      { id: "f1", level: "critical", targets: ["F-02", "SCR-003"], problem: "予約の取消の処理が無い" },
    ]);

    const list = screen.getByLabelText("この作り直しで渡した指摘");
    const lines = Array.from(list.querySelectorAll("span")).map((el) => el.textContent);
    expect(lines).toContain("[軽微] 一覧の並び順が無い");
    expect(lines).toContain("[最重要] 対象: F-02、SCR-003 ── 予約の取消の処理が無い");
    expect(lines.indexOf("[軽微] 一覧の並び順が無い")).toBeLessThan(
      lines.indexOf("[最重要] 対象: F-02、SCR-003 ── 予約の取消の処理が無い"),
    );
  });

  it("指摘が無ければ何も出さない", () => {
    renderList([]);

    expect(screen.queryByLabelText("この作り直しで渡した指摘")).not.toBeInTheDocument();
  });
});
