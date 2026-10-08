// 作成：Phase-22-6｜更新：Phase-23-6,30-4,30-7
// 写経レベル: 定型 ── ダウンロードのボタンと未承認の件数の案内(DiagramSyncBar と同じ形)。
"use client";

import { useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
// Phase-30-7：更新
// import { downloadDetailedDesign } from "@/features/detailed-design/api/designStagesApi";
// ↓↓
import {
  downloadDetailedDesign,
  downloadImplementationProcedure,
  type DownloadedDocument,
} from "@/features/detailed-design/api/designStagesApi";
import type { DesignStageRead } from "@/features/detailed-design/api/types";
import { saveFile } from "@/lib/api/download";
// Phase-30-7：削除
//
// // zip に入る文書の元になる段階(詳細設計書の01〜07章と、実装計画と、実装手順書。段階7が07章と
// // 実装計画の両方を、段階8が実装手順書を作る)
// const DOCUMENT_STAGES = [1, 2, 3, 4, 5, 6, 7, 8];

// 出力したファイルは最終成果物。直接編集しても Devex には戻らない(ステージ3の zip と同じ)
export const DOCUMENT_NOTICE =
  "ダウンロードしたファイルを直接編集しても、Devex には反映されません。修正は Devex の画面で行ってください。";

// Phase-30-4：更新
// // SCR-008 の上部に置く、詳細設計書と実装計画(HTML+md+図の zip)のダウンロード(Phase 22・23)。
// ↓↓
// Phase-30-7：更新
// // SCR-008 の上部に置く、詳細設計書・実装計画・実装手順書(HTML+md+図の zip)のダウンロード。
// // いつでもダウンロードでき、承認していない段階の章は「未承認」になるので、その件数を先に知らせる。
// ↓↓
// 押せないボタンの透過(段階のステッパーの、開いていない段階と同じ考え方)
const DISABLED_OPACITY = 0.5;

type DownloadItem = {
  label: string;
  // zip の元になる段階。すべて承認済み(古くない)になるまで押せない(サーバーも 409 で断る)
  stages: number[];
  download: (projectId: string) => Promise<DownloadedDocument>;
};

// 詳細設計書(01〜07章)と実装計画は段階1〜7、実装手順書は段階8から作る
export const DOWNLOADS: DownloadItem[] = [
  {
    label: "詳細設計書・実装計画をダウンロード(.zip)",
    stages: [1, 2, 3, 4, 5, 6, 7],
    download: downloadDetailedDesign,
  },
  {
    label: "実装手順書をダウンロード(.zip)",
    stages: [8],
    download: downloadImplementationProcedure,
  },
];

// targets のうち、承認済み(古くない)でない段階。
export function unapprovedStages(stages: DesignStageRead[], targets: number[]): number[] {
  return targets.filter((target) => stages.find((s) => s.stage === target)?.state !== "approved");
}

// SCR-008 の上部に置く、2つの zip(詳細設計書・実装計画 / 実装手順書)のダウンロード。
// 元になる段階が承認されるまでボタンを押せなくし(透過表示)、どの段階が未承認かを横に出す。
export function DesignDocumentBar({
  projectId,
  stages,
}: {
  projectId: string;
  stages: DesignStageRead[];
}) {
  // Phase-30-7：更新
  // const [busy, setBusy] = useState(false);
  // ↓↓
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Phase-30-7：削除
  // const unapproved = stages.filter(
  //   (s) => DOCUMENT_STAGES.includes(s.stage) && s.state !== "approved",
  // ).length;

  // Phase-30-7：更新
  // const handleDownload = async () => {
  //   setBusy(true);
  // ↓↓
  const handleDownload = async (item: DownloadItem) => {
    setBusy(item.label);
    setError(null);
    try {
      // Phase-30-7：更新
      // const { filename, content } = await downloadDetailedDesign(projectId);
      // ↓↓
      const { filename, content } = await item.download(projectId);
      saveFile(filename, content, "application/zip");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ダウンロードに失敗しました");
    } finally {
      // Phase-30-7：更新
      // setBusy(false);
      // ↓↓
      setBusy(null);
    }
  };

  return (
    <YStack gap="$2">
      {/* Phase-30-7：更新
          <XStack gap="$3" alignItems="center" flexWrap="wrap">
            <Button size="$3" onPress={() => void handleDownload()} disabled={busy}>
              {busy ? "準備中..." : "詳細設計書・実装計画・実装手順書をダウンロード(.zip)"}
            </Button>
            <Text role="status" color={unapproved > 0 ? "$orange10" : "$color11"} fontSize="$2">
              {unapproved > 0
                ? `段階1〜8のうち ${unapproved} 件が未承認です。未承認の段階の章(段階7は実装計画も、段階8は実装手順書)は「未承認」と書かれます。`
                : "段階1〜8はすべて承認済みです。"}
            </Text>
          </XStack>
          ↓↓ */}
      {DOWNLOADS.map((item) => {
        const missing = unapprovedStages(stages, item.stages);
        const ready = missing.length === 0;
        return (
          <XStack key={item.label} gap="$3" alignItems="center" flexWrap="wrap">
            <Button
              size="$3"
              onPress={() => void handleDownload(item)}
              disabled={!ready || busy !== null}
              opacity={ready ? 1 : DISABLED_OPACITY}
            >
              {busy === item.label ? "準備中..." : item.label}
            </Button>
            <Text role="status" color={ready ? "$color11" : "$orange10"} fontSize="$2">
              {ready
                ? "承認済みです。"
                : `段階${missing.join("・")}が未承認です。承認するとダウンロードできます。`}
            </Text>
          </XStack>
        );
      })}
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
