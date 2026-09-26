// 作成：Phase-3-6
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, H2, Text, XStack, YStack } from "tamagui";
import { DocumentTabs } from "@/features/documents/components/DocumentTabs";
import { useDocumentsStore } from "@/features/documents/documents-store";
import { useGenerationPolling } from "@/hooks/useGenerationPolling";

export function DocumentsPageContent({ projectId }: { projectId: string }) {
  const documents = useDocumentsStore((s) => s.documents);
  const status = useDocumentsStore((s) => s.status);
  const error = useDocumentsStore((s) => s.error);
  const regenerating = useDocumentsStore((s) => s.regenerating);
  const fetchDocuments = useDocumentsStore((s) => s.fetchDocuments);
  const regenerate = useDocumentsStore((s) => s.regenerate);
  const onRegenerationCompleted = useDocumentsStore((s) => s.onRegenerationCompleted);

  useEffect(() => {
    void fetchDocuments(projectId);
  }, [projectId, fetchDocuments]);

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
          <Button size="$3" disabled={regenerating} onPress={() => regenerate(projectId)}>
            {regenerating ? "再生成中..." : "再生成する"}
          </Button>
        </XStack>
      </XStack>

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
    </YStack>
  );
}
