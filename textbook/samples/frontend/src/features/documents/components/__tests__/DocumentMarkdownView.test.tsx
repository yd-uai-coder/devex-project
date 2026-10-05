// 作成：Phase-3-6｜更新：Phase-6-6,13-6,24(完了後の調整)
// Phase-13-6:追記 ── @/lib/api/test-utils/fetch-stub.stubFetch, umlFixtures.makeEmbed,
//   documentsApi.DocType(SAMPLE_DOC の doc_type を internal_design に差し替えられるようにする)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DocumentMarkdownView } from "../DocumentMarkdownView";
import type { DocType } from "@/features/documents/api/documentsApi";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
// Phase-24：削除
// import { makeEmbed } from "@/features/uml/test-utils/umlFixtures";

const SAMPLE_DOC = {
  id: "d1",
  // Phase-13-6：更新(internal_design にも差し替えられるよう、型を DocType に広げた)
  // doc_type: "requirements" as const,
  // ↓↓
  doc_type: "requirements" as DocType,
  content: "# 見出し\n本文です",
  version: 1,
  created_at: "",
  is_current: true, // Phase-6-6:追記
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

  // Phase-6-6:追記 ── 復元後の表示中バージョンをダウンロードする(画面の内容とダウンロード内容が一致する)
  it("ダウンロードは表示中のドキュメントのidを指定して取得する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("content", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <DocumentMarkdownView
          projectId="p1"
          document={{ ...SAMPLE_DOC, id: "restored-v1", version: 1, is_current: true }}
        />
      </TamaguiProvider>,
    );

    await user.click(screen.getByRole("button", { name: "ダウンロード(.md)" }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toContain("/documents/restored-v1/download");
  });

  it("ダウンロード失敗時はエラーを表示する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: "ダウンロード(.md)" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ダウンロードに失敗しました");
  });

  // Phase-13-6:追記 ── 内部設計書への図の差し込み(M9a)
  // Phase-24：更新
  // it("内部設計書では、アンカーの位置に図を差し込み、要素表も描く", async () => {
  // ↓↓
  it("内部設計書も普通の Markdown として描き、設計図の埋め込みは取得しない", () => {
    // 簡易モードの設計図(ステージ3)を削除した後も、以前に図を反映した内部設計書には
    // アンカー(HTML コメント)が残る。skipHtml で生の HTML を描かないので、本文だけが出る
    const stub = stubFetch();
    // Phase-24：削除
    // stub.queue({ body: [makeEmbed()] });
    const content = [
      // Phase-24：削除
      // "## 3.3 バックエンド処理",
      // "",
      "<!-- uml:diagram:d1:start v=2 -->",
      "",
      "| 名称 | 種別 |",
      "|---|---|",
      "| 認証API | モジュール |",
      "",
      "<!-- uml:diagram:d1:end -->",
      // Phase-24：削除
      // "",
      // "- 主要処理ロジック",
    ].join("\n");
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <DocumentMarkdownView
          projectId="p1"
          document={{ ...SAMPLE_DOC, doc_type: "internal_design", content }}
        />
      </TamaguiProvider>,
    );

    // Phase-24：削除
    // expect(await screen.findByRole("img", { name: "コンポーネント図(全体)" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "認証API" })).toBeInTheDocument();
    // Phase-24：更新
    // expect(screen.getByText("主要処理ロジック")).toBeInTheDocument();
    // expect(screen.getByRole("button", { name: "図を再反映" })).toBeInTheDocument();
    // expect(stub.requests[0].url).toMatch(/\/projects\/p1\/uml\/embeds$/);
    // stub.restore();
    // });
    //
    // it("内部設計書以外では図の埋め込みを取得しない", () => {
    // const stub = stubFetch();
    // renderView();
    //
    // expect(screen.queryByRole("button", { name: "図を再反映" })).not.toBeInTheDocument();
    // ↓↓
    expect(screen.queryByText(/uml:diagram/)).not.toBeInTheDocument();
    expect(stub.requests).toHaveLength(0);
    stub.restore();
  });
});
