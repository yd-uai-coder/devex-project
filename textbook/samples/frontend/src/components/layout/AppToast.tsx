// 作成：Phase-64-3
"use client";

import type { ReactNode } from "react";
import { Toast, ToastProvider, ToastViewport, useToastState } from "@tamagui/toast";
import { YStack } from "tamagui";

// 操作の完了の知らせ(トースト)の置き場。ルート(providers.tsx)に置くので、画面を移っても消えない
// (文書の画面で削除してダッシュボードへ戻っても見える)。知らせるときは useToastController().show(題名)。
// 同じパッケージの v2 の Toaster は、tamagui 2.6.0 の web で accessibilityLabel を DOM に渡して
// React の警告になるため、従来の ToastProvider・ToastViewport を使う。
function CurrentToast() {
  const toast = useToastState();
  if (!toast || toast.isHandledNatively) return null;
  return (
    <Toast
      key={toast.id}
      duration={toast.duration}
      viewportName={toast.viewportName}
      backgroundColor="$color2"
      borderWidth={1}
      borderColor="$color7"
      borderRadius="$4"
      paddingHorizontal="$4"
      paddingVertical="$3"
      transition="quick"
      enterStyle={{ opacity: 0, scale: 0.95, y: 10 }}
      exitStyle={{ opacity: 0, scale: 0.95, y: 10 }}
      opacity={1}
      scale={1}
      y={0}
    >
      <YStack gap="$1">
        <Toast.Title fontSize="$4" fontWeight="600">
          {toast.title}
        </Toast.Title>
        {toast.message ? <Toast.Description>{toast.message}</Toast.Description> : null}
      </YStack>
    </Toast>
  );
}

export function AppToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProvider duration={4000} swipeDirection="right" label="通知">
      {children}
      <CurrentToast />
      <ToastViewport position="fixed" bottom="$6" right="$4" zIndex={100000} />
    </ToastProvider>
  );
}
