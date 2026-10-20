// 作成：Phase-97-2
"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { getAgreementStatus } from "@/features/agreements/api/agreementsApi";
import type { AgreementDocType, AgreementStatusRead } from "@/features/agreements/api/types";
import { elementBadge, restoredHeading, stateCountsText } from "@/features/agreements/agreementOps";
import { ElementHistoryView } from "@/features/agreements/components/ElementHistoryView";
import { changeRequestHref } from "@/features/change-requests/changeRequestOps";

type AgreementStatusPanelProps = {
  projectId: string;
  docType: AgreementDocType;
  // 変わったら取り直す(表示中の版の切り替え・「採用にする」で同じ版の中身が変わったとき)
  refreshKey: string;
};

// 要件定義書・外部設計書の上に、表示中の版の行ごとの合意の印・出どころ(B-n / 採用にする / CR-n)と、
// 再生成で合意の形に戻した要素を出す。行の「履歴」で、その行の合意の履歴をその場で開く。
// 詳細設計モードだけ(簡易ドキュメントモードは API が断る。呼ぶ側が出さない)。
export function AgreementStatusPanel({ projectId, docType, refreshKey }: AgreementStatusPanelProps) {
  const [status, setStatus] = useState<AgreementStatusRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAgreementStatus(projectId, docType)
      .then((result) => {
        if (cancelled) return;
        setStatus(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "合意の状態の取得に失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, docType, refreshKey]);

  if (error) {
    return (
      <Text role="alert" color="$color9">
        {error}
      </Text>
    );
  }
  if (!status || status.version === null || status.elements.length === 0) return null;

  const heading = restoredHeading(status);
  const cr = status.change_request_number;
  return (
    <YStack
      gap="$2"
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$4"
      padding="$3"
      aria-label="合意の状態"
    >
      <Text fontWeight="700">合意の状態: {stateCountsText(status.elements)}</Text>
      <Paragraph size="$2" color="$color10">
        合意済みの行は、CR を渡さない再生成では変わりません(変わったら合意の形に戻します)。変えるときは変更要求(CR)を出します。
      </Paragraph>
      {heading ? (
        <YStack gap="$1" aria-label="合意の形に戻した要素">
          <Text>
            {heading}
            {cr != null ? (
              <>
                {" "}
                <Link href={changeRequestHref(projectId, cr)} style={{ color: "var(--blue10)" }}>
                  CR-{cr} を開く
                </Link>
              </>
            ) : null}
          </Text>
          {status.restored.map((r) => (
            <Text key={r.key} fontSize="$2" paddingLeft="$3">
              ・{r.label}: {r.reason_label}
            </Text>
          ))}
        </YStack>
      ) : null}
      <YStack gap="$1">
        {status.elements.map((element) => (
          <Fragment key={element.key}>
            <XStack gap="$3" alignItems="center" flexWrap="wrap">
              <Text flex={1} minWidth={200}>
                {element.label}
              </Text>
              <Text color={element.state === "agreed" ? "$green10" : "$color10"} fontSize="$2">
                {elementBadge(element)}
              </Text>
              <Button
                size="$2"
                onPress={() => setOpenKey(openKey === element.key ? null : element.key)}
                aria-label={`${element.key} の履歴を${openKey === element.key ? "閉じる" : "開く"}`}
              >
                {openKey === element.key ? "閉じる" : "履歴"}
              </Button>
            </XStack>
            {openKey === element.key ? <ElementHistoryView projectId={projectId} elementKey={element.key} /> : null}
          </Fragment>
        ))}
      </YStack>
    </YStack>
  );
}
