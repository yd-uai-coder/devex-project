// 作成：Phase-76-2
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Separator, Text, XStack, YStack } from "tamagui";
import { apiFetch, ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/components/auth/auth-store";
import type { AccessTokenResponse } from "@/components/auth/auth-store";
import { googleClientId, isFakeGoogle } from "@/features/auth/google-config";
import { safeRedirectPath } from "@/lib/redirect-path";
import { GoogleLinkDialog } from "./GoogleLinkDialog";
import { GoogleSignInButton } from "./GoogleSignInButton";
import type { GoogleButtonText } from "./GoogleSignInButton";

const LINK_REQUIRED = "GOOGLE_LINK_REQUIRED";

function errorMessage(err: unknown, fallback: string): string {
  // API の detail は日本語の文なので、そのまま出す
  return err instanceof ApiError ? err.message : fallback;
}

// ログイン・登録の画面の「または Google で」の部分。Google でのログインと登録は同じ API
// (POST /auth/google。初めての Google アカウントならそのまま登録)なので、両方の画面で同じ部品を使い、
// ボタンの文言(text)だけを変える。成功したら、メールでのログインと同じく戻り先かダッシュボードへ。
// 同じメールのアカウントが連携していなければ、credential を持ったままパスワードを聞いて連携する。
export function GoogleLoginSection({ text }: { text: GoogleButtonText }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  // 連携の確かめのダイアログで使う。ID トークンはもう一度 API に送る(サーバーは状態を持たない)
  const [pendingCredential, setPendingCredential] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  // ボタンが出ない環境(クライアント ID が無い)では、区切りごと出さない
  if (!isFakeGoogle() && !googleClientId()) return null;

  const finishLogin = (tokens: AccessTokenResponse) => {
    useAuthStore.getState().login(tokens.access_token);
    router.push(safeRedirectPath(searchParams.get("redirect")) ?? "/dashboard");
  };

  const handleCredential = async (credential: string) => {
    setError(null);
    try {
      const tokens = await apiFetch<AccessTokenResponse>("/api/v1/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential }),
      });
      finishLogin(tokens);
    } catch (err) {
      if (err instanceof ApiError && err.code === LINK_REQUIRED) {
        setLinkError(null);
        setPendingCredential(credential);
        return;
      }
      setError(errorMessage(err, "Google でのログインに失敗しました"));
    }
  };

  const handleLink = async (password: string) => {
    if (!pendingCredential) return;
    setLinking(true);
    setLinkError(null);
    try {
      const tokens = await apiFetch<AccessTokenResponse>("/api/v1/auth/google/link", {
        method: "POST",
        body: JSON.stringify({ credential: pendingCredential, password }),
      });
      setPendingCredential(null);
      finishLogin(tokens);
    } catch (err) {
      setLinkError(errorMessage(err, "連携に失敗しました"));
    } finally {
      setLinking(false);
    }
  };

  return (
    <YStack gap="$3" alignItems="center" width="100%" marginTop="$2">
      <XStack alignItems="center" gap="$3" width="100%">
        <Separator />
        <Text fontSize="$2" color="$color10">
          または
        </Text>
        <Separator />
      </XStack>
      <GoogleSignInButton
        text={text}
        onCredential={(credential) => void handleCredential(credential)}
        onError={() => setError("Google でのログインを完了できませんでした")}
      />
      {error ? (
        <Text role="alert" color="$color9" fontSize="$2">
          {error}
        </Text>
      ) : null}
      <GoogleLinkDialog
        open={pendingCredential !== null}
        error={linkError}
        submitting={linking}
        onSubmit={(password) => void handleLink(password)}
        onCancel={() => setPendingCredential(null)}
      />
    </YStack>
  );
}
