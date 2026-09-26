// 作成：Phase-3-4
"use client";

import { useState } from "react";
import { Text, YStack } from "tamagui";
import { Breadcrumb } from "@/components/ui/primitives/Breadcrumb";
import FileUpload from "@/components/ui/form/FileUpload";

const ACCEPT = [".txt", ".md", ".pdf"];
const ACCEPT_LABEL = "txt・Markdown・PDF";
const MAX_FILES = 3;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export default function FileUploadPage() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <YStack maxWidth={480} gap="$4">
      <Breadcrumb
        pageTitle="ファイルアップロード"
        description="件数・拡張子・サイズの上限をpropsで指定できる、汎用のファイル添付コンポーネントです。"
      />
      <FileUpload
        value={files}
        onChange={setFiles}
        label="添付ファイル(最大3ファイル・txt/Markdown/PDF・1ファイル5MBまで)"
        accept={ACCEPT}
        acceptLabel={ACCEPT_LABEL}
        maxFiles={MAX_FILES}
        maxFileSizeBytes={MAX_FILE_SIZE_BYTES}
      />
      <Text fontSize="$3">選択中のファイル数: {files.length}</Text>
    </YStack>
  );
}
