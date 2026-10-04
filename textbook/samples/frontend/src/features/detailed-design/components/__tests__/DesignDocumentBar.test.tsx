// 作成：Phase-22-6｜更新：Phase-23-6
// 写経レベル: 定型
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { DesignDocumentBar, DOCUMENT_NOTICE } from "../DesignDocumentBar";
import * as download from "@/lib/api/download";
import { makeStages } from "../../test-utils/stageFixtures";
import type { DesignStageRead } from "@/features/detailed-design/api/types";

function renderBar(stages: DesignStageRead[]) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DesignDocumentBar projectId="p1" stages={stages} />
    </TamaguiProvider>,
  );
}

const approved = (stages: number[]) =>
  Object.fromEntries(stages.map((stage) => [stage, { state: "approved" as const, version: 1 }]));

describe("DesignDocumentBar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Phase-23-6：更新
  // it("段階1〜6の未承認の件数を知らせる(段階7は数えない)", () => {
  // ↓↓
  it("段階1〜7の未承認の件数を知らせる(段階7は07章と実装計画になる)", () => {
    renderBar(makeStages(approved([1, 2, 3, 4])));

    // Phase-23-6：更新
    // expect(screen.getByRole("status")).toHaveTextContent("2 件が未承認");
    // ↓↓
    expect(screen.getByRole("status")).toHaveTextContent("3 件が未承認");
    expect(screen.getByText(DOCUMENT_NOTICE)).toBeInTheDocument();
  });

  // Phase-23-6：更新
  // it("段階1〜6がすべて承認済みなら、そう知らせる", () => {
  //   renderBar(makeStages(approved([1, 2, 3, 4, 5, 6])));
  // ↓↓
  it("段階1〜7がすべて承認済みなら、そう知らせる", () => {
    renderBar(makeStages(approved([1, 2, 3, 4, 5, 6, 7])));

    expect(screen.getByRole("status")).toHaveTextContent("すべて承認済み");
  });

  it("ダウンロードすると zip を Blob のまま保存させる", async () => {
    const saveFile = vi.spyOn(download, "saveFile").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([0x50, 0x4b]), {
          status: 200,
          headers: { "Content-Disposition": 'attachment; filename="detailed_design.zip"' },
        }),
      ),
    );
    renderBar(makeStages({}));

    // Phase-23-6：更新
    // await userEvent.click(screen.getByRole("button", { name: "詳細設計書をダウンロード(.zip)" }));
    // ↓↓
    await userEvent.click(screen.getByRole("button", { name: "詳細設計書と実装計画をダウンロード(.zip)" }));

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    const [filename, content, mime] = saveFile.mock.calls[0];
    expect(filename).toBe("detailed_design.zip");
    expect(content).toBeInstanceOf(Blob);
    expect(mime).toBe("application/zip");
  });

  it("失敗したら理由を出す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "使えません", code: "DESIGN_STAGES_NOT_AVAILABLE" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    renderBar(makeStages({}));

    // Phase-23-6：更新
    // await userEvent.click(screen.getByRole("button", { name: "詳細設計書をダウンロード(.zip)" }));
    // ↓↓
    await userEvent.click(screen.getByRole("button", { name: "詳細設計書と実装計画をダウンロード(.zip)" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("使えません");
  });
});
