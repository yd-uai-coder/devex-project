// 作成：Phase-11-4
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { GenerationRunHistory } from "../GenerationRunHistory";
import { useUmlStore } from "@/features/uml/uml-store";
import { makeRun } from "@/features/uml/test-utils/umlFixtures";

function renderHistory() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <GenerationRunHistory />
    </TamaguiProvider>,
  );
}

describe("GenerationRunHistory", () => {
  beforeEach(() => {
    useUmlStore.setState({ runs: [] });
  });

  it("履歴が無ければその旨を表示する", () => {
    renderHistory();

    expect(screen.getByText("まだ生成していません。")).toBeInTheDocument();
  });

  it("クォータ超過で止まった対象は、理由と再度の生成指示が必要なことを表示する", () => {
    useUmlStore.setState({
      runs: [
        makeRun({
          status: "partial",
          requested: [
            { subject: "ログイン", diagram_id: "d1" },
            { subject: "プロジェクト作成", diagram_id: "d2" },
            { subject: "一覧", diagram_id: "d3" },
          ],
          results: [
            { subject: "ログイン", diagram_id: "d1", outcome: "succeeded", reason_code: null, message: null },
            { subject: "プロジェクト作成", diagram_id: "d2", outcome: "failed", reason_code: "QUOTA_EXCEEDED", message: "quota" },
            { subject: "一覧", diagram_id: "d3", outcome: "skipped", reason_code: "QUOTA_EXCEEDED", message: null },
          ],
        }),
      ],
    });
    renderHistory();

    expect(screen.getByText((text) => text.endsWith("データフロー図(一部失敗)"))).toBeInTheDocument();
    expect(screen.getByText("ログイン: 成功")).toBeInTheDocument();
    expect(
      screen.getByText("プロジェクト作成: 失敗(AIの利用上限に達しました)。再度の生成指示が必要です"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("一覧: 未着手(AIの利用上限に達しました)。再度の生成指示が必要です"),
    ).toBeInTheDocument();
  });

  it("実行中でまだ結果の無い対象は「処理待ち」と表示する", () => {
    useUmlStore.setState({ runs: [makeRun({ status: "running", results: [], notation: "component", requested: [{ subject: "", diagram_id: "d1" }] })] });
    renderHistory();

    expect(screen.getByText("(全体): 処理待ち")).toBeInTheDocument();
  });
});
