// 作成：Phase-3-4
"use client";

import FileUpload, { validateFiles as validateFilesGeneric } from "@/components/ui/form/FileUpload";

const MAX_FILES = 3;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".txt", ".md", ".pdf"];
const ACCEPT_LABEL = "txt・Markdown・PDF";
const ACCEPT_ATTR = ".txt,.md,.pdf,text/plain,text/markdown,application/pdf";
const LABEL = "参考資料(任意・最大3ファイル・txt/Markdown/PDF・1ファイル5MBまで)";

// docs/external_design.md 2.5節5項のバリデーションルールをクライアント側でも
// ミラーリングする(サーバー側の最終判定を置き換えるものではなく、早期フィードバック用)。
// 実体は汎用コンポーネント(components/ui/form/FileUpload)側の純粋関数で、
// ここではヒアリング固有のルールを固定して渡すだけにしている。
export function validateFiles(files: File[]): string | null {
  return validateFilesGeneric(files, {
    accept: ALLOWED_EXTENSIONS,
    acceptLabel: ACCEPT_LABEL,
    maxFiles: MAX_FILES,
    maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
  });
}

type FileUploadFieldProps = {
  value: File[];
  onChange: (files: File[]) => void;
};

export function FileUploadField({ value, onChange }: FileUploadFieldProps) {
  return (
    <FileUpload
      value={value}
      onChange={onChange}
      label={LABEL}
      accept={ALLOWED_EXTENSIONS}
      acceptLabel={ACCEPT_LABEL}
      acceptAttr={ACCEPT_ATTR}
      maxFiles={MAX_FILES}
      maxFileSizeBytes={MAX_FILE_SIZE_BYTES}
    />
  );
}
