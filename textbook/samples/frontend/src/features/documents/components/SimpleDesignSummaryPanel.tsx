// 作成：Phase-45-5
"use client";

import { Paragraph, Text, YStack } from "tamagui";
import type { GeneratedDocumentRead } from "@/features/documents/api/documentsApi";
import { DocumentIssueList } from "@/features/documents/components/DocumentIssueList";

type SimpleDesignSummaryPanelProps = {
  document: GeneratedDocumentRead;
};

type Summary = {
  label: string;
  counts: string;
  quiet: string;
  issues: NonNullable<GeneratedDocumentRead["internal_design"]>["issues"];
};

// 文書の種類ごとの件数の行と、指摘が無いときの文。model の無い版・ほかの文書は null。
function summaryOf(document: GeneratedDocumentRead): Summary | null {
  if (document.doc_type === "internal_design" && document.internal_design) {
    const { counts, issues } = document.internal_design;
    return {
      label: "内部設計書",
      counts: `テーブル ${counts.tables} / API ${counts.apis} / モジュール ${counts.modules} / 処理 ${counts.dataflows}`,
      quiet: "指摘はありません(外部設計書の API には、どれも処理別データフローがあります)。",
      issues,
    };
  }
  if (document.doc_type === "implementation_plan" && document.implementation_plan) {
    const { counts, issues } = document.implementation_plan;
    return {
      label: "実装計画書",
      counts: `マイルストーン ${counts.milestones} / タスク ${counts.tasks} / リスク ${counts.risks}`,
      quiet: "指摘はありません(機能のタスクには、どれも処理と要件があります)。",
      issues,
    };
  }
  return null;
}

// 簡易モードの内部設計書・実装計画書の上に、行数と検証の指摘(処理の無い API・処理の無い機能の
// タスク・担うタスクの無い Must の機能要件など)を出す。指摘は警告だけで、直したいときはチャットで
// 答えて再生成する。model の無い以前の版は、再生成の案内だけを出す。
export function SimpleDesignSummaryPanel({ document }: SimpleDesignSummaryPanelProps) {
  if (document.doc_type !== "internal_design" && document.doc_type !== "implementation_plan") {
    return null;
  }
  const summary = summaryOf(document);
  if (!summary) {
    return (
      <Paragraph size="$2" color="$color10">
        この版には書き落としの検証がありません(以前の形式)。文書を再生成すると使えます。
      </Paragraph>
    );
  }
  return (
    <YStack
      gap="$2"
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$4"
      padding="$3"
      aria-label={`${summary.label}の一覧`}
    >
      <Text fontWeight="700">{summary.counts}</Text>
      {summary.issues.length > 0 ? (
        <DocumentIssueList issues={summary.issues} label={`${summary.label}の指摘`} />
      ) : (
        <Paragraph size="$2" color="$color10">
          {summary.quiet}
        </Paragraph>
      )}
    </YStack>
  );
}
