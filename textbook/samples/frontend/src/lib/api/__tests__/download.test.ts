// 作成：Phase-12-5
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
});
