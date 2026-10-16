// 作成：Phase-66-3｜更新：Phase-67(完了後の調整)
"use client";

// Phase-67(完了後の調整):更新 ── tamagui の H3 を外した
import { useEffect, useState } from "react";
import { Spinner, Text, YStack } from "tamagui";
import { ApiError } from "@/lib/api/client";
import { getAccount } from "@/features/mypage/api/accountApi";
import type { AccountRead } from "@/features/mypage/api/accountApi";
import { EmailForm } from "./EmailForm";
import { PasswordForm } from "./PasswordForm";
import { UserNameForm } from "./UserNameForm";

// マイページの「アカウント」の節。今の値を読み、3つのフォーム(それぞれ別の API・別の保存)を並べる。
export function AccountSection() {
  const [account, setAccount] = useState<AccountRead | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAccount()
      .then((read) => {
        if (active) setAccount(read);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : "アカウントを読み込めませんでした");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <YStack gap="$4">
      {/* Phase-67(完了後の調整)：削除
         <H3>アカウント</H3> */}
      {error ? (
        <Text role="alert" color="$color9">
          {error}
        </Text>
      ) : account === null ? (
        <Spinner />
      ) : (
        <YStack gap="$4">
          <UserNameForm account={account} onUpdated={setAccount} />
          <EmailForm account={account} onUpdated={setAccount} />
          <PasswordForm />
        </YStack>
      )}
    </YStack>
  );
}
