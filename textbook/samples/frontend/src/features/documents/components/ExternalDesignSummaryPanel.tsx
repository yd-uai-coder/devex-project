// 作成：Phase-37-3
"use client";

import { Paragraph, Text, YStack } from "tamagui";
import type { GeneratedDocumentRead } from "@/features/documents/api/documentsApi";
import { DocumentIssueList } from "@/features/documents/components/DocumentIssueList";

type ExternalDesignSummaryPanelProps = {
  document: GeneratedDocumentRead;
};

// 外部設計書の上に、画面・API・外部連携の件数と検証の指摘(要件との対応の抜け・API の本文の欄など)
// を出す。指摘は警告だけで、直したいときはチャットで答えて再生成する。
export function ExternalDesignSummaryPanel({ document }: ExternalDesignSummaryPanelProps) {
  if (document.doc_type !== "external_design") return null;
  const summary = document.external_design;
  if (!summary) {
    return (
      <Paragraph size="$2" color="$color10">
        この版には要件ID との対応がありません(以前の形式)。文書を再生成すると使えます。
      </Paragraph>
    );
  }

  const { counts } = summary;
  return (
    <YStack
      gap="$2"
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$4"
      padding="$3"
      aria-label="外部設計書の一覧"
    >
      <Text fontWeight="700">
        画面 {counts.screens} / API {counts.apis} / 外部連携 {counts.integrations}
      </Text>
      {summary.issues.length > 0 ? (
        <DocumentIssueList issues={summary.issues} label="外部設計書の指摘" />
      ) : (
        <Paragraph size="$2" color="$color10">
          指摘はありません(Must の機能要件には、どれも画面か API があります)。
        </Paragraph>
      )}
    </YStack>
  );
}
