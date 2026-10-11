// 作成：Phase-36-3｜更新：Phase-36(完了後の調整)
"use client";

import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import type {
  GeneratedDocumentRead,
  RequirementIssueRead,
  RequirementSource,
} from "@/features/documents/api/documentsApi";
import { useDocumentsStore } from "@/features/documents/documents-store";

const SOURCE_LABELS: Record<RequirementSource, string> = {
  user: "ユーザー",
  adopted: "採用",
  assumed: "推測",
};

// Phase-36(完了後の調整):追記
// 出どころの意味(件数の下に出す。md の凡例と同じ言い方)
const SOURCE_NOTES: Record<RequirementSource, string> = {
  user: "初期入力・チャットでの回答より",
  adopted: "ヒアリングで AI の提案を採用",
  assumed: "ドキュメント生成時に AI が推測(未確認)",
};

const LEVEL_LABELS: Record<RequirementIssueRead["level"], string> = {
  critical: "最重要",
  major: "中程度",
  minor: "軽微",
};

type RequirementsSummaryPanelProps = {
  projectId: string;
  document: GeneratedDocumentRead;
};

// 要件定義書の上に、要件の出どころの件数・検証の指摘・推測の要件(「採用にする」)を出す。
// 推測は AI が補った要件(利用者は言っていない)。確かめた要件だけを「採用」にし、違う内容に
// したいときはチャットで答えて再生成する。
export function RequirementsSummaryPanel({ projectId, document }: RequirementsSummaryPanelProps) {
  const adoptingId = useDocumentsStore((s) => s.adoptingId);
  const adoptError = useDocumentsStore((s) => s.adoptError);
  const adoptRequirement = useDocumentsStore((s) => s.adoptRequirement);

  if (document.doc_type !== "requirements") return null;
  const summary = document.requirements;
  if (!summary) {
    return (
      <Paragraph size="$2" color="$color10">
        この版には要件ID・出どころがありません(以前の形式)。文書を再生成すると使えます。
      </Paragraph>
    );
  }

  const sources: RequirementSource[] = ["user", "adopted", "assumed"];
  return (
    <YStack
      gap="$2"
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$4"
      padding="$3"
      aria-label="要件の出どころ"
    >
      <Text fontWeight="700">
        要件の出どころ:{" "}
        {sources.map((source) => `${SOURCE_LABELS[source]} ${summary.counts[source] ?? 0}`).join(" / ")}
      </Text>
      {/* Phase-36(完了後の調整):追記 */}
      <YStack>
        {sources.map((source) => (
          <Paragraph key={source} size="$2" color="$color10">
            {SOURCE_LABELS[source]}: {SOURCE_NOTES[source]}
          </Paragraph>
        ))}
      </YStack>
      {summary.issues.length > 0 ? (
        <YStack gap="$1" role="list" aria-label="要件定義書の指摘">
          {summary.issues.map((issue) => (
            <Text
              role="listitem"
              key={issue.code}
              color={issue.level === "minor" ? "$color11" : "$red10"}
            >
              【{LEVEL_LABELS[issue.level]}】{issue.message}
            </Text>
          ))}
        </YStack>
      ) : null}
      {summary.assumed.length > 0 ? (
        <YStack gap="$2">
          <Paragraph size="$2" color="$color10">
            推測の要件は AI が補ったものです。内容を確かめて、よければ「採用にする」を押してください
            (違う内容にしたいときは、チャットで答えて再生成します)。
          </Paragraph>
          {summary.assumed.map((row) => (
            <XStack key={row.id} gap="$3" alignItems="center" flexWrap="wrap">
              <Text fontWeight="700">{row.id}</Text>
              <Text flex={1} minWidth={200}>
                {row.text}
              </Text>
              <Button
                size="$2"
                disabled={adoptingId !== null}
                opacity={adoptingId !== null ? 0.6 : 1}
                onPress={() => void adoptRequirement(projectId, row.id)}
                aria-label={`${row.id} を採用にする`}
              >
                {adoptingId === row.id ? "反映中…" : "採用にする"}
              </Button>
            </XStack>
          ))}
        </YStack>
      ) : null}
      {adoptError ? (
        <Text role="alert" color="$red10">
          {adoptError}
        </Text>
      ) : null}
    </YStack>
  );
}
