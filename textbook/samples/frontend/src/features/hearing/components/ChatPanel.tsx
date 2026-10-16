// 作成：Phase-3-5｜更新：Phase-4-2,15-8,35-3,35(完了後の調整),62-4,62(完了後の調整)
"use client";

// Phase-35-3:追記 ── ChoiceCards, latestAiMessage・pendingAnswers(@/features/hearing/cards)
// Phase-35(完了後の調整):追記 ── HearingCard(@/features/hearing/api/hearingApi)
// Phase-62-4:追記 ── useRef・CSSProperties(react), FOOTER_HEIGHT(@/components/layout/layout-constants)
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button, TextArea, Text, XStack, YStack } from "tamagui";
import { ChoiceCards } from "@/features/hearing/components/ChoiceCards";
import { MessageBubble } from "@/features/hearing/components/MessageBubble";
import { latestAiMessage, pendingAnswers } from "@/features/hearing/cards";
import { HearingCompletionBanner } from "@/features/hearing/components/HearingCompletionBanner";
import { useHearingStore } from "@/features/hearing/hearing-store";
import type { HearingCard } from "@/features/hearing/api/hearingApi";
import { FOOTER_HEIGHT } from "@/components/layout/layout-constants";
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


// Phase-62-4:追記
// Phase-62(完了後の調整)：更新(コメント。固定の見積もりは、配置を測るまでの仮の値になった)
// // 会話の領域の高さの上限。ヘッダー・見出し・入力欄の分を引き、送信ボタンが画面に収まるようにする
// ↓↓
// 会話の領域の高さの上限。配置を測るまでの見積もり(ヘッダー・見出し・入力欄の分を引く)
const HISTORY_STYLE: CSSProperties = {
  maxHeight: "max(240px, calc(100vh - 380px))",
  overflowY: "auto",
};
// Phase-62(完了後の調整):追記
const MIN_HISTORY_HEIGHT = 240;
// 会話の領域と入力欄の間(YStack の gap="$4")
const STACK_GAP = 16;

// 入力欄がページを動かさずに画面に収まる、会話の領域の高さ(下限 240px)。
// historyTop は領域の上端の文書上の位置(ページを先頭までスクロールしたときの画面上の位置)
export function fittedHistoryHeight(viewportHeight: number, historyTop: number, inputHeight: number): number {
  const fitted = viewportHeight - historyTop - STACK_GAP - inputHeight - (FOOTER_HEIGHT + 16);
  return Math.max(MIN_HISTORY_HEIGHT, Math.floor(fitted));
}
// 入力欄を画面に入れるとき、固定のフッターに隠れないよう下に余白を取る
const INPUT_STYLE: CSSProperties = { scrollMarginBottom: FOOTER_HEIGHT + 16 };
// 最下部からこの距離(px)以内なら「最下部にいる」とみなし、新しい発言に追従する
const FOLLOW_THRESHOLD = 80;

export function ChatPanel({ projectId }: { projectId: string }) {
  const messages = useHearingStore((s) => s.messages);
  // Phase-62-4:追記
  const historyStatus = useHearingStore((s) => s.historyStatus);
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

  // Phase-62-4:追記
  // 会話は専用の領域でスクロールする。履歴を読み込んだら最下部へ移し、入力欄を画面に入れる。
  // 読み込みの開始(loading)を見てから待つので、前に開いたプロジェクトの success では動かない。
  // 完了のバナーと観点の表は履歴の後に届き、会話の高さ・幅を変えるので、届いたときにも合わせ直し、
  // 観点の表が届いたところで終える(以後は利用者の操作に任せる)
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const settling = useRef(false);
  const atBottom = useRef(true);
  // Phase-62(完了後の調整):追記
  const [historyMaxHeight, setHistoryMaxHeight] = useState<number | null>(null);

  function scrollToBottom() {
    const el = historyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  // Phase-62(完了後の調整):追記
  // 領域の高さを今の配置から決める。固定の見積もりでは、上に増える行(生成済みのドキュメントへの
  // リンク・狭い画面の観点の表)の分だけ入力欄がはみ出し、ページが動いて見出しがヘッダーに隠れる。
  // 続けてスクロールの位置を測るので、DOM にもすぐ当てる(state は描き直しで同じ値を保つため)
  function fitHistoryHeight() {
    const history = historyRef.current;
    const input = inputRef.current;
    if (!history || !input) return;
    const top = history.getBoundingClientRect().top + window.scrollY;
    const height = fittedHistoryHeight(window.innerHeight, top, input.offsetHeight);
    history.style.maxHeight = `${height}px`;
    setHistoryMaxHeight(height);
  }

  useEffect(() => {
    if (historyStatus === "loading") {
      settling.current = true;
      return;
    }
    if (historyStatus !== "success" || !settling.current) return;
    atBottom.current = true;
    // Phase-62(完了後の調整):追記
    fitHistoryHeight();
    scrollToBottom();
    inputRef.current?.scrollIntoView({ block: "nearest" });
    if (points !== null) settling.current = false;
  }, [historyStatus, completion, points]);

  // 送信・ストリーミングで発言が増えたら、利用者が最下部にいるときだけ追従する
  // (遡って読んでいるときに引き戻さない)
  useEffect(() => {
    if (atBottom.current) scrollToBottom();
  }, [messages, streamingReply]);

  // 発言の Markdown の描画や幅の変化で高さが変わったときも、最下部にいれば追従する
  useEffect(() => {
    // 領域の中身(発言の一覧)の高さを見る
    const content = historyRef.current?.firstElementChild;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      if (atBottom.current) scrollToBottom();
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Phase-62(完了後の調整):追記
  // 画面の大きさが変わったら高さを決め直す(狭い画面で観点の表を開閉したときは決め直さず、
  // ページのスクロールに任せる。開いた表の分だけ会話が縮みすぎないため)
  useEffect(() => {
    function handleResize() {
      fitHistoryHeight();
      if (atBottom.current) scrollToBottom();
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handleHistoryScroll() {
    const el = historyRef.current;
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_THRESHOLD;
  }

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

      {/* Phase-62-4：更新(会話の一覧と完了のバナーを、高さに上限のあるスクロールの領域の中へ移した。
          入力欄は、画面に入れるときの余白のために包んだ)
      <YStack gap="$3">
        {messages
          .filter((message) => message.sender !== "attachment" && message.sender !== "others")
          .map((message) => (
            <YStack key={message.id} gap="$2">
              …(変更なし)
            </YStack>
          ))}
        {streamingReply ? (…) : null}
      </YStack>

      {completion && !generationTriggered ? (
        <HearingCompletionBanner … />
      ) : null}
      {approveError ? (…) : null}

      <YStack gap="$2">
        <TextArea … />
        <Button onPress={handleSend} disabled={!canSend}>…</Button>
      </YStack>
          ↓↓ */}
      {/* Phase-62(完了後の調整)：更新(配置から決めた高さがあれば、見積もりに替えて当てる)
      <div … style={HISTORY_STYLE} …>
          ↓↓ */}
      <div
        ref={historyRef}
        role="log"
        aria-label="チャットの履歴"
        style={historyMaxHeight === null ? HISTORY_STYLE : { ...HISTORY_STYLE, maxHeight: historyMaxHeight }}
        onScroll={handleHistoryScroll}
      >
        <YStack gap="$3">
          {/* sender='attachment'(添付ファイル抽出結果)・sender='others'(生成後の自己診断結果)は
              ヒアリング・ドキュメント生成のLLMコンテキスト/記録としては使うが、チャット画面には
              表示しない(添付ファイル名自体は最初のintake要約バブルに表示される。自己診断結果は
              チャットに戻った際に毎回再表示されると煩雑なため、ドキュメントプレビュー画面側で
              確認する設計に統一する)。 */}
          {messages
            .filter((message) => message.sender !== "attachment" && message.sender !== "others")
            .map((message) => (
              <YStack key={message.id} gap="$2">
                <MessageBubble message={message} />
                {message.cards && message.cards.length > 0 ? (
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
          {/* 完了のバナーは会話の末尾に置く(長くても入力欄を画面の外へ押し出さない) */}
          {completion && !generationTriggered ? (
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
        </YStack>
      </div>

      <div ref={inputRef} style={INPUT_STYLE}>
        <YStack gap="$2">
          <TextArea
            value={draft}
            onChangeText={setDraft}
            placeholder="メッセージを入力"
            disabled={sending || generationTriggered}
          />
          <Button onPress={handleSend} disabled={!canSend}>
            {sending ? "送信中..." : selectedCount > 0 ? `送信(カード ${selectedCount} 件の選択を含む)` : "送信"}
          </Button>
        </YStack>
      </div>
    </YStack>
  );
}
