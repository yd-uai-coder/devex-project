"use client";
// 作成：Phase-88-4

import { useEffect } from "react";
import { Button, H4, Paragraph, Text, XStack, YStack } from "tamagui";
import type { ChangeRequestRead } from "@/features/change-requests/api/types";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { summaryOutputNote } from "@/features/change-requests/changeRequestOps";
import { ExplanationDownloadButton } from "@/features/change-requests/components/ExplanationDownloadButton";
import { SummaryReview } from "@/features/change-requests/components/SummaryReview";
import { MarkdownBody } from "@/features/documents/components/MarkdownBody";

// 詳細の「説明書」タブ。任意の要約(作る・直す・確認する)と、出力する md のプレビュー・ダウンロード。
// 説明書は開いたときに読み、要約の操作の後は応答の説明書で置き換える。要約は CR の内容か影響が変わると
// 「古い」になり、確かめ直すまで出力に載らない(docs/external_design.md 2.14節「変更の説明書」)
export function ExplanationTab({ projectId, cr }: { projectId: string; cr: ChangeRequestRead }) {
  const explanation = useChangeRequestsStore((s) => s.views.explanation);
  const error = useChangeRequestsStore((s) => s.viewErrors.explanation);
  const summaryActing = useChangeRequestsStore((s) => s.summaryActing);
  const summaryError = useChangeRequestsStore((s) => s.summaryError);
  const fetchView = useChangeRequestsStore((s) => s.fetchView);
  const summarize = useChangeRequestsStore((s) => s.summarize);
  const editSummary = useChangeRequestsStore((s) => s.editSummary);
  const confirmSummary = useChangeRequestsStore((s) => s.confirmSummary);

  useEffect(() => {
    if (explanation === null) void fetchView(projectId, cr.number, "explanation");
  }, [explanation, projectId, cr.number, fetchView]);

  if (error) {
    return (
      <Text role="alert" color="$red10">
        {error}
      </Text>
    );
  }
  if (explanation === null) return <Text color="$color11">読み込み中...</Text>;
  const summary = explanation.summary;

  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <XStack gap="$3" alignItems="center" flexWrap="wrap">
          <H4>要約(クライアント向け・任意)</H4>
          <Button size="$3" disabled={summaryActing !== null} onPress={() => void summarize(projectId, cr.number)}>
            {summaryActing === "create" ? "要約を作成中..." : summary ? "要約を作り直す" : "要約を作る"}
          </Button>
        </XStack>
        <Paragraph color="$color11" size="$2">
          {summaryOutputNote(summary)}
          {summary ? "" : " 要約は LLM(生成の用途のモデル)で作り、人が確かめてから出力に載せます。"}
        </Paragraph>
        {summaryError ? (
          <Text role="alert" color="$red10">
            {summaryError}
          </Text>
        ) : null}
        {summary ? (
          <SummaryReview
            // 作り直し・保存で文が変わったら、直す欄を今の文で作り直す
            key={`${summary.generated_at}:${summary.text}`}
            summary={summary}
            busy={summaryActing !== null}
            onSave={(text) => void editSummary(projectId, cr.number, text)}
            onConfirm={() => void confirmSummary(projectId, cr.number)}
          />
        ) : null}
      </YStack>

      <YStack gap="$2">
        <XStack gap="$3" alignItems="center" flexWrap="wrap" justifyContent="space-between">
          <H4>出力のプレビュー</H4>
          <ExplanationDownloadButton projectId={projectId} number={cr.number} />
        </XStack>
        <Text color="$color11" fontSize="$2">
          {`ファイル名: ${explanation.filename} ・作業単位 ${explanation.units.length} 件 ・結合テスト ${explanation.integration_tests.length} 件 ・総合テスト ${explanation.system_tests.length} 件`}
          {explanation.has_test_spec ? "" : "(合意済みの版にテスト仕様書が無く、テストは数えていない)"}
        </Text>
        <MarkdownBody content={explanation.output} label="説明書のプレビュー" />
      </YStack>
    </YStack>
  );
}
