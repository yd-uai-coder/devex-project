// 作成：Phase-11-6
// 写経レベル: 定型 ── 検証結果の一覧と、該当要素の選択。
"use client";

import { Button, H3, Text, YStack } from "tamagui";
import type { ValidationIssue } from "@/features/uml/api/types";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";

// 検証結果(POST .../validate)の一覧。項目を押すと該当の要素・線を選び、属性パネルで直せるようにする。
export function ValidationPanel() {
  const validation = useUmlEditorStore((s) => s.validation);
  const model = useUmlEditorStore((s) => s.model);
  const select = useUmlEditorStore((s) => s.select);

  if (!validation) return null;

  const { errors, warnings } = validation;
  if (errors.length === 0 && warnings.length === 0) {
    return <Text color="$green10">検証で問題は見つかりませんでした。</Text>;
  }

  const onPress = (issue: ValidationIssue) => {
    const id = issue.element_id;
    if (!id || !model) return;
    if (model.elements.some((el) => el.id === id)) select({ kind: "element", id });
    else if (model.relations.some((rel) => rel.id === id)) select({ kind: "relation", id });
  };

  const renderIssue = (issue: ValidationIssue, level: "エラー" | "警告", index: number) => (
    <Button
      key={`${level}-${index}`}
      size="$2"
      chromeless
      justifyContent="flex-start"
      disabled={!issue.element_id}
      onPress={() => onPress(issue)}
    >
      <Text color={level === "エラー" ? "$color9" : "$color11"} fontSize="$2">
        {`[${level}] ${issue.message}`}
      </Text>
    </Button>
  );

  return (
    <YStack gap="$1">
      <H3>検証結果</H3>
      <Text color="$color11" fontSize="$2">
        エラーが残っていると自動レイアウトできません。項目を押すと該当の要素を選びます。
      </Text>
      {errors.map((issue, i) => renderIssue(issue, "エラー", i))}
      {warnings.map((issue, i) => renderIssue(issue, "警告", i))}
    </YStack>
  );
}
