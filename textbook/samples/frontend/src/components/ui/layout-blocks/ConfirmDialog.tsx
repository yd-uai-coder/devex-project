// 作成：Phase-15-8
// 写経レベル: 定型 ── LoginRequiredDialog と同じ形の、汎用の確認ダイアログ。
"use client";

import type { ReactNode } from "react";
import { Dialog, XStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";

// 取り消しにくい操作(生成のやり直し・承認のやり直しなど)の前に出す確認ダイアログ。
// 「実行する」を押すと onConfirm、キャンセル・外側のクリック・Esc で onCancel を呼ぶ。
// window.confirm と違い、文言とボタン名を操作に合わせて書ける。
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog modal open={open} onOpenChange={(next) => (next ? undefined : onCancel())}>
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
          <Dialog.Title size="$6">{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          <XStack gap="$3" justifyContent="flex-end">
            <StyledButton theme="gray" aria-label="キャンセル" onPress={onCancel}>
              キャンセル
            </StyledButton>
            <StyledButton aria-label={confirmLabel} onPress={onConfirm}>
              {confirmLabel}
            </StyledButton>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
