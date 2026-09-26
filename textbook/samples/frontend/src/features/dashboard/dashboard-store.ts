// 作成：Phase-3-3
import { create } from "zustand";
import { isCacheFresh } from "@/lib/api/cache";
import { listProjects } from "@/features/dashboard/api/projects";
import type { ProjectRead } from "@/features/dashboard/api/projects";
import type { AsyncStatus } from "@/lib/api/types";

type DashboardStore = {
  projects: ProjectRead[];
  status: AsyncStatus;
  error: string | null;
  fetchedAt: number | null;
  // TTL(cache.ts、既定20秒)以内の再フェッチは省略する。force指定時は無条件に取得し直す
  // (新規プロジェクト作成直後の遷移等、明示的に最新化したい場面向け)。
  fetchProjects: (options?: { force?: boolean }) => Promise<void>;
  // mutation(プロジェクト作成等)の後に呼び、次回のfetchProjects()を強制的に再取得させる。
  invalidate: () => void;
};

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  projects: [],
  status: "idle",
  error: null,
  fetchedAt: null,
  fetchProjects: async ({ force = false } = {}) => {
    if (!force && isCacheFresh(get().fetchedAt)) return;
    set({ status: "loading", error: null });
    try {
      const projects = await listProjects();
      set({ projects, status: "success", fetchedAt: Date.now() });
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : "プロジェクト一覧の取得に失敗しました",
      });
    }
  },
  invalidate: () => set({ fetchedAt: null }),
}));
