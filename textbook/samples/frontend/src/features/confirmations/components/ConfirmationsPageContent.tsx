// 作成：Phase-98-1
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, H2, Paragraph, Text, XStack, YStack } from "tamagui";
import { ProjectNotFoundNotice } from "@/components/errors/ProjectNotFoundNotice";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { listConfirmations, updateConfirmation } from "@/features/confirmations/api/confirmationsApi";
import type {
  ConfirmationItemRead,
  ConfirmationListRead,
  ConfirmationUpdate,
} from "@/features/confirmations/api/types";
import {
  DEFAULT_FILTER,
  KIND_LABEL,
  STATUS_LABEL,
  adoptionText,
  filterItems,
  needsAdoptConfirm,
  splitByPresence,
  unconfirmedCountsText,
  type ConfirmationFilter,
  type KindFilter,
  type StatusFilter,
} from "@/features/confirmations/confirmationOps";
import { ConfirmationTable } from "@/features/confirmations/components/ConfirmationTable";
import { isDetailedModeOnly } from "@/features/change-requests/changeRequestOps";
import { DetailedModeOnlyNotice } from "@/features/change-requests/components/DetailedModeOnlyNotice";
import { INPUT, OPTION } from "@/features/detailed-design/components/tableStyles";
import { isNotFound } from "@/lib/api/client";

type Pending = { item: ConfirmationItemRead; body: ConfirmationUpdate };

// 確認事項の一覧(docs/external_design.md 2.15節)。推測の要件・推測の利用者・根拠が未決の観点を、
// 今の要件定義書と観点の表から devex-api が毎回組み立てる。行ごとに決める機会・状態・メモを決める。
// 推測の要件・利用者を確認済みにすると採用にして合意を記録するので、そのときだけ確認のダイアログを
// 挟む。状態を決めた後に一覧から消えた項目は、末尾の「決めた記録」に畳む。詳細設計モードだけ。
export function ConfirmationsPageContent({ projectId }: { projectId: string }) {
  const [list, setList] = useState<ConfirmationListRead | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<ConfirmationFilter>(DEFAULT_FILTER);
  const [pending, setPending] = useState<Pending | null>(null);
  const [showGone, setShowGone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listConfirmations(projectId)
      .then((result) => {
        if (!cancelled) setList(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (isNotFound(loadError)) return <ProjectNotFoundNotice />;
  if (isDetailedModeOnly(loadError)) {
    return <DetailedModeOnlyNotice projectId={projectId} title="確認事項" what="確認事項の一覧" />;
  }

  const save = async (item: ConfirmationItemRead, body: ConfirmationUpdate) => {
    setSavingKey(item.key);
    setSaveError(null);
    try {
      // 応答は作り直した一覧(採用で推測でなくなった行は一覧から消え、採用率も変わる)
      setList(await updateConfirmation(projectId, item.key, body));
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "確認事項の保存に失敗しました");
    } finally {
      setSavingKey(null);
    }
  };

  const onUpdate = (item: ConfirmationItemRead, body: ConfirmationUpdate) => {
    if (body.status && needsAdoptConfirm(item, body.status)) {
      setPending({ item, body });
      return;
    }
    void save(item, body);
  };

  const { present, gone } = splitByPresence(list?.items ?? []);
  const shown = filterItems(present, filter);

  return (
    <YStack paddingVertical="$4" gap="$4">
      <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
        <H2>確認事項</H2>
        <XStack gap="$3" alignItems="center" flexWrap="wrap">
          <Link href={`/projects/${projectId}/documents`}>
            <Text color="$blue10">← ドキュメント</Text>
          </Link>
          <Link href={`/projects/${projectId}/detailed-design`}>
            <Text color="$blue10">詳細設計</Text>
          </Link>
          <Link href={`/projects/${projectId}/change-requests`}>
            <Text color="$blue10">変更要求(CR)</Text>
          </Link>
          <Link href={`/projects/${projectId}/baselines`}>
            <Text color="$blue10">合意済みの版</Text>
          </Link>
        </XStack>
      </XStack>
      <Paragraph color="$color11">
        AI が推測した要件・利用者と、要件の根拠でまだ決まっていない観点です。いつ決めるか(決める機会)を決め、クライアントに確かめたら状態を変えます。推測の要件・利用者を確認済みにすると採用にして合意を記録します。観点は、チャットと観点の表で答えると一覧から消えます。
      </Paragraph>

      {loadError ? (
        <Text role="alert" color="$red10">
          {loadError instanceof Error ? loadError.message : "確認事項の取得に失敗しました"}
        </Text>
      ) : null}
      {list === null && !loadError ? <Text color="$color11">読み込み中...</Text> : null}

      {list ? (
        <>
          <YStack gap="$1">
            <Text fontWeight="700">未確認: {unconfirmedCountsText(list.items)}</Text>
            <Text>{adoptionText(list.adoption)}</Text>
          </YStack>

          <XStack gap="$3" flexWrap="wrap" alignItems="center">
            <label style={{ fontSize: 13 }}>
              種類{" "}
              <select
                style={{ ...INPUT, width: "auto" }}
                aria-label="種類で絞る"
                value={filter.kind}
                onChange={(e) => setFilter({ ...filter, kind: e.target.value as KindFilter })}
              >
                <option value="all" style={OPTION}>
                  すべて
                </option>
                {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((kind) => (
                  <option key={kind} value={kind} style={OPTION}>
                    {KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 13 }}>
              状態{" "}
              <select
                style={{ ...INPUT, width: "auto" }}
                aria-label="状態で絞る"
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value as StatusFilter })}
              >
                <option value="all" style={OPTION}>
                  すべて
                </option>
                {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((status) => (
                  <option key={status} value={status} style={OPTION}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </label>
          </XStack>

          {saveError ? (
            <Text role="alert" color="$red10">
              {saveError}
            </Text>
          ) : null}

          {present.length === 0 ? (
            <Text color="$color11">確認事項はありません(推測の要件・利用者も、未決の観点もありません)。</Text>
          ) : shown.length === 0 ? (
            <Text color="$color11">この絞り込みに当たる項目はありません。</Text>
          ) : (
            <ConfirmationTable items={shown} label="確認事項" savingKey={savingKey} onUpdate={onUpdate} />
          )}

          {gone.length > 0 ? (
            <YStack gap="$2" aria-label="決めた記録">
              <Button size="$2" chromeless alignSelf="flex-start" onPress={() => setShowGone((v) => !v)}>
                {`${showGone ? "▾" : "▸"} 一覧から消えた項目(決めた記録) ${gone.length}件`}
              </Button>
              {showGone ? (
                <>
                  <Paragraph size="$2" color="$color10">
                    確認済み・却下にした後、採用や再生成で一覧から消えた項目です。推測の採用率はこれも数えます。
                  </Paragraph>
                  <ConfirmationTable items={gone} label="一覧から消えた項目" savingKey={savingKey} readOnly onUpdate={onUpdate} />
                </>
              ) : null}
            </YStack>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        title="確認済みにする"
        description={
          pending
            ? `「${pending.item.label}」を確認済みにすると、採用にして合意を記録します(要件定義書の出どころが「採用」に変わります)。合意の記録は取り消せません。`
            : ""
        }
        confirmLabel="採用にして合意を記録する"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const next = pending;
          setPending(null);
          if (next) void save(next.item, next.body);
        }}
      />
    </YStack>
  );
}
