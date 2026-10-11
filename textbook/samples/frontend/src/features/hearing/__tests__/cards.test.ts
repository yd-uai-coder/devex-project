// 作成：Phase-35-3
import { describe, expect, it } from "vitest";
import { composeAnswerText, latestAiMessage, markSelected, pendingAnswers } from "../cards";
import type { ChatHistoryEntry, HearingCard } from "@/features/hearing/api/hearingApi";

// SUT: cards.ts の純粋関数 / ドライバ: 各テスト / スタブ不要 ── 副作用も外部依存も無いため

function card(id: string, label: string, selected: number | null = null): HearingCard {
  return {
    id,
    point_key: id,
    label,
    question: "",
    options: [
      { label: `${label}A`, result: "" },
      { label: `${label}B`, result: "" },
    ],
    recommended: 0,
    reason: "",
    selected,
  };
}

describe("cards", () => {
  it("latestAiMessage()は最後のAIの発言を返す(無ければnull)", () => {
    const messages: ChatHistoryEntry[] = [
      { id: "a1", sender: "ai", message: "", created_at: "" },
      { id: "u1", sender: "user", message: "", created_at: "" },
    ];

    expect(latestAiMessage(messages)?.id).toBe("a1");
    expect(latestAiMessage([])).toBeNull();
  });

  it("pendingAnswers()は未回答で選択中のカードだけを、カードの順に回答にする", () => {
    const cards = [card("a", "A"), card("b", "B"), card("done", "済", 0)];

    expect(pendingAnswers(cards, { b: 1, a: 0, done: 1, other: 0 })).toEqual([
      { card_id: "a", option: 0 },
      { card_id: "b", option: 1 },
    ]);
  });

  it("composeAnswerText()はサーバーの発言の本文と同じ形にする", () => {
    const cards = [card("a", "可用性")];

    expect(composeAnswerText(cards, [{ card_id: "a", option: 1 }], " 補足 ")).toBe("【可用性】可用性B\n\n補足");
    expect(composeAnswerText(cards, [{ card_id: "a", option: 0 }], "")).toBe("【可用性】可用性A");
    expect(composeAnswerText(cards, [], "文だけ")).toBe("文だけ");
  });

  it("markSelected()は回答のあるカードに選択を書き込む", () => {
    const marked = markSelected([card("a", "A"), card("b", "B")], [{ card_id: "b", option: 1 }]);

    expect(marked.map((c) => c.selected)).toEqual([null, 1]);
  });
});
