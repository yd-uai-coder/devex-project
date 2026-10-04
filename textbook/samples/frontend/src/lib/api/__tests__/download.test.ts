// 作成：Phase-12-5｜更新：Phase-13-5,22-6
// Phase-22-6:追記 ── ../download.fetchAttachment, @/lib/api/client.ApiError
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAttachment, parseFilename, saveFile } from "../download";
import { ApiError } from "@/lib/api/client";

describe("parseFilename", () => {
  it("filename*(UTF-8)を優先し、無ければ filename を使う", () => {
    expect(
      parseFilename(
        "attachment; filename=\"dfd_?.svg\"; filename*=UTF-8''dfd_%E4%BA%88%E7%B4%84.svg",
      ),
    ).toBe("dfd_予約.svg");
    expect(parseFilename('attachment; filename="component.drawio"')).toBe("component.drawio");
    expect(parseFilename(null)).toBeNull();
  });
});

describe("saveFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("一時的なリンクをクリックしてファイル名つきで保存させ、後片付けする", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:1");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    saveFile("component.svg", "<svg/>", "image/svg+xml");

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe("component.svg");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
    expect(document.querySelector("a[download]")).toBeNull();
    vi.unstubAllGlobals();
  });

  // Phase-13-5:追記
  it("Blob を受け取ったら、そのまま保存させる(zip などのバイナリ)", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:2");
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const zip = new Blob([new Uint8Array([0x50, 0x4b])], { type: "application/zip" });

    saveFile("internal_design.zip", zip, "application/zip");

    expect(createObjectURL).toHaveBeenCalledWith(zip);
    vi.unstubAllGlobals();
  });
});

// Phase-22-6:追記
describe("fetchAttachment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功ならレスポンスをそのまま返し、失敗は code 付きの ApiError にする", async () => {
    const ok = new Response("x", { status: 200 });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "m", code: "DESIGN_STAGES_NOT_AVAILABLE" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAttachment("/api/v1/x")).resolves.toBe(ok);
    const error = await fetchAttachment("/api/v1/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).code).toBe("DESIGN_STAGES_NOT_AVAILABLE");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/x$/);
  });
});
