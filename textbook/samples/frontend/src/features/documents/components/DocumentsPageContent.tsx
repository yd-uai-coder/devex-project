// 作成：Phase-3-6｜更新：Phase-11-4,15-7,15-8,24(完了後の調整),31-5
"use client";

// Phase-15-8:追記 ── useState(react), ConfirmDialog
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, H2, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { DocumentTabs } from "@/features/documents/components/DocumentTabs";
import { useDocumentsStore } from "@/features/documents/documents-store";
import { useGenerationPolling } from "@/hooks/useGenerationPolling";

export function DocumentsPageContent({ projectId }: { projectId: string }) {
  const documents = useDocumentsStore((s) => s.documents);
  const status = useDocumentsStore((s) => s.status);
  const error = useDocumentsStore((s) => s.error);
  const regenerating = useDocumentsStore((s) => s.regenerating);
  // Phase-15-8:追記
  const regenerateError = useDocumentsStore((s) => s.regenerateError);
  const fetchDocuments = useDocumentsStore((s) => s.fetchDocuments);
  const regenerate = useDocumentsStore((s) => s.regenerate);
  const onRegenerationCompleted = useDocumentsStore((s) => s.onRegenerationCompleted);
  // Phase-15-7:追記
  const projectMode = useDocumentsStore((s) => s.projectMode);
  const fetchProjectMode = useDocumentsStore((s) => s.fetchProjectMode);
  // Phase-15-8:追記
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Phase-15-7：更新
  // useEffect(() => {
  //   void fetchDocuments(projectId);
  // }, [projectId, fetchDocuments]);
  // ↓↓
  useEffect(() => {
    void fetchDocuments(projectId);
    void fetchProjectMode(projectId);
  }, [projectId, fetchDocuments, fetchProjectMode]);

  // 再生成トリガー後の完了検知はPhase 3-5と同じuseGenerationPollingを再利用する。
  useGenerationPolling(projectId, regenerating, () => {
    onRegenerationCompleted(projectId);
  });

  return (
    <YStack paddingVertical="$4" gap="$4">
      <XStack justifyContent="space-between" alignItems="center">
        <H2>ドキュメントプレビュー</H2>
        <XStack gap="$3" alignItems="center">
          <Link href={`/projects/${projectId}/chat`}>
            <Text color="$blue10">チャットに戻る</Text>
          </Link>
          {/* Phase-24：更新
          {/ * 詳細設計モードには内部設計書が無い(段階で組み立てる)ため、設計図の生成ではなく
              詳細設計画面(SCR-008)へ進ませる * /}
          {projectMode === "simple" ? (
            <Link href={`/projects/${projectId}/uml`}>
              <Text color="$blue10">設計図を生成する →</Text>
            </Link>
          ) : null}
          ↓↓ */}
          {/* 詳細設計モードは、ここから詳細設計画面(SCR-008)へ進む(内部設計書は段階で組み立てる) */}
          {projectMode === "detailed" ? (
            <Link href={`/projects/${projectId}/detailed-design`}>
              <Text color="$blue10">詳細設計へ進む →</Text>
            </Link>
          ) : null}
          {/* Phase-15-8：更新(押したら確認ダイアログを開く)
          <Button size="$3" disabled={regenerating} onPress={() => regenerate(projectId)}>
              ↓↓ */}
          {/* Phase-31-5:追記 */}
          {/* 簡易モードは、同じ画面(SCR-008)を段階8(実装手順書)だけで開く(入力は4文書) */}
          {projectMode === "simple" ? (
            <Link href={`/projects/${projectId}/detailed-design`}>
              <Text color="$blue10">実装手順書へ進む →</Text>
            </Link>
          ) : null}
          <Button size="$3" disabled={regenerating} onPress={() => setConfirmOpen(true)}>
            {regenerating ? "再生成中..." : "再生成する"}
          </Button>
        </XStack>
      </XStack>

      {/* Phase-15-8:追記 */}
      {regenerateError ? (
        <Text role="alert" color="$color9">
          {regenerateError}
        </Text>
      ) : null}
      {regenerating ? (
        <Text color="$color11">再生成しています。しばらくお待ちください...</Text>
      ) : null}
      {status === "loading" && documents.length === 0 ? (
        <Text color="$color11">読み込み中...</Text>
      ) : null}
      {status === "error" ? (
        <Text role="alert" color="$color9">
          {error}
        </Text>
      ) : null}
      {status === "success" && documents.length === 0 ? (
        <Text color="$color11">まだ生成されたドキュメントがありません。</Text>
      ) : null}

      <DocumentTabs projectId={projectId} documents={documents} />

      {/* Phase-15-8:追記 */}
      <ConfirmDialog
        open={confirmOpen}
        title="設計書を再生成しますか"
        description="チャットの内容から設計書を作り直します。今の版は履歴に残ります。生成には数分かかります。"
        confirmLabel="再生成する"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void regenerate(projectId);
        }}
      />
    </YStack>
  );
}
