// 作成：Phase-22-6｜更新：Phase-23-6
// 写経レベル: 定型 ── ダウンロードのボタンと未承認の件数の案内(DiagramSyncBar と同じ形)。
"use client";

import { useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import { downloadDetailedDesign } from "@/features/detailed-design/api/designStagesApi";
import type { DesignStageRead } from "@/features/detailed-design/api/types";
import { saveFile } from "@/lib/api/download";

// Phase-23-6：更新
// // 詳細設計書の章になる段階(01〜06章。段階7 実装計画は Phase 23 で決める)
// const DOCUMENT_STAGES = [1, 2, 3, 4, 5, 6];
// ↓↓
// zip に入る文書の元になる段階(詳細設計書の01〜07章と、実装計画。段階7が07章と実装計画の両方を
// 作る。Phase 23)
const DOCUMENT_STAGES = [1, 2, 3, 4, 5, 6, 7];

// 出力したファイルは最終成果物。直接編集しても Devex には戻らない(ステージ3の zip と同じ)
export const DOCUMENT_NOTICE =
  "ダウンロードしたファイルを直接編集しても、Devex には反映されません。修正は Devex の画面で行ってください。";

// Phase-23-6：更新
// // SCR-008 の上部に置く、詳細設計書(HTML+md+図の zip)のダウンロード(Phase 22)。
// ↓↓
// SCR-008 の上部に置く、詳細設計書と実装計画(HTML+md+図の zip)のダウンロード(Phase 22・23)。
// いつでもダウンロードでき、承認していない段階の章は「未承認」になるので、その件数を先に知らせる。
export function DesignDocumentBar({
  projectId,
  stages,
}: {
  projectId: string;
  stages: DesignStageRead[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unapproved = stages.filter(
    (s) => DOCUMENT_STAGES.includes(s.stage) && s.state !== "approved",
  ).length;

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      const { filename, content } = await downloadDetailedDesign(projectId);
      saveFile(filename, content, "application/zip");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ダウンロードに失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <YStack gap="$2">
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <Button size="$3" onPress={() => void handleDownload()} disabled={busy}>
          {/* Phase-23-6：更新
              {busy ? "準備中..." : "詳細設計書をダウンロード(.zip)"}
              ↓↓ */}
          {busy ? "準備中..." : "詳細設計書と実装計画をダウンロード(.zip)"}
        </Button>
        {/* Phase-23-6：更新(件数の文言を段階1〜7に)
            ? `段階1〜6のうち ${unapproved} 件が未承認です。未承認の段階の章は「未承認」と書かれます。`
            : "段階1〜6はすべて承認済みです。"
            ↓↓ */}
        <Text role="status" color={unapproved > 0 ? "$orange10" : "$color11"} fontSize="$2">
          {unapproved > 0
            ? `段階1〜7のうち ${unapproved} 件が未承認です。未承認の段階の章(段階7は実装計画も)は「未承認」と書かれます。`
            : "段階1〜7はすべて承認済みです。"}
        </Text>
      </XStack>
      <Text color="$color11" fontSize="$2">
        {DOCUMENT_NOTICE}
      </Text>
      {error ? (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      ) : null}
    </YStack>
  );
}
