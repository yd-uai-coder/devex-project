// 作成：Phase-66-3
"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToastController } from "@tamagui/toast";
import { Controller, useForm } from "react-hook-form";
import { H4, Text } from "tamagui";
import FormGeneral from "@/components/ui/form/FormGeneral";
import InputSimpleText from "@/components/ui/form/InputSimpleText";
import { ApiError } from "@/lib/api/client";
import { updateUserName } from "@/features/mypage/api/accountApi";
import type { AccountRead } from "@/features/mypage/api/accountApi";
import { userNameSchema } from "@/features/mypage/schemas";
import type { UserNameValues } from "@/features/mypage/schemas";

type Props = { account: AccountRead; onUpdated: (account: AccountRead) => void };

// ユーザーネームの変更(確かめは要らない)
export function UserNameForm({ account, onUpdated }: Props) {
  const toast = useToastController();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, handleSubmit } = useForm<UserNameValues>({
    resolver: zodResolver(userNameSchema),
    defaultValues: { userName: account.user_name ?? "" },
  });

  // FormGeneral は「送ってよいか」を真偽で受け取る。検証と API の呼び出しをここで行う
  const handleBeforeSubmit = (): Promise<boolean> =>
    new Promise((resolve) => {
      void handleSubmit(
        async (values) => {
          setSubmitError(null);
          try {
            onUpdated(await updateUserName(values.userName));
            toast.show("ユーザーネームを変えました");
            resolve(true);
          } catch (err) {
            setSubmitError(err instanceof ApiError ? err.message : "変更に失敗しました");
            resolve(false);
          }
        },
        () => resolve(false),
      )();
    });

  return (
    <FormGeneral buttonName="ユーザーネームを変える" onBeforeSubmit={handleBeforeSubmit}>
      <H4>ユーザーネーム</H4>
      <Controller
        name="userName"
        control={control}
        render={({ field, fieldState }) => (
          <InputSimpleText
            label="ユーザーネーム"
            width="100%"
            name="userName"
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
