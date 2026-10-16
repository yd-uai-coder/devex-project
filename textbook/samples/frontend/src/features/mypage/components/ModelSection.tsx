// 作成：Phase-67-4｜更新：Phase-67(完了後の調整)
"use client";

// Phase-67(完了後の調整):更新 ── tamagui の H3 を外した
import { useEffect, useId, useState } from "react";
import type { CSSProperties } from "react";
import { useToastController } from "@tamagui/toast";
import { H4, Label, RadioGroup, Spinner, Text, XStack, YStack } from "tamagui";
import radioStyles from "@/components/ui/form/RadioGroupWithLabel.module.css";
import { RadioGroupItem } from "@/components/ui/primitives/RadioGroupItem";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import { ApiError } from "@/lib/api/client";
import { getLlmCatalog, getModelSettings, updateModelSettings } from "@/features/mypage/api/llmSettingsApi";
import type { LlmCatalog, Provider, PurposeSetting } from "@/features/mypage/api/llmSettingsApi";
import { changeChoice, changeModel, modelsOf, toChoices, toDraft } from "@/features/mypage/model-draft";
import type { ModelDraft } from "@/features/mypage/model-draft";

// 背景はテーマの色にする(transparent だと、ブラウザが描く選択肢のポップアップがダークモードで読めない)
const SELECT: CSSProperties = {
  font: "inherit",
  padding: "6px 8px",
  color: "var(--color)",
  background: "var(--background)",
  border: "1px solid var(--color7)",
  borderRadius: 6,
  width: "100%",
  minWidth: 0,
};
const OPTION: CSSProperties = { background: "var(--background)", color: "var(--color)" };

// マイページの「モデル」の節。用途(チャット・生成・レビュー・判定)ごとに、既定に従うか、AI
// (Gemini・Claude)とモデルを選び、まとめて保存する。選べない AI(自分のキーが無い)は無効にして
// Phase-67(完了後の調整)：更新
// // 理由を出す。reloadKey が変わったら(API キーを登録・削除したら)読み直す。
// export function ModelSection({ reloadKey = 0 }: { reloadKey?: number }) {
// ↓↓
// 理由を出す。開くたびに(マウントのたびに)読むので、API キーの節での変更も反映される。
export function ModelSection() {
  const toast = useToastController();
  const [catalog, setCatalog] = useState<LlmCatalog | null>(null);
  const [settings, setSettings] = useState<PurposeSetting[] | null>(null);
  const [draft, setDraft] = useState<ModelDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getLlmCatalog(), getModelSettings()])
      .then(([readCatalog, readSettings]) => {
        if (!active) return;
        setCatalog(readCatalog);
        setSettings(readSettings);
        setDraft(toDraft(readSettings));
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : "モデルの設定を読み込めませんでした");
      });
    return () => {
      active = false;
    };
  // Phase-67(完了後の調整)：更新
  // }, [reloadKey]);
  // ↓↓
  }, []);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await updateModelSettings(toChoices(draft));
      setSettings(saved);
      setDraft(toDraft(saved));
      toast.show("モデルを保存しました");
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <YStack gap="$4">
      {/* Phase-67(完了後の調整)：削除
         <H3>モデル</H3> */}
      <Text fontSize="$3">
        用途ごとに使う AI とモデルを選びます。既定に従う用途は、システムの既定のモデルを使います。参考資料(PDF)の取り込みは、いつも
        Gemini で読みます。
      </Text>
      {error ? (
        <Text role="alert" color="$color9">
          {error}
        </Text>
      ) : catalog === null || settings === null || draft === null ? (
        <Spinner />
      ) : (
        <YStack gap="$4">
          {settings.map((setting) => (
            <PurposeRow
              key={setting.purpose}
              catalog={catalog}
              setting={setting}
              draft={draft}
              onChange={setDraft}
            />
          ))}
          {saveError ? (
            <Text role="alert" color="$color9" fontSize="$2">
              {saveError}
            </Text>
          ) : null}
          <XStack>
            <StyledButton disabled={saving} onPress={() => void save()}>
              {saving ? "保存中..." : "モデルを保存する"}
            </StyledButton>
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}

function PurposeRow({
  catalog,
  setting,
  draft,
  onChange,
}: {
  catalog: LlmCatalog;
  setting: PurposeSetting;
  draft: ModelDraft;
  onChange: (draft: ModelDraft) => void;
}) {
  const id = useId();
  const info = catalog.purposes.find((p) => p.purpose === setting.purpose);
  const label = info?.label ?? setting.purpose;
  const entry = draft[setting.purpose];
  const providerLabel = (provider: Provider) =>
    catalog.providers.find((p) => p.provider === provider)?.label ?? provider;
  const modelLabel = (modelId: string) =>
    catalog.models.find((m) => m.model_id === modelId)?.label ?? modelId;
  const defaultText = `既定に従う(${providerLabel(setting.default_provider)} / ${modelLabel(setting.default_model)})`;
  const items: { value: "default" | Provider; label: string; disabled: boolean }[] = [
    { value: "default", label: defaultText, disabled: false },
    ...catalog.providers.map((p) => ({
      value: p.provider,
      label: p.label,
      disabled: !setting.selectable_providers.includes(p.provider),
    })),
  ];
  const locked = items.filter((item) => item.disabled).map((item) => item.label);

  return (
    <YStack gap="$2" borderWidth={1} borderColor="$borderColor" borderRadius="$4" padding="$3">
      <H4 id={`${id}-label`}>{label}</H4>
      {info ? <Text fontSize="$2">{info.description}</Text> : null}
      {info?.recommend_low_cost ? (
        <Text fontSize="$2" color="$orange10">
          呼ぶ回数が多いので、費用の低いモデル(Claude Haiku など)を推奨します。
        </Text>
      ) : null}
      <XStack className={radioStyles.radioGroupWrap} flexShrink={1} minWidth={0}>
        <RadioGroup
          aria-labelledby={`${id}-label`}
          minWidth={0}
          value={entry.choice}
          onValueChange={(next) => onChange(changeChoice(draft, setting, next as "default" | Provider, catalog))}
        >
          <XStack alignItems="center" gap="$4" flexWrap="wrap" flexShrink={1} minWidth={0}>
            {items.map((item) => (
              <XStack
                key={item.value}
                alignItems="center"
                gap="$2"
                flexShrink={1}
                minWidth={0}
                opacity={item.disabled ? 0.5 : 1}
              >
                <RadioGroupItem value={item.value} id={`${id}-${item.value}`} disabled={item.disabled} />
                {/* 既定の文言は長いので、狭い画面では折り返す */}
                <Label htmlFor={`${id}-${item.value}`} flexShrink={1} minWidth={0} lineHeight="$2">
                  {item.label}
                </Label>
              </XStack>
            ))}
          </XStack>
        </RadioGroup>
      </XStack>
      {entry.choice === "default" ? null : (
        <XStack alignItems="center" gap="$3">
          <Label htmlFor={`${id}-model`} flexShrink={0}>
            モデル
          </Label>
          <XStack flex={1} minWidth={0}>
            <select
              id={`${id}-model`}
              style={SELECT}
              value={entry.model}
              onChange={(e) => onChange(changeModel(draft, setting.purpose, e.target.value))}
            >
              {modelsOf(catalog, entry.choice).map((m) => (
                <option key={m.model_id} value={m.model_id} style={OPTION}>
                  {`${m.label} ── ${m.note}`}
                </option>
              ))}
            </select>
          </XStack>
        </XStack>
      )}
      {locked.length > 0 ? (
        <Text fontSize="$2" color="$color10">
          {/* Phase-67(完了後の調整)：更新
             {`${locked.join("・")} を選ぶには、下の「API キー」で ${locked.join("・")} のキーを登録してください。`}
             ↓↓ */}
          {`${locked.join("・")} を選ぶには、「API キー」の節で ${locked.join("・")} のキーを登録してください。`}
        </Text>
      ) : null}
      {setting.key_missing ? (
        <Text role="status" fontSize="$2" color="$orange10">
          {`${providerLabel(setting.provider)} のキーが無いので、使うときは既定(${modelLabel(setting.default_model)})に従います。`}
        </Text>
      ) : null}
    </YStack>
  );
}
