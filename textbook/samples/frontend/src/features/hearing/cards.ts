// 作成：Phase-35-3
import type { CardAnswer, ChatHistoryEntry, HearingCard } from "@/features/hearing/api/hearingApi";

// 選択肢カードの選択を、送信の形にする(純粋関数)。採用の記録はサーバーが送信の時点で行うので、
// ここでは選べるカード・送る回答・楽観表示の本文を決めるだけ。

// 選べるのは最新の AI の発言のカードだけ(古いカードは選んだ結果を読むだけ)
export function latestAiMessage(messages: ChatHistoryEntry[]): ChatHistoryEntry | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].sender === "ai") return messages[i];
  }
  return null;
}

// 未回答のカードのうち、選択中のものを、カードの順に回答にする
export function pendingAnswers(cards: HearingCard[], drafts: Record<string, number>): CardAnswer[] {
  return cards
    .filter((card) => card.selected === null && drafts[card.id] !== undefined)
    .map((card) => ({ card_id: card.id, option: drafts[card.id] }));
}

// サーバーが保存する発言の本文と同じ形(devex-api app/hearing/cards.py の compose_answer_message)
export function composeAnswerText(cards: HearingCard[], answers: CardAnswer[], text: string): string {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const lines = answers.flatMap((answer) => {
    const card = byId.get(answer.card_id);
    return card ? [`【${card.label}】${card.options[answer.option].label}`] : [];
  });
  const body = text.trim();
  if (lines.length > 0 && body) return `${lines.join("\n")}\n\n${body}`;
  return lines.join("\n") || body;
}

// カードに選んだ選択肢を書き込む(回答の無いカードはそのまま)
export function markSelected(cards: HearingCard[], answers: CardAnswer[]): HearingCard[] {
  const selected = new Map(answers.map((answer) => [answer.card_id, answer.option]));
  return cards.map((card) =>
    selected.has(card.id) ? { ...card, selected: selected.get(card.id) ?? null } : card,
  );
}
