// 作成：Phase-67-4
import type {
  LlmCatalog,
  ModelChoice,
  Provider,
  Purpose,
  PurposeSetting,
} from "@/features/mypage/api/llmSettingsApi";

// モデルの節の編集中の値。用途ごとに「既定に従う」か provider を選び、provider ならモデルを持つ
export type ModelDraftEntry = { choice: "default" | Provider; model: string };
export type ModelDraft = Record<Purpose, ModelDraftEntry>;

// サーバーの今の設定から、編集中の値を作る
export function toDraft(settings: PurposeSetting[]): ModelDraft {
  return Object.fromEntries(
    settings.map((s) => [s.purpose, { choice: s.is_default ? "default" : s.provider, model: s.model }]),
  ) as ModelDraft;
}

// provider で絞ったモデル(カタログの順)
export function modelsOf(catalog: LlmCatalog, provider: Provider): LlmCatalog["models"] {
  return catalog.models.filter((m) => m.provider === provider);
}

// 「既定に従う」・provider を切り替える。provider を替えたら、モデルを替えた先の provider のものにする
// (既定値と同じ provider なら既定のモデル、ほかは一覧の先頭)。同じ provider ならモデルを保つ
export function changeChoice(
  draft: ModelDraft,
  setting: PurposeSetting,
  choice: "default" | Provider,
  catalog: LlmCatalog,
): ModelDraft {
  const current = draft[setting.purpose];
  let model = current.model;
  if (choice === "default") {
    model = setting.default_model;
  } else if (!modelsOf(catalog, choice).some((m) => m.model_id === current.model)) {
    model =
      choice === setting.default_provider
        ? setting.default_model
        : (modelsOf(catalog, choice)[0]?.model_id ?? "");
  }
  return { ...draft, [setting.purpose]: { choice, model } };
}

export function changeModel(draft: ModelDraft, purpose: Purpose, model: string): ModelDraft {
  return { ...draft, [purpose]: { ...draft[purpose], model } };
}

// 保存する選択(既定に従う用途は含めない。サーバーはその用途の行を消す)
export function toChoices(draft: ModelDraft): ModelChoice[] {
  return (Object.entries(draft) as [Purpose, ModelDraftEntry][]).flatMap(([purpose, entry]) =>
    entry.choice === "default" ? [] : [{ purpose, provider: entry.choice, model: entry.model }],
  );
}
