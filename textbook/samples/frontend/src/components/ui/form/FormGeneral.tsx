// 更新：Phase-3-2
"use client";

import { useState } from "react";
import {
  Button,
  Form,
  Spinner,
  AnimatePresence,
  YStack,
} from 'tamagui'
import type { ButtonProps } from 'tamagui'

type FormGeneralProps = {
  buttonName?: string
  buttonProps?: ButtonProps
  children?: React.ReactNode
  onBeforeSubmit?: () => boolean | Promise<boolean>
  onSubmitted?: () => void
  // Phase-3-2:追記 ── デモ目的で、onBeforeSubmit完了後もこの時間(ms)だけ追加でスピナーを
  // 表示し続ける。実運用のフォーム(ログイン等)では指定せず、スピナーを実際の非同期処理の
  // 完了にそのまま連動させる(未指定時は0 = 追加待機なし)。
  demoDelayMs?: number
}

export default function FormGeneral({
  buttonName = "送信",
  buttonProps,
  children,
  onBeforeSubmit,
  onSubmitted,
  demoDelayMs = 0,
}: FormGeneralProps){

  // Phase-3-2：更新(送信ボタンから固定2秒後にonSubmittedを呼ぶ、という元の実装は
  // 実際の非同期処理(ログインAPI呼び出し等)の完了と無関係に2秒待たせてしまい、
  // 実運用のフォームには不適切だった。onBeforeSubmit()自体の完了に素直に連動させ、
  // デモ用の固定待機はdemoDelayMsとして明示的なopt-inにした)
  // const [status, setStatus] = useState<'off' | 'submitting' | 'submitted'>('off')
  // //デモ用：送信ボタンから2秒間スピナーを表示する
  // useEffect(() => {
  //   if (status === 'submitting') {
  //     const timer = setTimeout(() => {
  //       setStatus('off')
  //       onSubmitted?.()
  //     }, 2000)
  //     return () => {
  //       clearTimeout(timer)
  //     }
  //   }
  // }, [status, onSubmitted])
  //
  // return (
  //   <Form
  //     gap="$2"
  //     onSubmit={async () => {
  //       if (onBeforeSubmit) {
  //         const ok = await onBeforeSubmit()
  //         if (!ok) return
  //       }
  //       setStatus('submitting')
  //     }}
  //     borderWidth={1}
  //     borderRadius="$4"
  //     padding="$6"
  //   >
  // ↓↓
  const [status, setStatus] = useState<'off' | 'submitting' | 'submitted'>('off')

  return (
    <Form
      gap="$2"
      onSubmit={async () => {
        setStatus('submitting')
        const ok = onBeforeSubmit ? await onBeforeSubmit() : true
        if (!ok) {
          setStatus('off')
          return
        }
        if (demoDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, demoDelayMs))
        }
        setStatus('off')
        onSubmitted?.()
      }}
      borderWidth={1}
      borderRadius="$4"
      padding="$6"
    >
      {children}
      {/* Phase-3-2：更新(asChildの対象をYStack全体から実際に押下される<Button>1つに
          限定した。以前はForm.Triggerがラッパー要素にもrole="button"を付与しており、
          中の<Button>と合わせて同じアクセシブルネームを持つ要素が2つ存在していた) */}
      {/* <Form.Trigger asChild disabled={status !== 'off'}> */}
      {/*   <YStack  gap="$4"> */}
      {/*     <Button {...buttonProps}>{buttonName}</Button> */}
      {/*     <YStack width="100%" height={40} justifyContent="center" alignItems="center"> */}
      {/*       <AnimatePresence> */}
      {/*         {status === 'submitting' ? ( */}
      {/*           <Spinner */}
      {/*             transition="medium" */}
      {/*             enterStyle={{ opacity: 0 }} */}
      {/*             alignSelf="center" */}
      {/*             key="spinner" */}
      {/*             width={8} */}
      {/*           /> */}
      {/*         ) : null} */}
      {/*       </AnimatePresence> */}
      {/*     </YStack> */}
      {/*   </YStack> */}
      {/* </Form.Trigger> */}
      {/* ↓↓ */}
      <YStack gap="$4">
        <Form.Trigger asChild disabled={status !== 'off'}>
          <Button {...buttonProps}>{buttonName}</Button>
        </Form.Trigger>
        <YStack width="100%" height={40} justifyContent="center" alignItems="center">
          <AnimatePresence>
            {status === 'submitting' ? (
              <Spinner
                transition="medium"
                enterStyle={{ opacity: 0 }}
                alignSelf="center"
                key="spinner"
                width={8}
              />
            ) : null}
          </AnimatePresence>
        </YStack>
      </YStack>
    </Form>
  )
}
