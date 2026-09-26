// 作成：Phase-3-6
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DocumentMarkdownView } from "../DocumentMarkdownView";

const SAMPLE_DOC = {
  id: "d1",
  doc_type: "requirements" as const,
  content: "# 見出し\n本文です",
  version: 1,
  created_at: "",
};

function renderView(content: string = SAMPLE_DOC.content) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DocumentMarkdownView projectId="p1" document={{ ...SAMPLE_DOC, content }} />
    </TamaguiProvider>,
  );
}

describe("DocumentMarkdownView", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn().mockReturnValue("blob:mock");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Markdown本文をレンダリングする", () => {
    renderView();

    expect(screen.getByRole("heading", { name: "見出し" })).toBeInTheDocument();
    expect(screen.getByText("本文です")).toBeInTheDocument();
  });

  it("テーブルの<th>/<td>に罫線のインラインstyleが付与される", () => {
    // jsdomはgetComputedStyleでCSSカスタムプロパティ(var(--borderColor))を解決しないため、
    // toHaveStyle(computed style比較)ではなく、実際に設定されたinline styleの値を直接見る。
    renderView("| a | b |\n| --- | --- |\n| 1 | 2 |");

    const th = screen.getByRole("columnheader", { name: "a" }) as HTMLElement;
    const td = screen.getByRole("cell", { name: "1" }) as HTMLElement;
    expect(th.style.border).toBe("1px solid var(--borderColor)");
    expect(td.style.border).toBe("1px solid var(--borderColor)");
  });

  it("コピー成功時はボタン文言が変わり、navigator.clipboard.writeTextを呼ぶ", async () => {
    // userEvent.setup()はjsdom用のClipboard APIポリフィルを提供する(先にbeforeEach等で
    // navigator.clipboardを差し替えても、setup()の内部初期化で上書きされてしまうため、
    // setup()実行後にspyOnで捕まえる)。
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    renderView();

    await user.click(screen.getByRole("button", { name: "クリップボードにコピー" }));

    expect(await screen.findByRole("button", { name: "コピーしました" })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("# 見出し\n本文です");
  });

  it("ダウンロードボタン押下でファイルを取得し、エラーを表示しない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("content", {
          status: 200,
          headers: { "Content-Disposition": 'attachment; filename="d.md"' },
        }),
      ),
    );
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: "ダウンロード(.md)" }));

    await vi.waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ダウンロード失敗時はエラーを表示する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: "ダウンロード(.md)" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ダウンロードに失敗しました");
  });
});
