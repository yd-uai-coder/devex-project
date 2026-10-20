"use client";
// 作成：Phase-88-4

import { useState } from "react";
import { Button } from "tamagui";
import { downloadExplanation } from "@/features/change-requests/api/changeRequestsApi";
import { saveFile } from "@/lib/api/download";

// 変更の説明書(md)のダウンロードのボタン(どの状態でも)。出力に載る要約は、確認済みで古くないものだけ
// (サーバーが組み立てる)。CR の見出しと説明書のタブの両方に置く
export function ExplanationDownloadButton({ projectId, number }: { projectId: string; number: number }) {
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setError(null);
    try {
      const file = await downloadExplanation(projectId, number);
      saveFile(file.filename, file.content, "text/markdown");
    } catch (err) {
      setError(err instanceof Error ? err.message : "説明書をダウンロードできませんでした");
    }
  };

  return (
    <>
      <Button size="$3" chromeless onPress={() => void download()}>
        説明書をダウンロード(.md)
      </Button>
      {error ? (
        <span role="alert" style={{ color: "var(--red10)", fontSize: 13 }}>
          {error}
        </span>
      ) : null}
    </>
  );
}
