// 作成：Phase-66-3｜更新：Phase-67(完了後の調整),77-1,77-2
"use client";

// Phase-67(完了後の調整):更新 ── tamagui の H3 を外した
// Phase-77-1:追記 ── ./PasswordSetForm.PasswordSetForm
// Phase-77-2:追記 ── ./GoogleLinkSection.GoogleLinkSection
import { useEffect, useState } from "react";
import { Spinner, Text, YStack } from "tamagui";
import { ApiError } from "@/lib/api/client";
import { getAccount } from "@/features/mypage/api/accountApi";
import type { AccountRead } from "@/features/mypage/api/accountApi";
import { EmailForm } from "./EmailForm";
import { GoogleLinkSection } from "./GoogleLinkSection";
import { PasswordForm } from "./PasswordForm";
import { PasswordSetForm } from "./PasswordSetForm";
import { UserNameForm } from "./UserNameForm";

// Phase-77-1：更新
// // マイページの「アカウント」の節。今の値を読み、3つのフォーム(それぞれ別の API・別の保存)を並べる。
// ↓↓
// マイページの「アカウント」の節。今の値を読み、フォーム(それぞれ別の API・別の保存)を並べる。
// パスワードを持たない(Google だけの)人には、パスワードの変更の代わりに設定を出し、今のパスワードが
// 要るメールの変更は出さない。設定できたら読み直さずに、パスワードを持つ人の表示へ切り替える。
// Phase-77-2:追記
// 最後に Google の連携の枠を置く(解除を出すかはパスワードの有無で決まるので、同じ値を共有する)。
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
          {/* Phase-77-1：更新 */}
          {/* <EmailForm account={account} onUpdated={setAccount} /> */}
          {/* <PasswordForm /> */}
          {/* ↓↓ */}
          {account.has_password ? (
            <>
              <EmailForm account={account} onUpdated={setAccount} />
              <PasswordForm />
            </>
          ) : (
            <PasswordSetForm onPasswordSet={() => setAccount({ ...account, has_password: true })} />
          )}
          {/* Phase-77-2:追記 */}
          <GoogleLinkSection account={account} onUpdated={setAccount} />
        </YStack>
      )}
    </YStack>
  );
}
