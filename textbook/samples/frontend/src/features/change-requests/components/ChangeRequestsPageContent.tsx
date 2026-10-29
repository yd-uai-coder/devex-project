// 更新：Phase-98-1,116-2
"use client";
// 作成：Phase-87-2｜更新：Phase-88-3,88(完了後の調整)
// Phase-88(完了後の調整)：更新(作成のボタンとフォームを外し、作成は合意済みの版の中身から(基準の版は固定)。簡易モードの知らせを足した。全体を書き換えた)
// import { useEffect, useState } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import { Button, H2, H3, Paragraph, Text, XStack, YStack } from "tamagui";
// import { ProjectNotFoundNotice } from "@/components/errors/ProjectNotFoundNotice";
// import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
// import { changeRequestHref, emptyForm, toCreateBody } from "@/features/change-requests/changeRequestOps";
// import { ChangeRequestForm } from "@/features/change-requests/components/ChangeRequestForm";
// import { ChangeRequestList } from "@/features/change-requests/components/ChangeRequestList";
// import { baselinesHref } from "@/features/baselines/baselineOps";
//
// // 変更要求(CR)の一覧と作成(SCR-010。docs/external_design.md 2.14節)。詳細設計モードのプロジェクト
// // だけ(簡易モードではサーバーが409を返す)。CR は合意済みの版(束)を基準にするので、束が無ければ
// // 作成を止め、束の画面へのリンクを示す。作ったら詳細へ移る。
// export function ChangeRequestsPageContent({ projectId }: { projectId: string }) {
//   const router = useRouter();
//   const list = useChangeRequestsStore((s) => s.list);
//   const status = useChangeRequestsStore((s) => s.status);
//   const error = useChangeRequestsStore((s) => s.error);
//   const notFound = useChangeRequestsStore((s) => s.notFound && s.projectId === projectId);
//   const baselines = useChangeRequestsStore((s) => (s.projectId === projectId ? s.baselines : null));
//   const requirements = useChangeRequestsStore((s) => s.requirements);
//   const acting = useChangeRequestsStore((s) => s.acting);
//   const actionError = useChangeRequestsStore((s) => s.actionError);
//   const fetchList = useChangeRequestsStore((s) => s.fetchList);
//   const fetchBaselines = useChangeRequestsStore((s) => s.fetchBaselines);
//   const fetchRequirements = useChangeRequestsStore((s) => s.fetchRequirements);
//   const clearActionError = useChangeRequestsStore((s) => s.clearActionError);
//   const create = useChangeRequestsStore((s) => s.create);
//   const [creating, setCreating] = useState(false);
//   const [baselineNumber, setBaselineNumber] = useState<number | null>(null);
//
//   useEffect(() => {
//     void fetchList(projectId);
//     void fetchBaselines(projectId);
//   }, [projectId, fetchList, fetchBaselines]);
//
//   // 基準の束の既定は最新(一覧は新しい順)
//   const chosenBaseline = baselineNumber ?? baselines?.[0]?.number ?? null;
//   useEffect(() => {
//     if (creating && chosenBaseline !== null) void fetchRequirements(projectId, chosenBaseline);
//   }, [creating, chosenBaseline, projectId, fetchRequirements]);
//
//   if (notFound) return <ProjectNotFoundNotice />;
//
//   const noBaseline = baselines !== null && baselines.length === 0;
//
//   return (
//     <YStack paddingVertical="$4" gap="$4">
//       <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
//         <H2>変更要求(CR)</H2>
//         <XStack gap="$3" alignItems="center">
//           <Link href={`/projects/${projectId}/documents`}>
//             <Text color="$blue10">← ドキュメント</Text>
//           </Link>
//           <Link href={`/projects/${projectId}/detailed-design`}>
//             <Text color="$blue10">詳細設計</Text>
//           </Link>
//           <Link href={baselinesHref(projectId)}>
//             <Text color="$blue10">合意済みの版</Text>
//           </Link>
//         </XStack>
//       </XStack>
//       <Paragraph color="$color11">
//         クライアントとの合意済みの版を基準に、変更の申し出を受け付けてから、説明・合意・反映・検証までを記録します。
//       </Paragraph>
//
//       {status === "loading" && list.length === 0 ? <Text color="$color11">読み込み中...</Text> : null}
//       {status === "error" ? (
//         <Text role="alert" color="$red10">
//           {error}
//         </Text>
//       ) : null}
//
//       {creating ? (
//         <YStack gap="$2" padding="$3" borderWidth={1} borderColor="$borderColor" borderRadius="$4">
//           <H3>変更要求を作る</H3>
//           {actionError ? (
//             <Text role="alert" color="$red10">
//               {actionError}
//             </Text>
//           ) : null}
//           {baselines && chosenBaseline !== null ? (
//             <ChangeRequestForm
//               initial={emptyForm(chosenBaseline)}
//               baselines={baselines}
//               requirements={requirements[chosenBaseline] ?? null}
//               onBaselineChange={setBaselineNumber}
//               submitting={acting}
//               submitLabel="下書きで作る"
//               onCancel={() => {
//                 clearActionError();
//                 setCreating(false);
//               }}
//               onSubmit={async (form) => {
//                 const created = await create(projectId, toCreateBody(form));
//                 if (created) router.push(changeRequestHref(projectId, created.number));
//               }}
//             />
//           ) : null}
//         </YStack>
//       ) : (
//         <XStack gap="$3" alignItems="center">
//           <Button
//             size="$3"
//             theme="green"
//             disabled={baselines === null || noBaseline}
//             onPress={() => {
//               clearActionError();
//               setCreating(true);
//             }}
//           >
//             変更要求を作る
//           </Button>
//           {noBaseline ? (
//             <Text color="$color11">
//               合意済みの版がまだありません。先に
//               <Link href={baselinesHref(projectId)}>
//                 <Text color="$blue10">合意済みの版</Text>
//               </Link>
//               を作ってください(変更要求はその版を基準にします)。
//             </Text>
//           ) : null}
//         </XStack>
//       )}
//
//       <ChangeRequestList projectId={projectId} items={list} />
//     </YStack>
//   );
// }
// ↓↓
// Phase-116-2:追記 ── @/features/materials/materialOps.materialsHref
import { useEffect } from "react";
import Link from "next/link";
import { H2, Paragraph, Text, XStack, YStack } from "tamagui";
import { ProjectNotFoundNotice } from "@/components/errors/ProjectNotFoundNotice";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { ChangeRequestList } from "@/features/change-requests/components/ChangeRequestList";
import { DetailedModeOnlyNotice } from "@/features/change-requests/components/DetailedModeOnlyNotice";
import { baselinesHref } from "@/features/baselines/baselineOps";
import { materialsHref } from "@/features/materials/materialOps";

// 変更要求(CR)の一覧(SCR-010。docs/external_design.md 2.14節)。詳細設計モードのプロジェクトだけ
// (簡易モードではサーバーが409を返し、本体の代わりに知らせを出す)。CR は合意済みの版を基準にするので、
// 作成は合意済みの版の中身のページから行う(基準の版はその版に固定。ここには作成を置かない)。
export function ChangeRequestsPageContent({ projectId }: { projectId: string }) {
  const list = useChangeRequestsStore((s) => s.list);
  const status = useChangeRequestsStore((s) => s.status);
  const error = useChangeRequestsStore((s) => s.error);
  const notFound = useChangeRequestsStore((s) => s.notFound && s.projectId === projectId);
  const unavailable = useChangeRequestsStore((s) => s.unavailable && s.projectId === projectId);
  const fetchList = useChangeRequestsStore((s) => s.fetchList);

  useEffect(() => {
    void fetchList(projectId);
  }, [projectId, fetchList]);

  if (notFound) return <ProjectNotFoundNotice />;
  if (unavailable) return <DetailedModeOnlyNotice projectId={projectId} title="変更要求(CR)" />;

  return (
    <YStack paddingVertical="$4" gap="$4">
      <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
        <H2>変更要求(CR)</H2>
        <XStack gap="$3" alignItems="center">
          <Link href={`/projects/${projectId}/documents`}>
            <Text color="$blue10">← ドキュメント</Text>
          </Link>
          <Link href={`/projects/${projectId}/detailed-design`}>
            <Text color="$blue10">詳細設計</Text>
          </Link>
          <Link href={baselinesHref(projectId)}>
            <Text color="$blue10">合意済みの版</Text>
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
        クライアントとの合意済みの版を基準に、変更の申し出を受け付けてから、説明・合意・反映・検証までを記録します。
      </Paragraph>
      <Text color="$color11">
        変更要求は、基準にする
        <Link href={baselinesHref(projectId)}>
          <Text color="$blue10">合意済みの版</Text>
        </Link>
        の中身のページから作ります。
      </Text>

      {status === "loading" && list.length === 0 ? <Text color="$color11">読み込み中...</Text> : null}
      {status === "error" ? (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      ) : null}

      <ChangeRequestList projectId={projectId} items={list} />
    </YStack>
  );
}
