// 作成：Phase-116-2
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, H2, H3, Paragraph, Text, XStack, YStack } from "tamagui";
import { ProjectNotFoundNotice } from "@/components/errors/ProjectNotFoundNotice";
import { baselinesHref } from "@/features/baselines/baselineOps";
import { DetailedModeOnlyNotice } from "@/features/change-requests/components/DetailedModeOnlyNotice";
import { useMaterialsStore } from "@/features/materials/materials-store";
import { materialHref } from "@/features/materials/materialOps";
import { MaterialCreateForm } from "@/features/materials/components/MaterialCreateForm";
import { MaterialList } from "@/features/materials/components/MaterialList";

// 資料の一覧と追加(SCR-013。docs/external_design.md 2.17節)。詳細設計モードのプロジェクトだけ
// (簡易モードではサーバーが409を返し、本体の代わりに知らせを出す)。足したら資料のページへ移り、
// そこで最新の合意済みの版と比べて違いを取り出す。
export function MaterialsPageContent({ projectId }: { projectId: string }) {
  const router = useRouter();
  const list = useMaterialsStore((s) => s.list);
  const status = useMaterialsStore((s) => s.status);
  const error = useMaterialsStore((s) => s.error);
  const notFound = useMaterialsStore((s) => s.notFound && s.projectId === projectId);
  const unavailable = useMaterialsStore((s) => s.unavailable && s.projectId === projectId);
  const adding = useMaterialsStore((s) => s.adding);
  const addError = useMaterialsStore((s) => s.addError);
  const fetchList = useMaterialsStore((s) => s.fetchList);
  const add = useMaterialsStore((s) => s.add);
  const clearErrors = useMaterialsStore((s) => s.clearErrors);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void fetchList(projectId);
  }, [projectId, fetchList]);

  if (notFound) return <ProjectNotFoundNotice />;
  if (unavailable) return <DetailedModeOnlyNotice projectId={projectId} title="資料" />;

  return (
    <YStack paddingVertical="$4" gap="$4">
      <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
        <H2>資料</H2>
        <XStack gap="$3" alignItems="center" flexWrap="wrap">
          <Link href={`/projects/${projectId}/change-requests`}>
            <Text color="$blue10">← 変更要求(CR)</Text>
          </Link>
          <Link href={baselinesHref(projectId)}>
            <Text color="$blue10">合意済みの版</Text>
          </Link>
          <Link href={`/projects/${projectId}/documents`}>
            <Text color="$blue10">ドキュメント</Text>
          </Link>
          <Link href={`/projects/${projectId}/detailed-design`}>
            <Text color="$blue10">詳細設計</Text>
          </Link>
          <Link href={`/projects/${projectId}/confirmations`}>
            <Text color="$blue10">確認事項</Text>
          </Link>
        </XStack>
      </XStack>
      <Paragraph color="$color11">
        合意の後に届いた議事録・メール・資料を足し、最新の合意済みの版と違う点を取り出して、選んだ違いから変更要求の下書きを作ります。ここで足した資料は、ヒアリングの根拠には使いません。
      </Paragraph>

      {status === "loading" && list.length === 0 ? <Text color="$color11">読み込み中...</Text> : null}
      {status === "error" ? (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      ) : null}

      {creating ? (
        <YStack gap="$2" padding="$3" borderWidth={1} borderColor="$borderColor" borderRadius="$4">
          <H3>資料を足す</H3>
          {addError ? (
            <Text role="alert" color="$red10">
              {addError}
            </Text>
          ) : null}
          <MaterialCreateForm
            submitting={adding}
            onCancel={() => {
              clearErrors();
              setCreating(false);
            }}
            onSubmit={async (input) => {
              const material = await add(projectId, input);
              if (material) router.push(materialHref(projectId, material.id));
            }}
          />
        </YStack>
      ) : (
        <XStack>
          <Button
            size="$3"
            theme="green"
            onPress={() => {
              clearErrors();
              setCreating(true);
            }}
          >
            資料を足す
          </Button>
        </XStack>
      )}

      <MaterialList projectId={projectId} items={list} />
    </YStack>
  );
}
