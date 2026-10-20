// 作成：Phase-87-4
"use client";

import { useEffect } from "react";
import type { ChangeRequestSummaryRead } from "@/features/change-requests/api/types";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";

const EMPTY: ChangeRequestSummaryRead[] = [];

// プロジェクトの反映済みの CR(段階の生成に渡せるもの)。詳細設計画面の「変更の影響」が使う。
// `enabled` が false(簡易ドキュメントモード)のときは読まない
export function useAppliedChangeRequests(projectId: string, enabled: boolean): ChangeRequestSummaryRead[] {
  const fetchList = useChangeRequestsStore((s) => s.fetchList);
  const list = useChangeRequestsStore((s) => (s.projectId === projectId ? s.list : EMPTY));
  useEffect(() => {
    if (enabled) void fetchList(projectId);
  }, [enabled, projectId, fetchList]);
  return enabled ? list.filter((cr) => cr.status === "applied") : EMPTY;
}
