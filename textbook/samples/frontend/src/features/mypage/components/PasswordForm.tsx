// 作成：Phase-66-3
"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToastController } from "@tamagui/toast";
import { Controller, useForm } from "react-hook-form";
import { H4, Text } from "tamagui";
import FormGeneral from "@/components/ui/form/FormGeneral";
import InputPassword from "@/components/ui/form/InputPassword";
import { useAuthStore } from "@/components/auth/auth-store";
import { ApiError } from "@/lib/api/client";
import { CURRENT_PASSWORD_MISMATCH, changePassword } from "@/features/mypage/api/accountApi";
import { passwordChangeSchema } from "@/features/mypage/schemas";
import type { PasswordChangeValues } from "@/features/mypage/schemas";

const DEFAULT_VALUES: PasswordChangeValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

const FIELDS: { name: keyof PasswordChangeValues; label: string }[] = [
  { name: "currentPassword", label: "今のパスワード" },
  { name: "newPassword", label: "新しいパスワード" },
  { name: "confirmPassword", label: "新しいパスワード(確認)" },
];

// パスワードの変更。サーバーはほかの端末のログインを切り、この端末には access と refresh を
// 出し直すので、返った access をストアに入れ直す(サイレントリフレッシュも張り直される)。
// ログインの印の cookie はそのまま(この端末はログインを保つ)。
export function PasswordForm() {
  const toast = useToastController();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, handleSubmit, reset, setError } = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const handleBeforeSubmit = (): Promise<boolean> =>
    new Promise((resolve) => {
      void handleSubmit(
        async (values) => {
          setSubmitError(null);
          try {
            const tokens = await changePassword(values.currentPassword, values.newPassword);
            useAuthStore.getState().login(tokens.access_token);
            reset(DEFAULT_VALUES);
            toast.show("パスワードを変えました", { message: "ほかの端末のログインは切れました" });
            resolve(true);
          } catch (err) {
            if (err instanceof ApiError && err.code === CURRENT_PASSWORD_MISMATCH) {
              setError("currentPassword", { message: "今のパスワードが正しくありません" });
            } else {
              setSubmitError(err instanceof ApiError ? err.message : "変更に失敗しました");
            }
            resolve(false);
          }
        },
        () => resolve(false),
      )();
    });

  return (
    <FormGeneral buttonName="パスワードを変える" onBeforeSubmit={handleBeforeSubmit}>
      <H4>パスワード</H4>
      <Text fontSize="$2" color="$color10">
        変えると、ほかの端末ではログインし直しになります。
      </Text>
      {FIELDS.map(({ name, label }) => (
        <Controller
          key={name}
          name={name}
          control={control}
          render={({ field, fieldState }) => (
            <InputPassword
              label={label}
              placeholder={label}
              width="100%"
              name={name}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={fieldState.error?.message}
            />
          )}
        />
      ))}
      {submitError ? (
        <Text role="alert" color="$color9" fontSize="$2">
          {submitError}
        </Text>
      ) : null}
    </FormGeneral>
  );
}
