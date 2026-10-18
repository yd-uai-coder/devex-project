// 作成：Phase-76-2｜更新：Phase-77-2
"use client";

import { useState } from "react";
import { Dialog, Text, XStack } from "tamagui";
import InputPassword from "@/components/ui/form/InputPassword";
import { StyledButton } from "@/components/ui/primitives/StyledButton";

type GoogleLinkDialogProps = {
  open: boolean;
  // 連携の確かめが断られたときの文(パスワードが違うなど)。null なら出さない。
  error: string | null;
  submitting: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
  // Phase-77-2:追記
  // 文と確かめのボタンの文言。省略するとログインの画面の文言(同じメールのアカウントとの連携)。
  // マイページの連携は、ログイン中の本人の確かめなので、文言だけを差し替えて使う
  description?: string;
  submitLabel?: string;
};

// Phase-77-2:追記
const LOGIN_DESCRIPTION =
  "このメールアドレスのアカウントがあります。パスワードを入れると、Google アカウントと連携します。" +
  "連携した後は、Google とメールアドレスのどちらでもログインできます。";

// Google でログインしたら、同じメールのアカウントが既にあり、まだ Google と連携していなかったときの
// ダイアログ。そのアカウントのパスワードで本人を確かめてから連携する(確かめずに紐付けると、
// 先にそのメールで登録した他人に入られ続けるため)。
// Phase-77-2：更新
// export function GoogleLinkDialog({ open, error, submitting, onSubmit, onCancel }: GoogleLinkDialogProps) {
// ↓↓
export function GoogleLinkDialog({
  open,
  error,
  submitting,
  onSubmit,
  onCancel,
  description = LOGIN_DESCRIPTION,
  submitLabel = "連携してログイン",
}: GoogleLinkDialogProps) {
  const [password, setPassword] = useState("");

  // 閉じたら入力を残さない(次に開いたとき、前のパスワードが入っていないように)
  const handleCancel = () => {
    setPassword("");
    onCancel();
  };

  return (
    <Dialog modal open={open} onOpenChange={(next) => (next ? undefined : handleCancel())}>
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          transition="quick"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <Dialog.Content
          key="content"
          bordered
          elevate
          gap="$4"
          padding="$5"
          maxWidth={440}
          transition="quick"
          enterStyle={{ opacity: 0, scale: 0.95, y: 10 }}
          exitStyle={{ opacity: 0, scale: 0.95, y: 10 }}
        >
          <Dialog.Title size="$6">Google アカウントと連携</Dialog.Title>
          {/* Phase-77-2：更新 */}
          {/* <Dialog.Description>
                このメールアドレスのアカウントがあります。パスワードを入れると、Google アカウントと連携します。
                連携した後は、Google とメールアドレスのどちらでもログインできます。
              </Dialog.Description> */}
          {/* ↓↓ */}
          <Dialog.Description>{description}</Dialog.Description>
          {/* 後ろのフォームの「パスワード」と見分けられるよう、ラベルを変える */}
          <InputPassword
            label="このアカウントのパスワード"
            width="100%"
            name="linkPassword"
            value={password}
            onChangeText={setPassword}
          />
          {error ? (
            <Text role="alert" color="$color9" fontSize="$2">
              {error}
            </Text>
          ) : null}
          <XStack gap="$3" justifyContent="flex-end">
            <StyledButton theme="gray" aria-label="キャンセル" onPress={handleCancel}>
              キャンセル
            </StyledButton>
            {/* Phase-77-2：更新 */}
            {/* <StyledButton
                  aria-label="連携してログイン"
                  disabled={!password || submitting}
                  onPress={() => onSubmit(password)}
                >
                  連携してログイン */}
            {/* ↓↓ */}
            <StyledButton aria-label={submitLabel} disabled={!password || submitting} onPress={() => onSubmit(password)}>
              {submitLabel}
            </StyledButton>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
