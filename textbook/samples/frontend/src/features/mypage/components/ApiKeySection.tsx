// 作成：Phase-67-4｜更新：Phase-67(完了後の調整)
"use client";

// Phase-67(完了後の調整):更新 ── tamagui の H3 を外した
import { useEffect, useState } from "react";
import { useToastController } from "@tamagui/toast";
import { H4, Spinner, Text, XStack, YStack } from "tamagui";
import InputPassword from "@/components/ui/form/InputPassword";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import { ApiError } from "@/lib/api/client";
import {
  API_KEY_INVALID,
  deleteApiKey,
  getApiKeys,
  registerApiKey,
} from "@/features/mypage/api/llmSettingsApi";
import type { ApiKeyRead, ApiKeysRead, Provider } from "@/features/mypage/api/llmSettingsApi";

const PROVIDERS: { provider: Provider; label: string }[] = [
  { provider: "gemini", label: "Gemini" },
  { provider: "claude", label: "Claude" },
];

// マイページの「API キー」の節。provider ごとに1つ登録し、画面には末尾の4文字だけを出す。
// 保存のときにサーバーがキーを確かめる(無効なら欄のエラー、確かめられないときはメッセージ)。
// Phase-67(完了後の調整)：更新
// // 登録・削除したら onChanged を呼ぶ(モデルの節が選べる AI を読み直す)。
// export function ApiKeySection({ onChanged }: { onChanged?: () => void }) {
// ↓↓
// 登録・削除したら一覧を読み直す(モデルの節は開くたびに読むので、選べる AI もそこで新しくなる)。
export function ApiKeySection() {
  const [read, setRead] = useState<ApiKeysRead | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    getApiKeys()
      .then(setRead)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "APIキーを読み込めませんでした");
      });

  useEffect(() => {
    void load();
  }, []);

  // Phase-67(完了後の調整)：削除
  // const changed = () => {
  //   void load();
  //   onChanged?.();
  // };
  //
  return (
    <YStack gap="$4">
      {/* Phase-67(完了後の調整)：削除
         <H3>API キー</H3> */}
      <Text fontSize="$3">
        自分の API キーを登録すると、その AI のモデルを選べます。登録していない AI は、システムの既定のキーで動く範囲(チャットと生成は
        Gemini)だけを使えます。キーは暗号化して保存し、画面には末尾の4文字だけを出します。
      </Text>
      {error ? (
        <Text role="alert" color="$color9">
          {error}
        </Text>
      ) : read === null ? (
        <Spinner />
      ) : (
        <YStack gap="$4">
          {read.encryption_available ? null : (
            <Text role="alert" color="$color9" fontSize="$3">
              サーバーに暗号の鍵が設定されていないため、いまは API キーを登録できません。既定のキーでの利用は続けられます。
            </Text>
          )}
          {PROVIDERS.map(({ provider, label }) => (
            <ProviderKeyForm
              key={provider}
              provider={provider}
              label={label}
              current={read.keys.find((k) => k.provider === provider) ?? null}
              disabled={!read.encryption_available}
              // Phase-67(完了後の調整)：更新
              // onChanged={changed}
              // ↓↓
              onChanged={() => void load()}
            />
          ))}
        </YStack>
      )}
    </YStack>
  );
}

function ProviderKeyForm({
  provider,
  label,
  current,
  disabled,
  onChanged,
}: {
  provider: Provider;
  label: string;
  current: ApiKeyRead | null;
  disabled: boolean;
  onChanged: () => void;
}) {
  const toast = useToastController();
  const [value, setValue] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const save = async () => {
    setFieldError(null);
    setMessage(null);
    if (value.trim().length < 8) {
      setFieldError("APIキーを入力してください");
      return;
    }
    setBusy(true);
    try {
      await registerApiKey(provider, value.trim());
      setValue("");
      toast.show(`${label} の API キーを登録しました`);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.code === API_KEY_INVALID) {
        setFieldError("APIキーが正しくありません");
      } else {
        setMessage(err instanceof ApiError ? err.message : "登録に失敗しました");
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setConfirming(false);
    setMessage(null);
    setBusy(true);
    try {
      await deleteApiKey(provider);
      toast.show(`${label} の API キーを削除しました`);
      onChanged();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <YStack gap="$2" borderWidth={1} borderColor="$borderColor" borderRadius="$4" padding="$3">
      <H4>{label}</H4>
      <Text fontSize="$3">{current ? `登録済み(末尾 …${current.key_hint})` : "未登録"}</Text>
      {current?.needs_reregister ? (
        <Text role="status" fontSize="$2" color="$orange10">
          サーバーの暗号の鍵が替わったため、このキーを読めません。登録し直してください。
        </Text>
      ) : null}
      <InputPassword
        label={`${label} の API キー`}
        placeholder={current ? "新しいキーで置き換える" : "API キー"}
        width="100%"
        name={`${provider}-api-key`}
        value={value}
        onChangeText={setValue}
        errorMessage={fieldError ?? undefined}
        status={disabled ? "disabled" : "default"}
      />
      {message ? (
        <Text role="alert" color="$color9" fontSize="$2">
          {message}
        </Text>
      ) : null}
      <XStack gap="$3">
        <StyledButton disabled={disabled || busy} onPress={() => void save()}>
          {busy ? "確かめています..." : `${label} のキーを保存する`}
        </StyledButton>
        {current ? (
          <StyledButton theme="red" disabled={busy} onPress={() => setConfirming(true)}>
            削除
          </StyledButton>
        ) : null}
      </XStack>
      <ConfirmDialog
        open={confirming}
        title={`${label} の API キーを削除しますか`}
        description={`削除すると、${label} を選んだ用途は既定のモデルに従います(選択は残ります)。`}
        confirmLabel="削除する"
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      />
    </YStack>
  );
}
