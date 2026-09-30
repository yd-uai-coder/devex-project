// 作成：Phase-13-6
// 写経レベル: 定型 ── ボタン2つと注意書き。再反映・zip の後に、呼び出し側で文書と図を取り直す。
"use client";

import { useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import { downloadBundle, reflectDiagrams } from "@/features/uml/api/umlApi";
import type { UmlEmbedRead } from "@/features/uml/api/types";
import { saveFile } from "@/lib/api/download";

type DiagramSyncBarProps = {
  projectId: string;
  embeds: UmlEmbedRead[];
  // 再反映・zip の後に呼ぶ(文書の本文と図の状態が変わるため、取り直してもらう)
  onChanged: () => Promise<void>;
};

// D6: 出力したファイルは最終成果物。直接編集しても Devex には戻らない
export const BUNDLE_NOTICE =
  "ダウンロードしたファイルを直接編集しても、Devex には反映されません。修正は Devex の画面で行ってください。";

// 内部設計書のタブに置く、図の反映・zip ダウンロードの操作と、文書に載っていない図の件数。
export function DiagramSyncBar({ projectId, embeds, onChanged }: DiagramSyncBarProps) {
  const [busy, setBusy] = useState<"reflect" | "bundle" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notReflected = embeds.filter((e) => e.doc_state === "not_reflected").length;

  async function run(kind: "reflect" | "bundle", action: () => Promise<void>, failure: string) {
    setBusy(kind);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : failure);
    } finally {
      setBusy(null);
    }
  }

  const handleReflect = () =>
    run(
      "reflect",
      async () => {
        await reflectDiagrams(projectId);
      },
      "図の反映に失敗しました",
    );

  const handleBundle = () =>
    run(
      "bundle",
      async () => {
        const { filename, content } = await downloadBundle(projectId);
        saveFile(filename, content, "application/zip");
      },
      "ダウンロードに失敗しました",
    );

  return (
    <YStack gap="$2">
      {notReflected > 0 ? (
        <Text role="status" color="$orange10">
          {`承認済みの設計図のうち ${notReflected} 件が、この版の内部設計書に反映されていません(再生成・復元で消えた可能性があります)。`}
        </Text>
      ) : null}
      <XStack gap="$2" flexWrap="wrap">
        <Button size="$3" onPress={handleReflect} disabled={busy !== null}>
          {busy === "reflect" ? "反映中..." : "図を再反映"}
        </Button>
        <Button size="$3" onPress={handleBundle} disabled={busy !== null}>
          {busy === "bundle" ? "準備中..." : "図付きでダウンロード(.zip)"}
        </Button>
      </XStack>
      <Text color="$color11" fontSize="$2">
        {BUNDLE_NOTICE}
      </Text>
      {error ? (
        <Text role="alert" color="$color9">
          {error}
        </Text>
      ) : null}
    </YStack>
  );
}
