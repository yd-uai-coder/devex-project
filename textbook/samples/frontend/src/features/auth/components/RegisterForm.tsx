// 作成：Phase-3-2
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Text } from "tamagui";
import FormGeneral from "@/components/ui/form/FormGeneral";
import InputEmail from "@/components/ui/form/InputEmail";
import InputPassword from "@/components/ui/form/InputPassword";
import InputSimpleText from "@/components/ui/form/InputSimpleText";
import { apiFetch, ApiError } from "@/lib/api/client";
import { registerSchema } from "@/features/auth/schemas";
import type { RegisterValues } from "@/features/auth/schemas";

const DEFAULT_VALUES: RegisterValues = { fullName: "", email: "", password: "" };

export function RegisterForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // 登録APIはユーザー情報のみを返しトークンは発行しない(POST /auth/registerの仕様)ため、
  // 登録後は自動ログインせず/loginへ誘導する(ログインの成否判定を1箇所に閉じるため)。
  const handleBeforeSubmit = (): Promise<boolean> =>
    new Promise((resolve) => {
      void handleSubmit(
        async (values) => {
          setSubmitError(null);
          try {
            await apiFetch("/api/v1/auth/register", {
              method: "POST",
              body: JSON.stringify({
                email: values.email,
                password: values.password,
                full_name: values.fullName,
              }),
            });
            resolve(true);
          } catch (err) {
            setSubmitError(err instanceof ApiError ? err.message : "登録に失敗しました");
            resolve(false);
          }
        },
        () => resolve(false),
      )();
    });

  const handleSubmitted = () => {
    router.push("/login");
  };

  return (
    <FormGeneral buttonName="登録する" onBeforeSubmit={handleBeforeSubmit} onSubmitted={handleSubmitted}>
      <Controller
        name="fullName"
        control={control}
        render={({ field, fieldState }) => (
          <InputSimpleText
            label="氏名"
            width="100%"
            name="fullName"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            errorMessage={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="email"
        control={control}
        render={({ field, fieldState }) => (
          <InputEmail
            width="100%"
            name="email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            errorMessage={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="password"
        control={control}
        render={({ field, fieldState }) => (
          <InputPassword
            width="100%"
            name="password"
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
