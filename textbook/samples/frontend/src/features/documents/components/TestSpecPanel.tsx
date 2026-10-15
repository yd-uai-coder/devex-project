// 作成：Phase-57-2
"use client";

import { Paragraph, Text, XStack, YStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import type { TestSpecRead } from "@/features/documents/api/documentsApi";
import { DocumentMarkdownView } from "@/features/documents/components/DocumentMarkdownView";
import { TestSpecIssuePanel } from "@/features/documents/components/TestSpecIssuePanel";
import { countText, type Readiness } from "@/features/documents/testSpecOps";

type TestSpecPanelProps = {
  projectId: string;
  // まだ無ければ null
  testSpec: TestSpecRead | null;
  loading: boolean;
  // 生成を受け付けてから完了するまで true(ボタンを押せなくする)
  generating: boolean;
  generateError: string | null;
  // 作れるか(詳細設計モードは段階1・段階7 の承認が要る。簡易はいつでも作れる)
  readiness: Readiness;
  // 作っていないときの案内(モードで違う)
  emptyNotice: string;
  onGenerate: () => void;
};

// テスト仕様書のパネル。件数・「古い」の注記と作り直し・検証の結果・本文(コピー・.md の
// ダウンロード・版の履歴は文書と共用)。簡易モードはプレビューのタブ、詳細設計モードは詳細設計画面に置く。
export function TestSpecPanel({
  projectId,
  testSpec,
  loading,
  generating,
  generateError,
  readiness,
  emptyNotice,
  onGenerate,
}: TestSpecPanelProps) {
  const button = (
    <XStack gap="$3" alignItems="center" flexWrap="wrap">
      <StyledButton disabled={!readiness.ready || generating} onPress={onGenerate}>
        {generating ? "作っています..." : testSpec === null ? "テスト仕様書を作る" : "テスト仕様書を作り直す"}
      </StyledButton>
      {readiness.reason ? (
        <Text role="status" color="$orange10" fontSize="$2">
          {readiness.reason}
        </Text>
      ) : null}
    </XStack>
  );

  return (
    <YStack gap="$3" flex={1}>
      {generateError ? (
        <Text role="alert" color="$red10">
          {generateError}
        </Text>
      ) : null}
      {generating ? <Text color="$color11">テスト仕様書を作っています。しばらくお待ちください...</Text> : null}

      {testSpec === null ? (
        loading ? (
          <Text color="$color11">読み込み中...</Text>
        ) : (
          <YStack gap="$3">
            <Paragraph color="$color11">{emptyNotice}</Paragraph>
            {button}
          </YStack>
        )
      ) : (
        <YStack gap="$3">
          <Text aria-label="テストの件数">{countText(testSpec)}</Text>
          {testSpec.outdated ? (
            <Paragraph role="status" color="$red10">
              このテスト仕様書を作った後に、入力(要件定義書・外部設計書などの版、段階の承認)が変わりました。作り直してください(古いままでは詳細設計書の
              zip に入りません)。
            </Paragraph>
          ) : null}
          {button}
          <TestSpecIssuePanel issues={testSpec.issues} />
          <DocumentMarkdownView projectId={projectId} document={testSpec.document} />
        </YStack>
      )}
    </YStack>
  );
}
