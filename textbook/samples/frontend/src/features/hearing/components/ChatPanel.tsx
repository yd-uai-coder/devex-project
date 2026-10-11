// 作成：Phase-3-5｜更新：Phase-4-2,15-8,35-3,35(完了後の調整)
"use client";

// Phase-35-3:追記 ── ChoiceCards, latestAiMessage・pendingAnswers(@/features/hearing/cards)
// Phase-35(完了後の調整):追記 ── HearingCard(@/features/hearing/api/hearingApi)
import { useEffect, useState } from "react";
import { Button, TextArea, Text, XStack, YStack } from "tamagui";
import { ChoiceCards } from "@/features/hearing/components/ChoiceCards";
import { MessageBubble } from "@/features/hearing/components/MessageBubble";
import { latestAiMessage, pendingAnswers } from "@/features/hearing/cards";
import { HearingCompletionBanner } from "@/features/hearing/components/HearingCompletionBanner";
import { useHearingStore } from "@/features/hearing/hearing-store";
import type { HearingCard } from "@/features/hearing/api/hearingApi";
import { ApiError } from "@/lib/api/client";

// Phase-35(完了後の調整)：削除(文は送らず、サーバーが決まった文を残す)
// // 「任意項目についてヒアリングを続ける」で送る発言(履歴に残り、AI も読む)
// const CONTINUE_OPTIONAL_MESSAGE = "任意の項目についてもヒアリングを続けてください";

// Phase-35(完了後の調整):追記
// 最新の AI の発言のカード。選択中の状態はここだけがストアから読む(選ぶたびにチャット全体を
// 描き直さないため。描き直すと、発言ごとの Markdown の解析で色が付くのが遅くなる)
function LatestChoiceCards({
  cards,
  onSend,
  disabled,
}: {
  cards: HearingCard[];
  onSend: (cardId: string) => void;
  disabled: boolean;
}) {
  const cardDrafts = useHearingStore((s) => s.cardDrafts);
  // Phase-35(完了後の調整)：削除
  // const selectCardOption = useHearingStore((s) => s.selectCardOption);
  return (
    <ChoiceCards
      cards={cards}
      drafts={cardDrafts}
      onSelect={selectCardOption}
      onSend={onSend}
      disabled={disabled}
    />
  );
}

const NO_DRAFTS: Record<string, number> = {};


export function ChatPanel({ projectId }: { projectId: string }) {
  const messages = useHearingStore((s) => s.messages);
  const streamingReply = useHearingStore((s) => s.streamingReply);
  const sending = useHearingStore((s) => s.sending);
  const connectionLost = useHearingStore((s) => s.connectionLost);
  // Phase-15-8:追記
  const streamError = useHearingStore((s) => s.streamError);
  const completion = useHearingStore((s) => s.completion);
  const generationTriggered = useHearingStore((s) => s.generationTriggered);
  const loadHistory = useHearingStore((s) => s.loadHistory);
  const sendMessage = useHearingStore((s) => s.sendMessage);
  const approveAndGenerate = useHearingStore((s) => s.approveAndGenerate);
  const dismissConnectionLost = useHearingStore((s) => s.dismissConnectionLost);
  // Phase-35-3:追記
  // Phase-35(完了後の調整)：削除(選択中の状態は LatestChoiceCards だけが読む)
  // const cardDrafts = useHearingStore((s) => s.cardDrafts);
  // Phase-35(完了後の調整):追記
  const points = useHearingStore((s) => s.points);
  const selectCardOption = useHearingStore((s) => s.selectCardOption);

  const [draft, setDraft] = useState("");
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  useEffect(() => {
    void loadHistory(projectId);
  }, [projectId, loadHistory]);

  // Phase-35-3:追記
  // 選べるのは最新の AI の発言のカードだけ。カードを選んでいれば、文が空でも送れる
  const latestAi = latestAiMessage(messages);
  // Phase-35(完了後の調整)：更新(件数だけを購読する。件数が変わったときだけ描き直す)
  // const selectedCount = pendingAnswers(latestAi?.cards ?? [], cardDrafts).length;
  // ↓↓
  const selectedCount = useHearingStore(
    (s) => pendingAnswers(latestAiMessage(s.messages)?.cards ?? [], s.cardDrafts).length,
  );
  const canSend = !sending && !generationTriggered && (draft.trim().length > 0 || selectedCount > 0);

  function handleSend() {
    const text = draft.trim();
    // Phase-35-3：更新
    // if (!text || sending) return;
    // ↓↓
    if (!canSend) return;
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
  // Phase-35(完了後の調整):追記
  // 必須がそろった後に、バナーに並べる未決の任意の観点(観点の表から)
  const optionalPoints = points?.points.filter((p) => !p.required && p.status === "open") ?? [];

  // バナーの「任意項目についてヒアリングを続ける」。返信に任意の観点のカードが付く
  function handleContinueOptional() {
    if (sending || generationTriggered) return;
    // Phase-35(完了後の調整)：更新(文は送らない。サーバーが決まった文を利用者の発言として残し、判定の LLM は呼ばない)
    // void sendMessage(projectId, CONTINUE_OPTIONAL_MESSAGE, { continueOptional: true });
    // ↓↓
    void sendMessage(projectId, "", { continueOptional: true });
  }

  // Phase-35(完了後の調整):追記
  // カードごとの「この回答を送る」。入力欄の文も一緒に送る
  function handleSendCard(cardId: string) {
    if (sending || generationTriggered) return;
    const text = draft.trim();
    setDraft("");
    void sendMessage(projectId, text, { cardIds: [cardId] });
  }

  async function handleApprove() {
    // Phase-15-8:追記 ── 二度押しの防止(ボタンも approving の間は無効にする)
    if (approving) return;
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
      {/* Phase-15-8:追記 ── バックエンドが SSE の event: error で伝えた失敗(気づき#2) */}
      {streamError ? (
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
          <Text color="$color9">
            {streamError} 送信したメッセージは保存されていません。もう一度送信してください。
          </Text>
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
            // Phase-35-3：更新
            // <MessageBubble key={message.id} message={message} />
            // ↓↓
            <YStack key={message.id} gap="$2">
              <MessageBubble message={message} />
              {message.cards && message.cards.length > 0 ? (
                // Phase-35(完了後の調整)：更新(最新のカードだけが選択中の状態を読む)
                // <ChoiceCards
                // cards={message.cards}
                // drafts={message === latestAi ? cardDrafts : {}}
                // onSelect={message === latestAi ? selectCardOption : undefined}
                // Phase-35(完了後の調整):追記
                // onSend={message === latestAi ? handleSendCard : undefined}
                // disabled={sending || generationTriggered}
                // />
                // ↓↓
                message === latestAi ? (
                  <LatestChoiceCards
                    cards={message.cards}
                    onSend={handleSendCard}
                    disabled={sending || generationTriggered}
                  />
                ) : (
                  <ChoiceCards cards={message.cards} drafts={NO_DRAFTS} />
                )
              ) : null}
            </YStack>
          ))}
        {streamingReply ? (
          <MessageBubble
            message={{ id: "streaming", sender: "ai", message: streamingReply, created_at: "" }}
          />
        ) : null}
      </YStack>

      {completion && !generationTriggered ? (
        // Phase-35(完了後の調整)：更新(任意の観点の一覧と「続ける」を渡す)
        // <HearingCompletionBanner completion={completion} onApprove={handleApprove} approving={approving} />
        // ↓↓
        <HearingCompletionBanner
          completion={completion}
          onApprove={handleApprove}
          approving={approving}
          optionalPoints={optionalPoints}
          onContinueOptional={handleContinueOptional}
          sending={sending}
        />
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
        {/* Phase-35-3：更新
        <Button onPress={handleSend} disabled={sending || generationTriggered || draft.trim().length === 0}>
          {sending ? "送信中..." : "送信"}
        ↓↓ */}
        <Button onPress={handleSend} disabled={!canSend}>
          {sending ? "送信中..." : selectedCount > 0 ? `送信(カード ${selectedCount} 件の選択を含む)` : "送信"}
        </Button>
      </YStack>
    </YStack>
  );
}
