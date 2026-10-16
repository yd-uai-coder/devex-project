// 作成：Phase-3-3｜更新：Phase-65-3
// Phase-65-3：更新(一覧を、URL の条件で1ページずつ取る形に作り直した。検索・絞込みの部品(ProjectListControls)・
//   ページ送り(DataPagination)・0件の表示の出し分け・最後のページより後の置き換えを足した)
// "use client";
//
// import { useEffect } from "react";
// import { Text, YStack } from "tamagui";
// import { useDashboardStore } from "@/features/dashboard/dashboard-store";
// import { ProjectListItem } from "@/features/dashboard/components/ProjectListItem";
//
// export function ProjectList() {
//   const projects = useDashboardStore((s) => s.projects);
//   const status = useDashboardStore((s) => s.status);
//   const error = useDashboardStore((s) => s.error);
//   const fetchProjects = useDashboardStore((s) => s.fetchProjects);
//
//   useEffect(() => {
//     void fetchProjects();
//   }, [fetchProjects]);
//
//   if (status === "loading" && projects.length === 0) {
//     return <Text color="$color11">読み込み中...</Text>;
//   }
//
//   if (status === "error") {
//     return (
//       <Text role="alert" color="$color9">
//         {error}
//       </Text>
//     );
//   }
//
//   if (projects.length === 0) {
//     return (
//       <Text color="$color11">まだプロジェクトがありません。「新規プロジェクトを作成」から始めましょう。</Text>
//     );
//   }
//
//   return (
//     <YStack gap="$3">
//       {projects.map((project) => (
//         <ProjectListItem key={project.id} project={project} />
//       ))}
//     </YStack>
//   );
// }
// ↓↓
"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Text, YStack } from "tamagui";
import { DataPagination } from "@/components/ui/data/DataPagination";
import type { ProjectRead } from "@/features/dashboard/api/projects";
import { useDashboardStore } from "@/features/dashboard/dashboard-store";
import { ProjectListControls } from "@/features/dashboard/components/ProjectListControls";
import { ProjectListItem } from "@/features/dashboard/components/ProjectListItem";
import {
  PROJECT_PAGE_SIZE,
  hasConditions,
  listParamsKey,
  parseListParams,
  toSearchParams,
} from "@/features/dashboard/list-params";
import type { ProjectListParams } from "@/features/dashboard/list-params";
import type { AsyncStatus } from "@/lib/api/types";

// 一覧の条件(検索語・モード・進行状態・ページ)は URL に持つ。読み込み直し・戻る・ブックマークで
// 同じ一覧に戻れるようにするため(useSearchParams を使うので、ページ側で Suspense に包む)。
export function ProjectList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useMemo(() => parseListParams(searchParams), [searchParams]);

  const items = useDashboardStore((s) => s.items);
  const total = useDashboardStore((s) => s.total);
  const status = useDashboardStore((s) => s.status);
  const error = useDashboardStore((s) => s.error);
  const fetchedKey = useDashboardStore((s) => s.key);
  const fetchedAt = useDashboardStore((s) => s.fetchedAt);
  const fetchProjects = useDashboardStore((s) => s.fetchProjects);

  // 条件が変わったとき・cache が切れたとき(削除の後など。fetchedAt が null になる)に取り直す
  useEffect(() => {
    void fetchProjects(params);
  }, [params, fetchedAt, fetchProjects]);

  function navigate(next: ProjectListParams, { replace = false } = {}) {
    const query = toSearchParams(next).toString();
    const href = query ? `${pathname}?${query}` : pathname;
    if (replace) router.replace(href);
    else router.push(href);
  }

  const pageCount = Math.max(1, Math.ceil(total / PROJECT_PAGE_SIZE));
  // 最後のページより後(最後の1件を削除した・古い URL を開いた)なら、最後のページへ置き換える
  const beyondLastPage =
    status === "success" &&
    fetchedKey === listParamsKey(params) &&
    items.length === 0 &&
    total > 0 &&
    params.page > pageCount;
  useEffect(() => {
    if (beyondLastPage) navigate({ ...params, page: pageCount }, { replace: true });
    // navigate は描画ごとに作り直すので依存に入れない(beyondLastPage が真になったときだけ動かす)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beyondLastPage, pageCount, params]);

  return (
    <YStack gap="$4">
      <ProjectListControls value={params} onChange={(next) => navigate(next)} />
      <ProjectListBody
        items={items}
        status={status}
        error={error}
        filtered={hasConditions(params)}
      />
      {pageCount > 1 ? (
        <DataPagination
          page={Math.min(params.page, pageCount)}
          pageCount={pageCount}
          totalCount={total}
          onPageChange={(page) => navigate({ ...params, page })}
        />
      ) : null}
    </YStack>
  );
}

type ProjectListBodyProps = {
  items: ProjectRead[];
  status: AsyncStatus;
  error: string | null;
  // 検索語か絞込みがあるか(0件のときの文言を分ける)
  filtered: boolean;
};

function ProjectListBody({ items, status, error, filtered }: ProjectListBodyProps) {
  if (status === "loading" && items.length === 0) {
    return <Text color="$color11">読み込み中...</Text>;
  }

  if (status === "error") {
    return (
      <Text role="alert" color="$color9">
        {error}
      </Text>
    );
  }

  if (items.length === 0) {
    return filtered ? (
      <Text color="$color11">条件に合うプロジェクトはありません。</Text>
    ) : (
      <Text color="$color11">まだプロジェクトがありません。「新規プロジェクトを作成」から始めましょう。</Text>
    );
  }

  return (
    <YStack gap="$3">
      {items.map((project) => (
        <ProjectListItem key={project.id} project={project} />
      ))}
    </YStack>
  );
}
