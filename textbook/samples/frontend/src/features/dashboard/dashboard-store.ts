// 作成：Phase-3-3｜更新：Phase-64-3,65-2
import { create } from "zustand";
import { isCacheFresh } from "@/lib/api/cache";
import { listProjects } from "@/features/dashboard/api/projects";
import type { ProjectRead } from "@/features/dashboard/api/projects";
// Phase-65-2:追記
import { listParamsKey } from "@/features/dashboard/list-params";
import type { ProjectListParams } from "@/features/dashboard/list-params";
import type { AsyncStatus } from "@/lib/api/types";

type DashboardStore = {
  // Phase-65-2：更新
  // projects: ProjectRead[];
  // ↓↓
  // 今の条件の1ページ分と、条件に合う全件数
  items: ProjectRead[];
  total: number;
  status: AsyncStatus;
  error: string | null;
  // Phase-65-2:追記
  // 取得した条件の鍵(listParamsKey)。cache は最後の条件の1つだけ持つ
  key: string | null;
  fetchedAt: number | null;
  // Phase-65-2：更新
  // // TTL(cache.ts、既定20秒)以内の再フェッチは省略する。force指定時は無条件に取得し直す
  // // (新規プロジェクト作成直後の遷移等、明示的に最新化したい場面向け)。
  // fetchProjects: (options?: { force?: boolean }) => Promise<void>;
  // ↓↓
  // 鍵が同じで TTL(cache.ts、既定20秒)以内なら取り直さない。force 指定時は無条件に取得し直す。
  fetchProjects: (params: ProjectListParams, options?: { force?: boolean }) => Promise<void>;
  // mutation(プロジェクト作成等)の後に呼び、次回のfetchProjects()を強制的に再取得させる。
  invalidate: () => void;
  // Phase-64-3:追記
  // Phase-65-2：更新
  // // 削除したプロジェクトを一覧から外す(取り直さずに、すぐ画面から消すため)。
  // ↓↓
  // 削除したプロジェクトをすぐ一覧から外し、cache を切る(一覧が開いていれば、今のページを
  // 取り直して次のページの先頭を繰り上げる)。
  removeProject: (projectId: string) => void;
};

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  // Phase-65-2：更新
  // projects: [],
  // ↓↓
  items: [],
  total: 0,
  status: "idle",
  error: null,
  // Phase-65-2:追記
  key: null,
  fetchedAt: null,
  // Phase-65-2：更新
  // fetchProjects: async ({ force = false } = {}) => {
  //   if (!force && isCacheFresh(get().fetchedAt)) return;
  //   set({ status: "loading", error: null });
  // ↓↓
  fetchProjects: async (params, { force = false } = {}) => {
    const key = listParamsKey(params);
    if (!force && get().key === key && isCacheFresh(get().fetchedAt)) return;
    // 条件が変わったら、前の条件の取得時刻を消す(取得中に同じ条件で呼ばれても、前の条件の
    // 結果を新しいとみなさないため)。表示は応答が届くまで前の結果のまま。
    set((state) => ({
      status: "loading",
      error: null,
      key,
      fetchedAt: state.key === key ? state.fetchedAt : null,
    }));
    try {
      // Phase-65-2：更新
      // const projects = await listProjects();
      // set({ projects, status: "success", fetchedAt: Date.now() });
      // ↓↓
      const page = await listProjects(params);
      // 待つ間に条件が変わっていたら、古い応答は捨てる
      if (get().key !== key) return;
      set({ items: page.items, total: page.total, status: "success", fetchedAt: Date.now() });
    } catch (err) {
      // Phase-65-2:追記
      if (get().key !== key) return;
      set({
        status: "error",
        error: err instanceof Error ? err.message : "プロジェクト一覧の取得に失敗しました",
      });
    }
  },
  invalidate: () => set({ fetchedAt: null }),
  // Phase-64-3:追記
  removeProject: (projectId) =>
    // Phase-65-2：更新
    // set((state) => ({ projects: state.projects.filter((p) => p.id !== projectId) })),
    // ↓↓
    set((state) => {
      const items = state.items.filter((p) => p.id !== projectId);
      return {
        items,
        total: items.length < state.items.length ? Math.max(0, state.total - 1) : state.total,
        fetchedAt: null,
      };
    }),
}));
