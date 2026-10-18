// 作成：Phase-77-2
"use client";

import { useState } from "react";
import { useToastController } from "@tamagui/toast";
import { H4, Text, YStack } from "tamagui";
import { useAuthStore } from "@/components/auth/auth-store";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import { ApiError } from "@/lib/api/client";
import { GoogleLinkDialog } from "@/features/auth/components/GoogleLinkDialog";
import { GoogleSignInButton } from "@/features/auth/components/GoogleSignInButton";
import { googleClientId, isFakeGoogle } from "@/features/auth/google-config";
import { CURRENT_PASSWORD_MISMATCH, linkGoogle, unlinkGoogle } from "@/features/mypage/api/accountApi";
import type { AccountRead } from "@/features/mypage/api/accountApi";

type Props = { account: AccountRead; onUpdated: (account: AccountRead) => void };

const LINK_DESCRIPTION =
  "連携するには、このアカウントのパスワードを入れてください。" +
  "連携した後は、Google とメールアドレスのどちらでもログインできます。";

function errorMessage(err: unknown, fallback: string): string {
  // API の detail は日本語の文なので、そのまま出す
  return err instanceof ApiError ? err.message : fallback;
}

// マイページの「Google の連携」。連携していなければ Google のボタンで credential を受け、今のパスワードを
// ダイアログで聞いてから連携する(盗まれたセッションで他人の Google を足させないため)。連携していれば
// 解除できるが、パスワードがあるときだけ(どちらでもログインできなくなるのを防ぐ)。解除はほかの端末の
// ログインを切るので、確認のダイアログで伝える。
export function GoogleLinkSection({ account, onUpdated }: Props) {
  const toast = useToastController();
  const [error, setError] = useState<string | null>(null);
  const [pendingCredential, setPendingCredential] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);

  const handleCredential = (credential: string) => {
    setError(null);
    setLinkError(null);
    setPendingCredential(credential);
  };

  const handleLink = async (password: string) => {
    if (pendingCredential === null) return;
    setBusy(true);
    setLinkError(null);
    try {
      onUpdated(await linkGoogle(pendingCredential, password));
      setPendingCredential(null);
      toast.show("Google アカウントと連携しました");
    } catch (err) {
      if (err instanceof ApiError && err.code === CURRENT_PASSWORD_MISMATCH) {
        // パスワードの打ち直しで済むので、ダイアログを開いたまま理由を出す
        setLinkError("今のパスワードが正しくありません");
      } else {
        // 別の Google と連携済みなどは、やり直しても変わらないので、ダイアログを閉じて枠に出す
        setPendingCredential(null);
        setError(errorMessage(err, "連携に失敗しました"));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async () => {
    setConfirmingUnlink(false);
    setError(null);
    setBusy(true);
    try {
      const tokens = await unlinkGoogle();
      useAuthStore.getState().login(tokens.access_token);
      onUpdated({ ...account, google_linked: false });
      toast.show("Google との連携を解除しました", { message: "ほかの端末のログインは切れました" });
    } catch (err) {
      setError(errorMessage(err, "解除に失敗しました"));
    } finally {
      setBusy(false);
    }
  };

  // クライアント ID が無い環境では Google のボタンが出ないので、連携できないことを文で伝える
  const googleAvailable = isFakeGoogle() || googleClientId() !== null;

  return (
    <YStack gap="$2" borderWidth={1} borderRadius="$4" padding="$6">
      <H4>Google の連携</H4>
      {account.google_linked ? (
        <>
          <Text fontSize="$3">Google アカウントと連携しています。</Text>
          {account.has_password ? (
            <StyledButton
              theme="red"
              alignSelf="flex-start"
              disabled={busy}
              onPress={() => setConfirmingUnlink(true)}
            >
              連携を解除する
            </StyledButton>
          ) : (
            <Text fontSize="$2" color="$color10">
              パスワードを設定すると、連携を解除できます。
            </Text>
          )}
        </>
      ) : googleAvailable ? (
        <>
          <Text fontSize="$2" color="$color10">
            連携すると、Google アカウントでもログインできます。
          </Text>
          <GoogleSignInButton
            text="continue_with"
            onCredential={handleCredential}
            onError={() => setError("Google でのログインを完了できませんでした")}
          />
        </>
      ) : (
        <Text fontSize="$2" color="$color10">
          この環境では Google との連携を使えません。
        </Text>
      )}
      {error ? (
        <Text role="alert" color="$color9" fontSize="$2">
          {error}
        </Text>
      ) : null}
      {/* credential ごとに作り直し、成功・衝突で閉じた後に開き直しても前のパスワードを残さない
          (ダイアログはキャンセルのときだけ入力を消す。ログインの画面は成功で画面を移るので要らなかった) */}
      <GoogleLinkDialog
        key={pendingCredential ?? "closed"}
        open={pendingCredential !== null}
        error={linkError}
        submitting={busy}
        description={LINK_DESCRIPTION}
        submitLabel="連携する"
        onSubmit={(password) => void handleLink(password)}
        onCancel={() => setPendingCredential(null)}
      />
      <ConfirmDialog
        open={confirmingUnlink}
        title="Google との連携を解除しますか"
        description="解除すると、ほかの端末ではログインし直しになります。この後は、メールアドレスとパスワードでログインします。"
        confirmLabel="解除する"
        onConfirm={() => void handleUnlink()}
        onCancel={() => setConfirmingUnlink(false)}
      />
    </YStack>
  );
}
