// 作成：Phase-116-1
import { create } from "zustand";
import { isNotFound } from "@/lib/api/client";
import { isCacheFresh } from "@/lib/api/cache";
import type { AsyncStatus } from "@/lib/api/types";
import { getBaselineFreshness } from "@/features/baselines/api/baselinesApi";
import type { BaselineFreshnessRead } from "@/features/baselines/api/types";
import type { ChangeRequestRead } from "@/features/change-requests/api/types";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { isDetailedModeOnly } from "@/features/change-requests/changeRequestOps";
import {
  createChangeRequestFromDifferences,
  createMaterial,
  deleteMaterial,
  extractDifferences,
  getMaterial,
  listDifferences,
  listMaterials,
  updateDifference,
  uploadMaterial,
} from "@/features/materials/api/materialsApi";
import type {
  MaterialChangeRequestCreate,
  MaterialDifferencesRead,
  MaterialInput,
  MaterialRead,
  MaterialSummaryRead,
} from "@/features/materials/api/types";
import { materialErrorMessage } from "@/features/materials/materialOps";

type MaterialsStore = {
  // 今の内容がどのプロジェクトのものか(別のプロジェクトを開いたら捨てる)
  projectId: string | null;
  list: MaterialSummaryRead[];
  status: AsyncStatus;
  error: string | null;
  // 一覧の取得が404(プロジェクトが無い)
  notFound: boolean;
  // 簡易ドキュメントモードのプロジェクト(API が 409 DESIGN_STAGES_NOT_AVAILABLE で断った)
  unavailable: boolean;
  fetchedAt: number | null;

  // 開いている資料(本文つき)と、その違いの一覧
  detail: MaterialRead | null;
  detailStatus: AsyncStatus;
  detailError: string | null;
  detailNotFound: boolean;
  differences: MaterialDifferencesRead | null;
  differencesError: string | null;
  // 今の最新の束の鮮度(取り出しの前に知らせる。束が無ければ null)
  latestFreshness: BaselineFreshnessRead | null;

  adding: boolean;
  addError: string | null;
  // 違いの取り出し(LLM を同期で1回呼ぶ)
  extracting: boolean;
  // 違いを捨てる・戻す・CR の下書きを作る・資料を消す
  acting: boolean;
  actionError: string | null;

  fetchList: (projectId: string, options?: { force?: boolean }) => Promise<void>;
  // 資料・違いの一覧・最新の束の鮮度を読む
  fetchDetail: (projectId: string, materialId: string) => Promise<void>;
  // 足せたら足した資料を返す(失敗は addError)
  add: (projectId: string, input: MaterialInput) => Promise<MaterialRead | null>;
  remove: (projectId: string, materialId: string) => Promise<boolean>;
  extract: (projectId: string, materialId: string) => Promise<void>;
  dismiss: (projectId: string, materialId: string, differenceId: string, reason: string) => Promise<boolean>;
  restore: (projectId: string, materialId: string, differenceId: string) => Promise<void>;
  // 作れたら作った CR を返す(失敗は actionError)
  createChangeRequest: (
    projectId: string,
    materialId: string,
    body: MaterialChangeRequestCreate,
  ) => Promise<ChangeRequestRead | null>;
  clearErrors: () => void;
};

const DETAIL_INITIAL = {
  detail: null,
  detailStatus: "idle" as AsyncStatus,
  detailError: null,
  detailNotFound: false,
  differences: null,
  differencesError: null,
  latestFreshness: null,
};

const PROJECT_INITIAL = {
  list: [] as MaterialSummaryRead[],
  status: "idle" as AsyncStatus,
  error: null,
  notFound: false,
  unavailable: false,
  fetchedAt: null,
  ...DETAIL_INITIAL,
  adding: false,
  addError: null,
  extracting: false,
  acting: false,
  actionError: null,
};

export const useMaterialsStore = create<MaterialsStore>((set, get) => {
  // 別のプロジェクトに移ったら、前のプロジェクトの内容を捨てる(baselines-store と同じ形)
  const switchProject = (projectId: string) => {
    if (get().projectId === projectId) return;
    set({ projectId, ...PROJECT_INITIAL });
  };

  // 開いている資料の違いの一覧が今もこの資料か(読む間に別の資料へ移ったら捨てる)
  const isOpen = (projectId: string, materialId: string) =>
    get().projectId === projectId && get().detail?.id === materialId;

  const loadFreshness = async (projectId: string, view: MaterialDifferencesRead) => {
    const latest = view.latest_baseline_number;
    if (latest === null) {
      set({ latestFreshness: null });
      return;
    }
    try {
      const freshness = await getBaselineFreshness(projectId, latest);
      if (get().projectId === projectId) set({ latestFreshness: freshness });
    } catch {
      // 鮮度は知らせのためだけなので、読めなくても画面は出す
      set({ latestFreshness: null });
    }
  };

  // 違いの一覧を置き換え、比べる相手(今の最新の束)の鮮度を読み直す
  const setDifferences = (projectId: string, view: MaterialDifferencesRead) => {
    set({ differences: view, differencesError: null });
    void loadFreshness(projectId, view);
  };

  return {
    projectId: null,
    ...PROJECT_INITIAL,

    fetchList: async (projectId, { force = false } = {}) => {
      switchProject(projectId);
      if (!force && isCacheFresh(get().fetchedAt)) return;
      set({ status: "loading", error: null, notFound: false });
      try {
        const list = await listMaterials(projectId);
        if (get().projectId !== projectId) return;
        set({ list, status: "success", fetchedAt: Date.now() });
      } catch (err) {
        set({
          status: "error",
          error: materialErrorMessage(err, "資料の取得に失敗しました"),
          notFound: isNotFound(err),
          unavailable: isDetailedModeOnly(err),
        });
      }
    },

    fetchDetail: async (projectId, materialId) => {
      switchProject(projectId);
      if (get().detail?.id !== materialId) set({ ...DETAIL_INITIAL });
      set({ detailStatus: "loading", detailError: null, detailNotFound: false, actionError: null });
      try {
        const [detail, view] = await Promise.all([
          getMaterial(projectId, materialId),
          listDifferences(projectId, materialId),
        ]);
        if (get().projectId !== projectId) return;
        set({ detail, detailStatus: "success" });
        setDifferences(projectId, view);
      } catch (err) {
        set({
          detailStatus: "error",
          detailError: materialErrorMessage(err, "資料の取得に失敗しました"),
          detailNotFound: isNotFound(err),
          unavailable: isDetailedModeOnly(err),
        });
      }
    },

    add: async (projectId, input) => {
      switchProject(projectId);
      set({ adding: true, addError: null });
      try {
        const material =
          input.file !== undefined
            ? await uploadMaterial(projectId, input.meta, input.file)
            : await createMaterial(projectId, { ...input.meta, body: input.body });
        set({ adding: false, fetchedAt: null });
        return material;
      } catch (err) {
        set({ adding: false, addError: materialErrorMessage(err, "資料を足せませんでした") });
        return null;
      }
    },

    remove: async (projectId, materialId) => {
      set({ acting: true, actionError: null });
      try {
        await deleteMaterial(projectId, materialId);
        set({ acting: false, fetchedAt: null, ...(get().detail?.id === materialId ? DETAIL_INITIAL : {}) });
        return true;
      } catch (err) {
        set({ acting: false, actionError: materialErrorMessage(err, "資料を消せませんでした") });
        return false;
      }
    },

    extract: async (projectId, materialId) => {
      set({ extracting: true, actionError: null });
      try {
        const view = await extractDifferences(projectId, materialId);
        set({ extracting: false });
        if (isOpen(projectId, materialId)) setDifferences(projectId, view);
      } catch (err) {
        set({ extracting: false, actionError: materialErrorMessage(err, "違いを取り出せませんでした") });
      }
    },

    dismiss: async (projectId, materialId, differenceId, reason) => {
      set({ acting: true, actionError: null });
      try {
        await updateDifference(projectId, materialId, differenceId, { action: "dismiss", reason });
        const view = await listDifferences(projectId, materialId);
        set({ acting: false });
        if (isOpen(projectId, materialId)) setDifferences(projectId, view);
        return true;
      } catch (err) {
        set({ acting: false, actionError: materialErrorMessage(err, "違いを捨てられませんでした") });
        return false;
      }
    },

    restore: async (projectId, materialId, differenceId) => {
      set({ acting: true, actionError: null });
      try {
        await updateDifference(projectId, materialId, differenceId, { action: "restore" });
        const view = await listDifferences(projectId, materialId);
        set({ acting: false });
        if (isOpen(projectId, materialId)) setDifferences(projectId, view);
      } catch (err) {
        set({ acting: false, actionError: materialErrorMessage(err, "違いを戻せませんでした") });
      }
    },

    createChangeRequest: async (projectId, materialId, body) => {
      set({ acting: true, actionError: null });
      try {
        const cr = await createChangeRequestFromDifferences(projectId, materialId, body);
        set({ acting: false });
        // 違いは「CR にした」になり、CR の一覧に下書きが増える
        void listDifferences(projectId, materialId)
          .then((view) => {
            if (isOpen(projectId, materialId)) setDifferences(projectId, view);
          })
          .catch(() => undefined);
        if (useChangeRequestsStore.getState().projectId === projectId) {
          useChangeRequestsStore.setState({ fetchedAt: null });
        }
        return cr;
      } catch (err) {
        set({ acting: false, actionError: materialErrorMessage(err, "CR の下書きを作れませんでした") });
        return null;
      }
    },

    clearErrors: () => set({ addError: null, actionError: null }),
  };
});
