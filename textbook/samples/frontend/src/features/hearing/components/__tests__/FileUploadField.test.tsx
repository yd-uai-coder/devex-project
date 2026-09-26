// 作成：Phase-3-4
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import { FileUploadField, validateFiles } from "../FileUploadField";

function makeFile(name: string, sizeBytes: number, type = "text/plain"): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("validateFiles", () => {
  it("3件以内・対応拡張子・サイズ以内ならnullを返す", () => {
    const files = [makeFile("a.txt", 10), makeFile("b.md", 10), makeFile("c.pdf", 10, "application/pdf")];

    expect(validateFiles(files)).toBeNull();
  });

  it("4件以上はエラー", () => {
    const files = [makeFile("a.txt", 10), makeFile("b.txt", 10), makeFile("c.txt", 10), makeFile("d.txt", 10)];

    expect(validateFiles(files)).toBe("ファイルは3件までです");
  });

  it("非対応拡張子はエラー", () => {
    expect(validateFiles([makeFile("a.docx", 10)])).toBe("a.docx: txt・Markdown・PDFのみ添付できます");
  });

  it("5MB超過はエラー", () => {
    expect(validateFiles([makeFile("a.txt", 5 * 1024 * 1024 + 1)])).toBe("a.txt: 1ファイルあたり5MBまでです");
  });
});

function renderField(props: { value: File[]; onChange: (files: File[]) => void }) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <FileUploadField {...props} />
    </TamaguiProvider>,
  );
}

describe("FileUploadField", () => {
  it("ファイルを選択するとonChangeが呼ばれる", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderField({ value: [], onChange });

    const file = makeFile("notes.txt", 10);
    await user.upload(screen.getByLabelText(/参考資料/), file);

    expect(onChange).toHaveBeenCalledWith([file]);
  });

  it("非対応拡張子を選ぶとエラーを表示しonChangeを呼ばない", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderField({ value: [], onChange });

    const file = makeFile("sheet.xlsx", 10);
    await user.upload(screen.getByLabelText(/参考資料/), file);

    expect(await screen.findByText("sheet.xlsx: txt・Markdown・PDFのみ添付できます")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("削除ボタンで該当ファイルを除いた配列でonChangeを呼ぶ", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const file = makeFile("notes.txt", 10);
    renderField({ value: [file], onChange });

    await user.click(screen.getByRole("button", { name: "削除" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
