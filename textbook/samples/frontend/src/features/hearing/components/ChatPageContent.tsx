// 作成：Phase-3-5｜更新：Phase-3-6
"use client";

// Phase-3-6：更新(ドキュメントプレビュー画面の再生成でも同じポーリングロジックが
// 必要になったため、useGenerationPollingという共通フックへ切り出した)
// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { H2, Text, YStack } from "tamagui";
// import { ChatPanel } from "@/features/hearing/components/ChatPanel";
// import { getProject } from "@/features/hearing/api/hearingApi";
// import { useHearingStore } from "@/features/hearing/hearing-store";
// import { useInterval } from "@/hooks/useInterval";
//
// const POLL_INTERVAL_MS = 5000;
// const POLL_TIMEOUT_MS = 3 * 60 * 1000;
//
// // POST /generateは202のみ返す(プッシュ通知が無い)ため、生成完了はGET /projects/{id}の
// // statusをポーリングして検知する。既定値はPhase-3-introduction.mdの共通方針(5秒間隔・
// // 3分でタイムアウト)。
// export function ChatPageContent({ projectId }: { projectId: string }) {
//   const router = useRouter();
//   const generationTriggered = useHearingStore((s) => s.generationTriggered);
//   const [elapsedMs, setElapsedMs] = useState(0);
//   const [timedOut, setTimedOut] = useState(false);
//
//   const polling = generationTriggered && !timedOut;
//
//   useInterval(
//     () => {
//       void (async () => {
//         const project = await getProject(projectId);
//         if (project.status === "completed") {
//           router.push(`/projects/${projectId}/documents`);
//           return;
//         }
//         setElapsedMs((current) => current + POLL_INTERVAL_MS);
//       })();
//     },
//     polling ? POLL_INTERVAL_MS : null,
//   );
//
//   useEffect(() => {
//     if (elapsedMs >= POLL_TIMEOUT_MS) {
//       setTimedOut(true);
//     }
//   }, [elapsedMs]);
//
//   return (
// ↓↓
import Link from "next/link";
import { useRouter } from "next/navigation";
import { H2, Text, XStack, YStack } from "tamagui";
import { ChatPanel } from "@/features/hearing/components/ChatPanel";
import { useHearingStore } from "@/features/hearing/hearing-store";
import { useGenerationPolling } from "@/hooks/useGenerationPolling";

// POST /generateは202のみ返す(プッシュ通知が無い)ため、生成完了検知は
// useGenerationPolling(元はここに直接書かれていたが、ドキュメントプレビュー画面の
// 再生成でも同じロジックが必要になったため共通フックへ切り出した)に委ねる。
export function ChatPageContent({ projectId }: { projectId: string }) {
  const router = useRouter();
  const generationTriggered = useHearingStore((s) => s.generationTriggered);
  const projectStatus = useHearingStore((s) => s.projectStatus);

  const { timedOut } = useGenerationPolling(projectId, generationTriggered, () => {
    router.push(`/projects/${projectId}/documents`);
  });

  return (
    <YStack paddingVertical="$4" gap="$4">
      <H2>ヒアリングチャット</H2>
      {generationTriggered && !timedOut ? (
        <Text color="$color11">設計書を生成しています。しばらくお待ちください...</Text>
      ) : null}
      {timedOut ? (
        <Text role="alert" color="$color9">
          生成に時間がかかっています。しばらくしてからダッシュボードを確認してください。
        </Text>
      ) : null}
      {/* completed/revising(修正中)では自動遷移させず、常設リンクとして提示する
          (かつては生成済みプロジェクトを開くと即座に/documentsへ強制的に戻されてしまい、
          チャットをやり直せない不具合があった)。 */}
      {projectStatus === "completed" || projectStatus === "revising" ? (
        <XStack>
          <Link href={`/projects/${projectId}/documents`}>
            <Text color="$blue10">生成済みのドキュメントを見る →</Text>
          </Link>
        </XStack>
      ) : null}
      <ChatPanel projectId={projectId} />
    </YStack>
  );
}
