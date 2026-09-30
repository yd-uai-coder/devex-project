// 作成：Phase-13-6
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { BUNDLE_NOTICE, DiagramSyncBar } from "../DiagramSyncBar";
import * as download from "@/lib/api/download";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { makeEmbed } from "@/features/uml/test-utils/umlFixtures";
import type { UmlEmbedRead } from "@/features/uml/api/types";

function renderBar(embeds: UmlEmbedRead[], onChanged = vi.fn().mockResolvedValue(undefined)) {
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DiagramSyncBar projectId="p1" embeds={embeds} onChanged={onChanged} />
    </TamaguiProvider>,
  );
  return onChanged;
}

describe("DiagramSyncBar", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
  });

  afterEach(() => {
    stub.restore();
    vi.restoreAllMocks();
  });

  it("文書に載っていない承認済みの図の数と、D6 の注意を出す", () => {
    renderBar([makeEmbed(), makeEmbed({ diagram_id: "d2", doc_state: "not_reflected" })]);

    expect(screen.getByRole("status")).toHaveTextContent("1 件");
    expect(screen.getByText(BUNDLE_NOTICE)).toBeInTheDocument();
  });

  it("図を再反映すると POST .../reflect し、呼び出し側に取り直させる", async () => {
    stub.queue({ body: { reflected: 1 } });
    const onChanged = renderBar([makeEmbed({ doc_state: "not_reflected" })]);

    await userEvent.click(screen.getByRole("button", { name: "図を再反映" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(stub.requests[0].url).toMatch(/\/uml\/reflect$/);
    expect(stub.requests[0].init?.method).toBe("POST");
  });

  it("zip をダウンロードすると Blob のまま保存させる", async () => {
    const saveFile = vi.spyOn(download, "saveFile").mockImplementation(() => {});
    stub.fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([0x50, 0x4b]), {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="internal_design.zip"' },
      }),
    );
    const onChanged = renderBar([makeEmbed()]);

    await userEvent.click(screen.getByRole("button", { name: "図付きでダウンロード(.zip)" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(saveFile).toHaveBeenCalledWith("internal_design.zip", expect.any(Blob), "application/zip");
  });

  it("失敗したら理由を出し、取り直しは呼ばない", async () => {
    stub.queue({ status: 404, body: { detail: "内部設計書がありません", code: "RESOURCE_NOT_FOUND" } });
    const onChanged = renderBar([]);

    await userEvent.click(screen.getByRole("button", { name: "図を再反映" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("内部設計書がありません");
    expect(onChanged).not.toHaveBeenCalled();
  });
});
