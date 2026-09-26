// 作成：Phase-3-4
"use client";

import { useId, useRef, useState } from "react";
import { Button, Label, Text, XStack, YStack } from "tamagui";

export function validateFiles(
  files: File[],
  options: { accept: string[]; acceptLabel: string; maxFiles: number; maxFileSizeBytes: number },
): string | null {
  const { accept, acceptLabel, maxFiles, maxFileSizeBytes } = options;
  if (files.length > maxFiles) {
    return `ファイルは${maxFiles}件までです`;
  }
  for (const file of files) {
    const hasAllowedExtension = accept.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasAllowedExtension) {
      return `${file.name}: ${acceptLabel}のみ添付できます`;
    }
    if (file.size > maxFileSizeBytes) {
      return `${file.name}: 1ファイルあたり${Math.floor(maxFileSizeBytes / (1024 * 1024))}MBまでです`;
    }
  }
  return null;
}

export type FileUploadProps = {
  value: File[];
  onChange: (files: File[]) => void;
  label: string;
  accept: string[];
  acceptLabel: string;
  acceptAttr?: string;
  maxFiles: number;
  maxFileSizeBytes: number;
};

export default function FileUpload({
  value,
  onChange,
  label,
  accept,
  acceptLabel,
  acceptAttr,
  maxFiles,
  maxFileSizeBytes,
}: FileUploadProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const nextFiles = [...value, ...Array.from(fileList)];
    const validationError = validateFiles(nextFiles, { accept, acceptLabel, maxFiles, maxFileSizeBytes });
    setError(validationError);
    if (!validationError) {
      onChange(nextFiles);
    }
    // 同じファイルを選び直せるよう、選択の都度inputをリセットする
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleRemove(index: number) {
    setError(null);
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <YStack gap="$2" marginBottom="$3">
      <Label htmlFor={inputId}>{label}</Label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={acceptAttr ?? accept.join(",")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
      {value.length > 0 ? (
        <YStack gap="$1">
          {value.map((file, index) => (
            <XStack key={`${file.name}-${index}`} justifyContent="space-between" alignItems="center" gap="$2">
              <Text fontSize="$3">{file.name}</Text>
              <Button size="$2" onPress={() => handleRemove(index)}>
                削除
              </Button>
            </XStack>
          ))}
        </YStack>
      ) : null}
      {error ? (
        <Text id={errorId} role="alert" color="$color9" fontSize="$2">
          {error}
        </Text>
      ) : null}
    </YStack>
  );
}
