// 作成：Phase-67-4
import type { LlmCatalog, PurposeSetting } from "@/features/mypage/api/llmSettingsApi";

// マイページのモデル・API キーの節のテストが使う、サーバーの応答の見本
export const CATALOG: LlmCatalog = {
  providers: [
    { provider: "gemini", label: "Gemini" },
    { provider: "claude", label: "Claude" },
  ],
  models: [
    { provider: "gemini", model_id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", note: "Flash の最新" },
    { provider: "gemini", model_id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", note: "Flash-Lite の最新" },
    { provider: "claude", model_id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "低費用" },
    { provider: "claude", model_id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "標準" },
  ],
  purposes: [
    { purpose: "chat", label: "チャット", description: "ヒアリングのチャット", recommend_low_cost: false },
    { purpose: "generation", label: "生成", description: "設計書の生成", recommend_low_cost: false },
    { purpose: "review", label: "レビュー", description: "設計レビュー", recommend_low_cost: false },
    { purpose: "judge", label: "判定", description: "直ったかの確認", recommend_low_cost: true },
  ],
};

function setting(
  purpose: PurposeSetting["purpose"],
  provider: PurposeSetting["provider"],
  model: string,
  overrides: Partial<PurposeSetting> = {},
): PurposeSetting {
  return {
    purpose,
    provider,
    model,
    is_default: true,
    key_missing: false,
    default_provider: provider,
    default_model: model,
    selectable_providers: [provider],
    ...overrides,
  };
}

// 一般ユーザーで、キーを登録していない(どの用途も既定値に従う)
export const DEFAULT_SETTINGS: PurposeSetting[] = [
  setting("chat", "gemini", "gemini-3.5-flash-lite"),
  setting("generation", "gemini", "gemini-3.5-flash-lite"),
  setting("review", "claude", "claude-sonnet-5-5"),
  setting("judge", "claude", "claude-haiku-5-5"),
];

export { setting as purposeSetting };
