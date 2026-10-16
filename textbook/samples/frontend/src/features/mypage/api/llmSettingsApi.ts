// 作成：Phase-67-4
import { apiFetch } from "@/lib/api/client";

// マイページの「モデル」と「API キー」の節が使う API(devex-api の /llm/catalog・/users/me/models・
// /users/me/api-keys)。キー本体はサーバーから返らない(末尾の4文字だけ)。

export type Provider = "gemini" | "claude";
export type Purpose = "chat" | "generation" | "review" | "judge";

export type LlmCatalog = {
  providers: { provider: Provider; label: string }[];
  models: { provider: Provider; model_id: string; label: string; note: string }[];
  purposes: { purpose: Purpose; label: string; description: string; recommend_low_cost: boolean }[];
};

// 用途1つの今の設定。is_default は既定値に従っているか、key_missing は選んだ provider のキーが無く
// 使うときは既定値に従うこと、selectable_providers はこの用途に選べる provider
export type PurposeSetting = {
  purpose: Purpose;
  provider: Provider;
  model: string;
  is_default: boolean;
  key_missing: boolean;
  default_provider: Provider;
  default_model: string;
  selectable_providers: Provider[];
};

export type ModelChoice = { purpose: Purpose; provider: Provider; model: string };

export type ApiKeyRead = { provider: Provider; key_hint: string; needs_reregister: boolean };
export type ApiKeysRead = { encryption_available: boolean; keys: ApiKeyRead[] };

// エラーの code(欄やメッセージの出し分けに使う)
export const API_KEY_INVALID = "API_KEY_INVALID";
export const API_KEY_CHECK_FAILED = "API_KEY_CHECK_FAILED";
export const ENCRYPTION_UNAVAILABLE = "ENCRYPTION_UNAVAILABLE";
export const MODEL_PROVIDER_KEY_REQUIRED = "MODEL_PROVIDER_KEY_REQUIRED";

export function getLlmCatalog(): Promise<LlmCatalog> {
  return apiFetch<LlmCatalog>("/api/v1/llm/catalog");
}

export async function getModelSettings(): Promise<PurposeSetting[]> {
  return (await apiFetch<{ settings: PurposeSetting[] }>("/api/v1/users/me/models")).settings;
}

// 選択の全体を置き換える(含めない用途は既定値に従う)
export async function updateModelSettings(choices: ModelChoice[]): Promise<PurposeSetting[]> {
  const read = await apiFetch<{ settings: PurposeSetting[] }>("/api/v1/users/me/models", {
    method: "PUT",
    body: JSON.stringify({ choices }),
  });
  return read.settings;
}

export function getApiKeys(): Promise<ApiKeysRead> {
  return apiFetch<ApiKeysRead>("/api/v1/users/me/api-keys");
}

// サーバーは保存の前にキーを確かめる(無効は 422、確かめられないときは 502、鍵が無ければ 503)
export function registerApiKey(provider: Provider, apiKey: string): Promise<ApiKeyRead> {
  return apiFetch<ApiKeyRead>(`/api/v1/users/me/api-keys/${provider}`, {
    method: "PUT",
    body: JSON.stringify({ api_key: apiKey }),
  });
}

export function deleteApiKey(provider: Provider): Promise<void> {
  return apiFetch<void>(`/api/v1/users/me/api-keys/${provider}`, { method: "DELETE" });
}
