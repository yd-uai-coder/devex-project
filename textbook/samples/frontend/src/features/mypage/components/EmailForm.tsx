// 作成：Phase-66-3
"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToastController } from "@tamagui/toast";
import { Controller, useForm } from "react-hook-form";
import { H4, Text } from "tamagui";
import FormGeneral from "@/components/ui/form/FormGeneral";
import InputEmail from "@/components/ui/form/InputEmail";
import InputPassword from "@/components/ui/form/InputPassword";
import { ApiError } from "@/lib/api/client";
import { CURRENT_PASSWORD_MISMATCH, changeEmail } from "@/features/mypage/api/accountApi";
import type { AccountRead } from "@/features/mypage/api/accountApi";
import { emailChangeSchema } from "@/features/mypage/schemas";
import type { EmailChangeValues } from "@/features/mypage/schemas";

type Props = { account: AccountRead; onUpdated: (account: AccountRead) => void };

const DEFAULT_VALUES: EmailChangeValues = { newEmail: "", currentPassword: "" };

// メールアドレスの変更。今のパスワードで確かめて即時に変える(確認メールは送らない)。
// 今のパスワードの不一致(400)と、使われているメール(409)は、それぞれの欄のエラーに出す。
export function EmailForm({ account, onUpdated }: Props) {
  const toast = useToastController();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, handleSubmit, reset, setError } = useForm<EmailChangeValues>({
    resolver: zodResolver(emailChangeSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const handleBeforeSubmit = (): Promise<boolean> =>
    new Promise((resolve) => {
      void handleSubmit(
        async (values) => {
          setSubmitError(null);
          try {
            onUpdated(await changeEmail(values.newEmail, values.currentPassword));
            reset(DEFAULT_VALUES);
            toast.show("メールアドレスを変えました");
            resolve(true);
          } catch (err) {
            if (err instanceof ApiError && err.code === CURRENT_PASSWORD_MISMATCH) {
              setError("currentPassword", { message: "今のパスワードが正しくありません" });
            } else if (err instanceof ApiError && err.status === 409) {
              setError("newEmail", { message: "このメールアドレスは使われています" });
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
    <FormGeneral buttonName="メールアドレスを変える" onBeforeSubmit={handleBeforeSubmit}>
      <H4>メールアドレス</H4>
      <Text fontSize="$3">今のメールアドレス: {account.email}</Text>
      <Controller
        name="newEmail"
        control={control}
        render={({ field, fieldState }) => (
          <InputEmail
            label="新しいメールアドレス"
            width="100%"
            name="newEmail"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            errorMessage={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="currentPassword"
        control={control}
        render={({ field, fieldState }) => (
          <InputPassword
            label="今のパスワード"
            placeholder="今のパスワード"
            width="100%"
            name="currentPassword"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            errorMessage={fieldState.error?.message}
          />
        )}
      />
      {submitError ? (
        <Text role="alert" color="$color9" fontSize="$2">
          {submitError}
        </Text>
      ) : null}
    </FormGeneral>
  );
}
