// 更新：Phase-98-1,109-2,116-2,116-4
"use client";
// 作成：Phase-88-3｜更新：Phase-88(完了後の調整)

// Phase-88(完了後の調整):追記
// Phase-109-2:追記 ── @/features/change-requests/api/types.ChangeRequestSummaryRead
// Phase-116-2:追記 ── @/features/materials/materialOps.materialsHref
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, H2, H3, Paragraph, Text, XStack, YStack } from "tamagui";
import { ProjectNotFoundNotice } from "@/components/errors/ProjectNotFoundNotice";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { DetailedModeOnlyNotice } from "@/features/change-requests/components/DetailedModeOnlyNotice";
import { useBaselinesStore } from "@/features/baselines/baselines-store";
import { baselineHref, includableChangeRequests } from "@/features/baselines/baselineOps";
import { BaselineCreateForm } from "@/features/baselines/components/BaselineCreateForm";
import { BaselineList } from "@/features/baselines/components/BaselineList";
import type { ChangeRequestSummaryRead } from "@/features/change-requests/api/types";
import { materialsHref } from "@/features/materials/materialOps";

// Phase-109-2:追記
// 別のプロジェクトの CR の一覧を持っているときに返す空の一覧(選択のたびに新しい配列を返すと、
// React が「getSnapshot の結果をキャッシュしていない」と警告する)
const NO_CHANGE_REQUESTS: ChangeRequestSummaryRead[] = [];

// 合意済みの版(束)の一覧と作成(SCR-010。docs/external_design.md 2.14節)。詳細設計モードのプロジェクト
// Phase-88(完了後の調整)：更新
// // だけ(簡易モードではサーバーが409を返す)。作成のフォームを開くと、段階の一覧を読む(止まった生成が
// ↓↓
// だけ(簡易モードではサーバーが409を返し、本体の代わりに知らせを出す)。作成のフォームを開くと、段階の一覧を読む(止まった生成が
// Phase-116-4：更新
// // 回収され、入る段階・入らない段階を見せられる)。作ったら中身へ移る。
// export function BaselinesPageContent({ projectId }: { projectId: string }) {
// ↓↓
// 回収され、入る段階・入らない段階を見せられる)。作ったら中身へ移る。initialCreate なら作成のフォームを開いて
// 始める(束が古いときの知らせからの案内)。
export function BaselinesPageContent({
  projectId,
  initialCreate = false,
}: {
  projectId: string;
  initialCreate?: boolean;
}) {
  const router = useRouter();
  const list = useBaselinesStore((s) => s.list);
  const status = useBaselinesStore((s) => s.status);
  const error = useBaselinesStore((s) => s.error);
  const notFound = useBaselinesStore((s) => s.notFound && s.projectId === projectId);
  // Phase-88(完了後の調整):追記
  const unavailable = useBaselinesStore((s) => s.unavailable && s.projectId === projectId);
  const stages = useBaselinesStore((s) => (s.projectId === projectId ? s.stages : null));
  const stagesError = useBaselinesStore((s) => s.stagesError);
  const submitting = useBaselinesStore((s) => s.creating);
  const createError = useBaselinesStore((s) => s.createError);
  const fetchList = useBaselinesStore((s) => s.fetchList);
  const fetchStages = useBaselinesStore((s) => s.fetchStages);
  const create = useBaselinesStore((s) => s.create);
  const clearCreateError = useBaselinesStore((s) => s.clearCreateError);
  // Phase-109-2：更新
  // const changeRequests = useChangeRequestsStore((s) => (s.projectId === projectId ? s.list : []));
  // ↓↓
  const changeRequests = useChangeRequestsStore((s) => (s.projectId === projectId ? s.list : NO_CHANGE_REQUESTS));
  const fetchChangeRequests = useChangeRequestsStore((s) => s.fetchList);
  // Phase-116-4：更新
  // const [creating, setCreating] = useState(false);
  // ↓↓
  const [creating, setCreating] = useState(initialCreate);

  useEffect(() => {
    void fetchList(projectId);
    void fetchChangeRequests(projectId);
  }, [projectId, fetchList, fetchChangeRequests]);

  // Phase-116-4:追記
  // 作成のフォームを開いて始めるときも、段階と CR を読み直す(フォームを開くボタンと同じ)
  useEffect(() => {
    if (!initialCreate) return;
    clearCreateError();
    void fetchStages(projectId);
    void fetchChangeRequests(projectId, { force: true });
  }, [initialCreate, projectId, clearCreateError, fetchStages, fetchChangeRequests]);

  if (notFound) return <ProjectNotFoundNotice />;
  // Phase-88(完了後の調整):追記
  if (unavailable) return <DetailedModeOnlyNotice projectId={projectId} title="合意済みの版" />;

  const open = () => {
    clearCreateError();
    setCreating(true);
    void fetchStages(projectId);
    void fetchChangeRequests(projectId, { force: true });
  };

  return (
    <YStack paddingVertical="$4" gap="$4">
      <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
        <H2>合意済みの版</H2>
        <XStack gap="$3" alignItems="center">
          <Link href={`/projects/${projectId}/change-requests`}>
            <Text color="$blue10">← 変更要求(CR)</Text>
          </Link>
          <Link href={`/projects/${projectId}/documents`}>
            <Text color="$blue10">ドキュメント</Text>
          </Link>
          <Link href={`/projects/${projectId}/detailed-design`}>
            <Text color="$blue10">詳細設計</Text>
          </Link>
          {/* Phase-98-1:追記 */}
          <Link href={`/projects/${projectId}/confirmations`}>
            <Text color="$blue10">確認事項</Text>
          </Link>
          {/* Phase-116-2:追記 */}
          <Link href={materialsHref(projectId)}>
            <Text color="$blue10">資料</Text>
          </Link>
        </XStack>
      </XStack>
      <Paragraph color="$color11">
        クライアントと合意した時点の要件定義書・外部設計書・テスト仕様書と、承認済みの段階を束ねて写し、凍結します。変更要求はこの版を基準にします。作った版は直せず、消せません(記録の誤りは新しい版で直します)。
      </Paragraph>

      {status === "loading" && list.length === 0 ? <Text color="$color11">読み込み中...</Text> : null}
      {status === "error" ? (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      ) : null}

      {creating ? (
        <YStack gap="$2" padding="$3" borderWidth={1} borderColor="$borderColor" borderRadius="$4">
          <H3>合意済みの版を作る</H3>
          {createError ? (
            <Text role="alert" color="$red10">
              {createError}
            </Text>
          ) : null}
          {stagesError ? (
            <Text role="alert" color="$red10">
              {stagesError}
            </Text>
          ) : null}
          <BaselineCreateForm
            candidates={includableChangeRequests(changeRequests)}
            stages={stages}
            submitting={submitting}
            onCancel={() => {
              clearCreateError();
              setCreating(false);
            }}
            onSubmit={async (body) => {
              const created = await create(projectId, body);
              if (created) router.push(baselineHref(projectId, created.number));
            }}
          />
        </YStack>
      ) : (
        <XStack>
          <Button size="$3" theme="green" onPress={open}>
            合意済みの版を作る
          </Button>
        </XStack>
      )}

      {/* Phase-109-2：更新 */}
      {/* <BaselineList projectId={projectId} items={list} changeRequests={changeRequests} /> */}
      {/* ↓↓ */}
      <BaselineList projectId={projectId} items={list} />
    </YStack>
  );
}
