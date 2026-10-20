// 作成：Phase-97-2
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Paragraph, Text, YStack } from "tamagui";
import { getAgreementHistory } from "@/features/agreements/api/agreementsApi";
import type { AgreementHistoryRead } from "@/features/agreements/api/types";
import { historyEntryText, relationText } from "@/features/agreements/agreementOps";
import { changeRequestHref } from "@/features/change-requests/changeRequestOps";

type ElementHistoryViewProps = {
  projectId: string;
  elementKey: string;
};

// 要素1つの履歴(合意の記録・合意の形へ戻した版・関わる CR)。開いたときに初めて読む
// (版の履歴と同じく、必要になったときだけ見る補助の情報のため)。
export function ElementHistoryView({ projectId, elementKey }: ElementHistoryViewProps) {
  const [history, setHistory] = useState<AgreementHistoryRead | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAgreementHistory(projectId, elementKey)
      .then((result) => {
        if (!cancelled) setHistory(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "履歴の取得に失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, elementKey]);

  if (error) {
    return (
      <Text role="alert" color="$color9">
        {error}
      </Text>
    );
  }
  if (!history) return <Text color="$color10">読み込み中...</Text>;

  return (
    <YStack gap="$1" paddingLeft="$4" aria-label={`${elementKey} の履歴`}>
      {history.entries.length === 0 ? (
        <Paragraph size="$2" color="$color10">
          合意の記録はまだありません(次の合意済みの版で合意になります)。
        </Paragraph>
      ) : (
        history.entries.map((entry, index) => (
          <Text key={index} fontSize="$2">
            {new Date(entry.occurred_at).toLocaleString("ja-JP")} {historyEntryText(entry)}
          </Text>
        ))
      )}
      {history.change_requests.length > 0 ? (
        <YStack gap="$1">
          <Text fontSize="$2" fontWeight="700">
            関わる CR
          </Text>
          {history.change_requests.map((cr) => (
            <Text key={cr.number} fontSize="$2">
              <Link href={changeRequestHref(projectId, cr.number)} style={{ color: "var(--blue10)" }}>
                CR-{cr.number} {cr.title}
              </Link>
              ({relationText(cr)})
            </Text>
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}
