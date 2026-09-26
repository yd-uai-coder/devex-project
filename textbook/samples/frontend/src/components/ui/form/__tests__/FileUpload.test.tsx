// 作成：Phase-3-4
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TamaguiProvider } from "tamagui";
import tamaguiConfig from "@/tamagui.config";
import FileUpload, { validateFiles } from "../FileUpload";
import type { FileUploadProps } from "../FileUpload";

const RULES = { accept: [".txt", ".md", ".pdf"], acceptLabel: "txt・Markdown・PDF", maxFiles: 3, maxFileSizeBytes: 5 * 1024 * 1024 };

function makeFile(name: string, sizeBytes: number, type = "text/plain"): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("validateFiles", () => {
  it("上限件数以内・対応拡張子・サイズ以内ならnullを返す", () => {
    const files = [makeFile("a.txt", 10), makeFile("b.md", 10), makeFile("c.pdf", 10, "application/pdf")];

    expect(validateFiles(files, RULES)).toBeNull();
  });

  it("上限件数を超えるとエラー", () => {
    const files = [makeFile("a.txt", 10), makeFile("b.txt", 10), makeFile("c.txt", 10), makeFile("d.txt", 10)];

    expect(validateFiles(files, RULES)).toBe("ファイルは3件までです");
  });

  it("非対応拡張子はエラー(acceptLabelを使った文言)", () => {
    expect(validateFiles([makeFile("a.docx", 10)], RULES)).toBe("a.docx: txt・Markdown・PDFのみ添付できます");
  });

  it("上限サイズ超過はエラー", () => {
    expect(validateFiles([makeFile("a.txt", 5 * 1024 * 1024 + 1)], RULES)).toBe("a.txt: 1ファイルあたり5MBまでです");
  });

  it("上限を変更すればエラー文言もそれに追従する", () => {
    const files = [makeFile("a.txt", 10), makeFile("b.txt", 10)];

    expect(validateFiles(files, { ...RULES, maxFiles: 1 })).toBe("ファイルは1件までです");
  });
});

function renderField(props: Partial<FileUploadProps> & { onChange: (files: File[]) => void }) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <FileUpload value={[]} label="添付ファイル" {...RULES} {...props} />
    </TamaguiProvider>,
  );
}

describe("FileUpload", () => {
  it("ファイルを選択するとonChangeが呼ばれる", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderField({ onChange });

    const file = makeFile("notes.txt", 10);
    await user.upload(screen.getByLabelText("添付ファイル"), file);

    expect(onChange).toHaveBeenCalledWith([file]);
  });

  it("非対応拡張子を選ぶとエラーを表示しonChangeを呼ばない", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    // 実際のゲートは常にvalidateFiles(JS側)であり、input[accept]はOSのファイル選択
    // ダイアログ上のヒントに過ぎない。ここではacceptAttrにこのファイルの拡張子を
    // 含め、テスト対象のライブラリ(user-event)がaccept属性で選択自体をブロック
    // しないようにしている(判定に使うaccept propはRULESのまま=xlsxは非対応)。
    renderField({ onChange, acceptAttr: ".txt,.md,.pdf,.xlsx" });

    const file = makeFile("sheet.xlsx", 10);
    await user.upload(screen.getByLabelText("添付ファイル"), file);

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

  it("labelに渡した文字列がそのままラベル表示になる(ドメイン非依存)", () => {
    renderField({ onChange: vi.fn(), label: "カスタムラベル" });

    expect(screen.getByLabelText("カスタムラベル")).toBeInTheDocument();
  });
});
