// 更新：Phase-3-2
"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { InputProps, SizeTokens } from "tamagui";
import { Button, Input, Label, Text, Theme, XStack, YStack } from "tamagui";
import { STATUS_THEME } from "./formStatus";
import type { FormStatus } from "./formStatus";

type InputPasswordProps = InputProps & {
  errorMessage?: string;
  label?: string;
  labelWidth?: number | SizeTokens;
  status?: FormStatus;
  width?: number | SizeTokens;
};

export default function InputPassword({
  errorMessage,
  label = "パスワード",
  labelWidth,
  placeholder = "パスワード",
  status = "default",
  size,
  id,
  width = 300,
  ...inputProps
}: InputPasswordProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  // Phase-3-2:追記 ── aria-describedbyでエラーメッセージと紐づけるための固定id
  const errorId = `${inputId}-error`;
  const [visible, setVisible] = useState(false);
  const isDisabled = status === "disabled";
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
          <XStack
            alignItems="center"
            gap="$2"
            alignSelf="stretch"
            $md={{ alignSelf: "auto", flex: 1 }}
          >
            {/* Phase-3-2：更新(エラー時にaria-invalid/aria-describedbyを配線する) */}
            {/* <Input */}
            {/*   id={inputId} */}
            {/*   size={size} */}
            {/*   flex={1} */}
            {/*   type={visible ? "text" : "password"} */}
            {/*   autoComplete="current-password" */}
            {/*   placeholder={placeholder} */}
            {/*   disabled={isDisabled} */}
            {/*   borderColor="$color7" */}
            {/*   {...inputProps} */}
            {/* /> */}
            {/* ↓↓ */}
            <Input
              id={inputId}
              size={size}
              flex={1}
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              placeholder={placeholder}
              disabled={isDisabled}
              borderColor="$color7"
              aria-invalid={errorMessage ? true : undefined}
              aria-describedby={errorMessage ? errorId : undefined}
              {...inputProps}
            />
            <Button
              circular
              size={size ?? "$3"}
              disabled={isDisabled}
              aria-label={visible ? "パスワードを隠す" : "パスワードを表示"}
              icon={visible ? <EyeOff size={16} /> : <Eye size={16} />}
              onPress={() => setVisible((v) => !v)}
            />
          </XStack>
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
}
