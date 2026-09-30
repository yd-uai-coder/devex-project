// 作成：Phase-11-4
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { GenerationPanel, MAX_SUBJECTS_PER_REQUEST } from "../GenerationPanel";
import { useUmlStore } from "@/features/uml/uml-store";
import { makeCandidates, makeDiagram } from "@/features/uml/test-utils/umlFixtures";

function renderPanel() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <GenerationPanel projectId="p1" />
    </TamaguiProvider>,
  );
}

describe("GenerationPanel", () => {
  const generate = vi.fn();

  beforeEach(() => {
    generate.mockReset().mockResolvedValue(undefined);
    useUmlStore.setState({
      candidates: makeCandidates(),
      diagrams: [],
      submitting: false,
      generateError: null,
      generate,
    });
  });

  it("component と ER 全体図のボタンで対応する生成指示を出す", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "コンポーネント図を生成" }));
    await user.click(screen.getByRole("button", { name: "ER図(全体)を生成" }));

    expect(generate).toHaveBeenNthCalledWith(1, "p1", { notation: "component", subjects: [] });
    expect(generate).toHaveBeenNthCalledWith(2, "p1", {
      notation: "er",
      subjects: [{ subject: "" }],
    });
  });

  it("DFD は処理ごとの個別生成と、チェックした処理の一括生成ができる", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "ログインを生成" }));
    await user.click(screen.getByRole("checkbox", { name: "DF-1: ログイン" }));
    await user.click(screen.getByRole("checkbox", { name: "DF-2: プロジェクト作成" }));
    await user.click(screen.getByRole("button", { name: /選択した処理をまとめて生成\(2\/5\)/ }));

    expect(generate).toHaveBeenNthCalledWith(1, "p1", {
      notation: "dfd",
      subjects: [{ subject: "ログイン" }],
    });
    expect(generate).toHaveBeenNthCalledWith(2, "p1", {
      notation: "dfd",
      subjects: [{ subject: "ログイン" }, { subject: "プロジェクト作成" }],
    });
  });

  it(`一括生成は ${MAX_SUBJECTS_PER_REQUEST} 件までしか選べない`, async () => {
    const user = userEvent.setup();
    const subjects = Array.from({ length: 6 }, (_, i) => ({ code: `DF-${i + 1}`, title: `処理${i + 1}` }));
    useUmlStore.setState({ candidates: makeCandidates({ dfd_subjects: subjects }) });
    renderPanel();

    for (let i = 1; i <= 5; i++) {
      await user.click(screen.getByRole("checkbox", { name: `DF-${i}: 処理${i}` }));
    }

    expect(screen.getByRole("checkbox", { name: "DF-6: 処理6" })).toBeDisabled();
  });

  it("ER のテーブルが30件を超えると、テーブルとグループ名を選んで部分図を生成する", async () => {
    const user = userEvent.setup();
    const tables = Array.from({ length: 31 }, (_, i) => `table_${i + 1}`);
    useUmlStore.setState({ candidates: makeCandidates({ er_tables: tables }) });
    renderPanel();

    expect(screen.queryByRole("button", { name: "ER図(全体)を生成" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "table_1" }));
    await user.type(screen.getByLabelText("グループ名"), "認証");
    await user.click(screen.getByRole("button", { name: "ER部分図を生成" }));

    expect(generate).toHaveBeenCalledWith("p1", {
      notation: "er",
      subjects: [{ subject: "認証", tables: ["table_1"] }],
    });
  });

  it("DFD の候補が無ければ(旧形式の内部設計書)再生成を促す", () => {
    useUmlStore.setState({ candidates: makeCandidates({ dfd_subjects: [] }) });
    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent("内部設計書を再生成してください");
    expect(screen.getByText("ドキュメント画面で再生成する")).toBeInTheDocument();
  });

  it("内部設計書が無ければ生成ボタンを出さない", () => {
    useUmlStore.setState({ candidates: makeCandidates({ internal_design_version: null }) });
    renderPanel();

    expect(screen.getByText(/内部設計書がまだありません/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("生成中の図があるときはボタンを無効にし、受け付けエラーを表示する", () => {
    useUmlStore.setState({
      diagrams: [makeDiagram({ generation_status: "generating" })],
      generateError: "生成中の図があります",
    });
    renderPanel();

    // Tamagui の Button は disabled を aria-disabled で表す
    expect(screen.getByRole("button", { name: "コンポーネント図を生成" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("生成中の図があります")).toBeInTheDocument();
  });
});
