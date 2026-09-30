// 作成：Phase-12-5｜更新：Phase-13-5
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseFilename, saveFile } from "../download";

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
