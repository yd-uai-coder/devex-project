// 作成：Phase-88-2｜更新：Phase-88(完了後の調整)
import { create } from "zustand";
import { isNotFound } from "@/lib/api/client";
import { isCacheFresh } from "@/lib/api/cache";
import type { AsyncStatus } from "@/lib/api/types";
import { listDesignStages } from "@/features/detailed-design/api/designStagesApi";
import type { DesignStageRead } from "@/features/detailed-design/api/types";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
// Phase-88(完了後の調整):追記
import { isDetailedModeOnly } from "@/features/change-requests/changeRequestOps";
import { createBaseline, getBaseline, listBaselines } from "@/features/baselines/api/baselinesApi";
import type { BaselineCreate, BaselineRead, BaselineSummaryRead } from "@/features/baselines/api/types";

type BaselinesStore = {
  // 今の内容がどのプロジェクトのものか(別のプロジェクトを開いたら捨てる)
  projectId: string | null;
  list: BaselineSummaryRead[];
  status: AsyncStatus;
  error: string | null;
  // 一覧の取得が404(プロジェクトが無い)
  notFound: boolean;
  // Phase-88(完了後の調整):追記
  // 簡易ドキュメントモードのプロジェクト(API が 409 DESIGN_STAGES_NOT_AVAILABLE で断った)
  unavailable: boolean;
  fetchedAt: number | null;

  // 開いている束の中身(写しの中身つき)
  detail: BaselineRead | null;
  detailStatus: AsyncStatus;
  detailError: string | null;
  detailNotFound: boolean;

  // 作成のフォームが見せる今の段階(読むと、止まった生成も回収される)。読むまでは null
  stages: DesignStageRead[] | null;
  stagesError: string | null;

  creating: boolean;
  createError: string | null;

  fetchList: (projectId: string, options?: { force?: boolean }) => Promise<void>;
  fetchDetail: (projectId: string, number: number) => Promise<void>;
  fetchStages: (projectId: string) => Promise<void>;
  // 作れたら作った束を返す(失敗は createError)
  create: (projectId: string, body: BaselineCreate) => Promise<BaselineRead | null>;
  clearCreateError: () => void;
};

const PROJECT_INITIAL = {
  list: [] as BaselineSummaryRead[],
  status: "idle" as AsyncStatus,
  error: null,
  notFound: false,
  // Phase-88(完了後の調整):追記
  unavailable: false,
  fetchedAt: null,
  detail: null,
  detailStatus: "idle" as AsyncStatus,
  detailError: null,
  detailNotFound: false,
  stages: null,
  stagesError: null,
  creating: false,
  createError: null,
};

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export const useBaselinesStore = create<BaselinesStore>((set, get) => {
  // 別のプロジェクトに移ったら、前のプロジェクトの内容を捨てる(documents-store と同じ形)
  const switchProject = (projectId: string) => {
    if (get().projectId === projectId) return;
    set({ projectId, ...PROJECT_INITIAL });
  };

  return {
    projectId: null,
    ...PROJECT_INITIAL,

    fetchList: async (projectId, { force = false } = {}) => {
      switchProject(projectId);
      if (!force && isCacheFresh(get().fetchedAt)) return;
      set({ status: "loading", error: null, notFound: false });
      try {
        const list = await listBaselines(projectId);
        if (get().projectId !== projectId) return;
        set({ list, status: "success", fetchedAt: Date.now() });
      } catch (err) {
        // Phase-88(完了後の調整)：更新
        // set({ status: "error", error: message(err, "合意済みの版の取得に失敗しました"), notFound: isNotFound(err) });
        // ↓↓
        set({
          status: "error",
          error: message(err, "合意済みの版の取得に失敗しました"),
          notFound: isNotFound(err),
          unavailable: isDetailedModeOnly(err),
        });
      }
    },

    fetchDetail: async (projectId, number) => {
      switchProject(projectId);
      if (get().detail?.number !== number) set({ detail: null });
      set({ detailStatus: "loading", detailError: null, detailNotFound: false });
      try {
        const detail = await getBaseline(projectId, number);
        if (get().projectId !== projectId) return;
        set({ detail, detailStatus: "success" });
      } catch (err) {
        set({
          detailStatus: "error",
          detailError: message(err, "合意済みの版の取得に失敗しました"),
          detailNotFound: isNotFound(err),
          // Phase-88(完了後の調整):追記
          unavailable: isDetailedModeOnly(err),
        });
      }
    },

    fetchStages: async (projectId) => {
      switchProject(projectId);
      set({ stagesError: null });
      try {
        const stages = await listDesignStages(projectId);
        if (get().projectId !== projectId) return;
        set({ stages });
      } catch (err) {
        set({ stagesError: message(err, "段階の状態の取得に失敗しました") });
      }
    },

    create: async (projectId, body) => {
      set({ creating: true, createError: null });
      try {
        const baseline = await createBaseline(projectId, body);
        set({ creating: false, fetchedAt: null });
        void get().fetchList(projectId, { force: true });
        // 入れた CR は「入れた束」を持つようになり、CR の作成の基準の束にも新しい束が増える
        const changeRequests = useChangeRequestsStore.getState();
        if (changeRequests.projectId === projectId) {
          useChangeRequestsStore.setState({ fetchedAt: null, baselines: null, requirements: {} });
        }
        return baseline;
      } catch (err) {
        set({ creating: false, createError: message(err, "合意済みの版を作れませんでした") });
        return null;
      }
    },

    clearCreateError: () => set({ createError: null }),
  };
});
