// 作成：Phase-3-5｜更新：Phase-3-6,34-3,35(完了後の調整)
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
// Phase-34-3:追記 ── useMedia(tamagui), HearingPointsPanel
// Phase-35(完了後の調整):追記 ── useState(react), HEADER_HEIGHT, ApiError
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { H2, Text, XStack, YStack, useMedia } from "tamagui";
import { ChatPanel } from "@/features/hearing/components/ChatPanel";
import { HearingPointsPanel } from "@/features/hearing/components/HearingPointsPanel";
import { useHearingStore } from "@/features/hearing/hearing-store";
import { useGenerationPolling } from "@/hooks/useGenerationPolling";
import { HEADER_HEIGHT } from "@/components/layout/layout-constants";
import { ApiError } from "@/lib/api/client";

// POST /generateは202のみ返す(プッシュ通知が無い)ため、生成完了検知は
// useGenerationPolling(元はここに直接書かれていたが、ドキュメントプレビュー画面の
// 再生成でも同じロジックが必要になったため共通フックへ切り出した)に委ねる。
export function ChatPageContent({ projectId }: { projectId: string }) {
  const router = useRouter();
  const generationTriggered = useHearingStore((s) => s.generationTriggered);
  const projectStatus = useHearingStore((s) => s.projectStatus);
  // Phase-34-3:追記
  const points = useHearingStore((s) => s.points);
  // Phase-35(完了後の調整):追記
  const skipPoint = useHearingStore((s) => s.skipPoint);
  const [skippingKey, setSkippingKey] = useState<string | null>(null);
  const [skipError, setSkipError] = useState<string | null>(null);
  // 広い画面(lg 以上)は観点の表をチャットの右に開いて置き、狭い画面はチャットの上に畳んで置く
  const wide = useMedia().lg;

  // Phase-35(完了後の調整):追記
  async function handleSkip(pointKey: string) {
    setSkipError(null);
    setSkippingKey(pointKey);
    try {
      await skipPoint(projectId, pointKey);
    } catch (err) {
      setSkipError(err instanceof ApiError ? err.message : "観点を対象外にできませんでした");
    } finally {
      setSkippingKey(null);
    }
  }

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
      {/* Phase-34-3：更新(広い画面は観点の表をチャットの右、狭い画面は上に置く)
      <ChatPanel projectId={projectId} />
          ↓↓ */}
      <YStack gap="$4" $lg={{ flexDirection: "row-reverse", alignItems: "flex-start" }}>
        {points ? (
          // Phase-35(完了後の調整)：更新(広い画面では表をスクロールに追従させ、未決の必須を対象外にできるようにした)
          // <YStack $lg={{ width: 460, flexShrink: 0 }}>
          // 幅が変わって置き場所が変わったら、開閉の初期値を合わせ直す
          // <HearingPointsPanel key={wide ? "wide" : "narrow"} view={points} defaultOpen={wide} />
          // </YStack>
          // ↓↓
          // 広い画面では、チャットをスクロールしても表が見えるよう、ヘッダーの下に追従させる
          // (表が画面より長ければ、表の中でスクロールする)
          <YStack
            gap="$2"
            $lg={{
              width: 460,
              flexShrink: 0,
              position: "sticky",
              top: HEADER_HEIGHT + 16,
              maxHeight: `calc(100vh - ${HEADER_HEIGHT + 32}px)`,
              overflowY: "auto",
            }}
          >
            {/* 幅が変わって置き場所が変わったら、開閉の初期値を合わせ直す */}
            <HearingPointsPanel
              key={wide ? "wide" : "narrow"}
              view={points}
              defaultOpen={wide}
              onSkip={generationTriggered ? undefined : handleSkip}
              skippingKey={skippingKey}
            />
            {skipError ? (
              <Text role="alert" color="$color9" fontSize="$2">
                {skipError}
              </Text>
            ) : null}
          </YStack>
        ) : null}
        <YStack minWidth={0} $lg={{ flex: 1 }}>
          <ChatPanel projectId={projectId} />
        </YStack>
      </YStack>
    </YStack>
  );
}
