// 作成：Phase-3-5｜更新：Phase-4-2
"use client";

import { useEffect, useState } from "react";
import { Button, TextArea, Text, XStack, YStack } from "tamagui";
import { MessageBubble } from "@/features/hearing/components/MessageBubble";
import { HearingCompletionBanner } from "@/features/hearing/components/HearingCompletionBanner";
import { useHearingStore } from "@/features/hearing/hearing-store";
import { ApiError } from "@/lib/api/client";

export function ChatPanel({ projectId }: { projectId: string }) {
  const messages = useHearingStore((s) => s.messages);
  const streamingReply = useHearingStore((s) => s.streamingReply);
  const sending = useHearingStore((s) => s.sending);
  const connectionLost = useHearingStore((s) => s.connectionLost);
  const completion = useHearingStore((s) => s.completion);
  const generationTriggered = useHearingStore((s) => s.generationTriggered);
  const loadHistory = useHearingStore((s) => s.loadHistory);
  const sendMessage = useHearingStore((s) => s.sendMessage);
  const approveAndGenerate = useHearingStore((s) => s.approveAndGenerate);
  const dismissConnectionLost = useHearingStore((s) => s.dismissConnectionLost);

  const [draft, setDraft] = useState("");
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  useEffect(() => {
    void loadHistory(projectId);
  }, [projectId, loadHistory]);

  function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    void sendMessage(projectId, text);
  }

  // Phase-4-2：更新(try/catch無しでapproveAndGenerateが失敗すると、setApproving(false)に
  // 到達せず「生成を開始しています...」表示のままボタンが永久に固まり、失敗の理由も一切
  // 表示されない不具合があった。Phase 4-2の監査で発見 ── 他のフォーム(LoginForm等)と
  // 同じsubmitErrorパターンに揃える)
  // async function handleApprove() {
  //   setApproving(true);
  //   await approveAndGenerate(projectId);
  //   setApproving(false);
  // }
  // ↓↓
  async function handleApprove() {
    setApproveError(null);
    setApproving(true);
    try {
      await approveAndGenerate(projectId);
    } catch (err) {
      setApproveError(err instanceof ApiError ? err.message : "設計書の生成開始に失敗しました");
    } finally {
      setApproving(false);
    }
  }

  return (
    <YStack gap="$4">
      {connectionLost ? (
        <XStack
          role="alert"
          aria-live="polite"
          justifyContent="space-between"
          alignItems="center"
          gap="$3"
          padding="$3"
          borderRadius="$4"
          backgroundColor="$red2"
        >
          <Text color="$color9">接続が切れました。直前のメッセージが保存されていない可能性があります。</Text>
          <Button size="$2" onPress={dismissConnectionLost}>
            閉じる
          </Button>
        </XStack>
      ) : null}

      <YStack gap="$3">
        {/* sender='attachment'(添付ファイル抽出結果)・sender='others'(生成後の自己診断結果)は
            ヒアリング・ドキュメント生成のLLMコンテキスト/記録としては使うが、チャット画面には
            表示しない(添付ファイル名自体は最初のintake要約バブルに表示される。自己診断結果は
            チャットに戻った際に毎回再表示されると煩雑なため、ドキュメントプレビュー画面側で
            確認する設計に統一する)。 */}
        {messages
          .filter((message) => message.sender !== "attachment" && message.sender !== "others")
          .map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        {streamingReply ? (
          <MessageBubble
            message={{ id: "streaming", sender: "ai", message: streamingReply, created_at: "" }}
          />
        ) : null}
      </YStack>

      {completion && !generationTriggered ? (
        <HearingCompletionBanner completion={completion} onApprove={handleApprove} approving={approving} />
      ) : null}
      {approveError ? (
        <Text role="alert" color="$color9" fontSize="$2">
          {approveError}
        </Text>
      ) : null}

      <YStack gap="$2">
        <TextArea
          value={draft}
          onChangeText={setDraft}
          placeholder="メッセージを入力"
          disabled={sending || generationTriggered}
        />
        <Button onPress={handleSend} disabled={sending || generationTriggered || draft.trim().length === 0}>
          {sending ? "送信中..." : "送信"}
        </Button>
      </YStack>
    </YStack>
  );
}
