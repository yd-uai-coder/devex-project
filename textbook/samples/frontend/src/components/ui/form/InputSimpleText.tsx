// 更新：Phase-3-2
"use client";

import { forwardRef, useId } from "react";
import type { InputProps, SizeTokens, TamaguiElement } from "tamagui";
import { Input, Label, Text, Theme, XStack, YStack } from "tamagui";
import { STATUS_THEME } from "./formStatus";
import type { FormStatus } from "./formStatus";

export type InputSimpleTextProps = InputProps & {
  errorMessage?: string;
  label?: string;
  labelWidth?: number | SizeTokens;
  status?: FormStatus;
};

// InputSuggest(サジェスト機能)がPopover.Trigger asChild経由でこのコンポーネントに
// refを合成・付与し、実DOM位置を計測できるようforwardRef化している。素のTamagui
// Input/Buttonはstyled()生成物のため元々ref転送に対応済みだが、このコンポーネントは
// ただの関数コンポーネントのため明示的な対応が必要だった。既存の呼び出し元はどこも
// ref(RHFのfield.ref含む)を渡していないため、この変更は既存動作に影響しない。
const InputSimpleText = forwardRef<TamaguiElement, InputSimpleTextProps>(function InputSimpleText(
  {
    errorMessage,
    label = "ラベル名",
    labelWidth,
    placeholder = "プレースホルダ",
    status = "default",
    size,
    id,
    width = 300,
    ...inputProps
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  // Phase-3-2:追記 ── aria-describedbyでエラーメッセージと紐づけるための固定id
  const errorId = `${inputId}-error`;
  const effectiveStatus = errorMessage ? "error" : status;

  return (
    <Theme name={STATUS_THEME[effectiveStatus]}>
      <YStack width={width} marginBottom="$3">
        <XStack
          flexDirection="column"
          alignItems="flex-start"
          gap="0"
          $md={{ flexDirection: "row", alignItems: "center", gap: "$4" }}
        >
          <Label size={size} htmlFor={inputId} flexShrink={0} $md={{ width: labelWidth }}>
            {label}
          </Label>
          {/* Phase-3-2：更新(エラー時にaria-invalid/aria-describedbyを配線する。
              docs/requirements.md 1.5節の非機能要件) */}
          {/* <Input */}
          {/*   ref={ref} */}
          {/*   id={inputId} */}
          {/*   size={size} */}
          {/*   alignSelf="stretch" */}
          {/*   $md={{ alignSelf: "auto", flex: 1 }} */}
          {/*   placeholder={placeholder} */}
          {/*   disabled={status === "disabled"} */}
          {/*   borderColor="$color7" */}
          {/*   {...inputProps} */}
          {/* /> */}
          {/* ↓↓ */}
          <Input
            ref={ref}
            id={inputId}
            size={size}
            alignSelf="stretch"
            $md={{ alignSelf: "auto", flex: 1 }}
            placeholder={placeholder}
            disabled={status === "disabled"}
            borderColor="$color7"
            aria-invalid={errorMessage ? true : undefined}
            aria-describedby={errorMessage ? errorId : undefined}
            {...inputProps}
          />
        </XStack>
        {/* Phase-3-2：更新(エラーメッセージ要素にid+role="alert"を付与し、上のInputと紐づける) */}
        {/* {errorMessage ? ( */}
        {/*   <Text color="$color9" fontSize="$2" marginTop="$1" $md={{ marginLeft: labelWidth }}> */}
        {/*     {errorMessage} */}
        {/*   </Text> */}
        {/* ) : null} */}
        {/* ↓↓ */}
        {errorMessage ? (
          <Text
            id={errorId}
            role="alert"
            color="$color9"
            fontSize="$2"
            marginTop="$1"
            $md={{ marginLeft: labelWidth }}
          >
            {errorMessage}
          </Text>
        ) : null}
      </YStack>
    </Theme>
  );
});

export default InputSimpleText;
