// 作成：Phase-77-1
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
import { setPassword } from "@/features/mypage/api/accountApi";
import { passwordSetSchema } from "@/features/mypage/schemas";
import type { PasswordSetValues } from "@/features/mypage/schemas";

type Props = {
  // 設定できたとき。呼び出し側はパスワードを持つ人の表示(変更・メールの変更・連携の解除)に切り替える
  onPasswordSet: () => void;
};

const DEFAULT_VALUES: PasswordSetValues = { newPassword: "", confirmPassword: "" };

const FIELDS: { name: keyof PasswordSetValues; label: string }[] = [
  { name: "newPassword", label: "新しいパスワード" },
  { name: "confirmPassword", label: "新しいパスワード(確認)" },
];

// パスワードの設定。Google だけで登録した人は、パスワードの「変更」の代わりにこれを使う(今の
// パスワードは求めない)。変更と同じく、サーバーはほかの端末のログインを切り、この端末には出し直すので、
// 返った access をストアに入れ直す。
export function PasswordSetForm({ onPasswordSet }: Props) {
  const toast = useToastController();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<PasswordSetValues>({
    resolver: zodResolver(passwordSetSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const handleBeforeSubmit = (): Promise<boolean> =>
    new Promise((resolve) => {
      void handleSubmit(
        async (values) => {
          setSubmitError(null);
          try {
            const tokens = await setPassword(values.newPassword);
            useAuthStore.getState().login(tokens.access_token);
            reset(DEFAULT_VALUES);
            toast.show("パスワードを設定しました", { message: "ほかの端末のログインは切れました" });
            onPasswordSet();
            resolve(true);
          } catch (err) {
            setSubmitError(err instanceof ApiError ? err.message : "設定に失敗しました");
            resolve(false);
          }
        },
        () => resolve(false),
      )();
    });

  return (
    <FormGeneral buttonName="パスワードを設定する" onBeforeSubmit={handleBeforeSubmit}>
      <H4>パスワード</H4>
      <Text fontSize="$2" color="$color10">
        Google でログインしています。パスワードを設定すると、メールアドレスとパスワードでもログインでき、
        メールアドレスの変更と Google との連携の解除ができるようになります。
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
