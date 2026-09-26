// 作成：Phase-3-2
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Text } from "tamagui";
import FormGeneral from "@/components/ui/form/FormGeneral";
import InputEmail from "@/components/ui/form/InputEmail";
import InputPassword from "@/components/ui/form/InputPassword";
import { apiFetch, ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/components/auth/auth-store";
import type { AccessTokenResponse } from "@/components/auth/auth-store";
import { loginSchema } from "@/features/auth/schemas";
import type { LoginValues } from "@/features/auth/schemas";

const DEFAULT_VALUES: LoginValues = { email: "", password: "" };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // FormGeneralはonBeforeSubmitがtrueを返した場合のみ「送信済み」の演出(スピナー→
  // onSubmitted)に進む設計のため、実際のログインAPI呼び出しと成否判定はここで行う。
  const handleBeforeSubmit = (): Promise<boolean> =>
    new Promise((resolve) => {
      void handleSubmit(
        async (values) => {
          setSubmitError(null);
          try {
            const tokens = await apiFetch<AccessTokenResponse>("/api/v1/auth/login", {
              method: "POST",
              body: JSON.stringify(values),
            });
            useAuthStore.getState().login(tokens.access_token);
            resolve(true);
          } catch (err) {
            setSubmitError(err instanceof ApiError ? err.message : "ログインに失敗しました");
            resolve(false);
          }
        },
        () => resolve(false),
      )();
    });

  const handleSubmitted = () => {
    const redirect = searchParams.get("redirect");
    router.push(redirect && redirect.startsWith("/") ? redirect : "/dashboard");
  };

  return (
    <FormGeneral buttonName="ログイン" onBeforeSubmit={handleBeforeSubmit} onSubmitted={handleSubmitted}>
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
