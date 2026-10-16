// 作成：Phase-67-4
// SUT: model-draft(toDraft・changeChoice・changeModel・modelsOf・toChoices)
// ドライバ: 各テスト
// スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため
import { describe, expect, it } from "vitest";
import { CATALOG, DEFAULT_SETTINGS, purposeSetting } from "@/features/mypage/test-utils/llmFixtures";
import { changeChoice, changeModel, modelsOf, toChoices, toDraft } from "../model-draft";

describe("model-draft", () => {
  it("既定に従う用途は default、選んだ用途は provider にする", () => {
    const draft = toDraft([
      ...DEFAULT_SETTINGS.slice(0, 3),
      purposeSetting("judge", "claude", "claude-sonnet-5-5", { is_default: false }),
    ]);

    expect(draft.chat).toEqual({ choice: "default", model: "gemini-3.5-flash-lite" });
    expect(draft.judge).toEqual({ choice: "claude", model: "claude-sonnet-5-5" });
    expect(toChoices(draft)).toEqual([{ purpose: "judge", provider: "claude", model: "claude-sonnet-5-5" }]);
  });

  it("provider を替えると、その provider のモデルに替える", () => {
    const chat = DEFAULT_SETTINGS[0];
    let draft = toDraft(DEFAULT_SETTINGS);

    draft = changeChoice(draft, chat, "gemini", CATALOG);
    expect(draft.chat).toEqual({ choice: "gemini", model: "gemini-3.5-flash-lite" });

    draft = changeChoice(draft, chat, "claude", CATALOG);
    expect(draft.chat.model).toBe("claude-haiku-5-5");

    draft = changeModel(draft, "chat", "claude-sonnet-5-5");
    draft = changeChoice(draft, chat, "claude", CATALOG);
    expect(draft.chat.model).toBe("claude-sonnet-5-5");

    draft = changeChoice(draft, chat, "default", CATALOG);
    expect(draft.chat).toEqual({ choice: "default", model: "gemini-3.5-flash-lite" });
  });

  it("provider で絞ったモデル", () => {
    expect(modelsOf(CATALOG, "claude").map((m) => m.model_id)).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5"]);
  });
});
