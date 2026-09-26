// 作成：Phase-3-6
import { create } from "zustand";
import { isCacheFresh } from "@/lib/api/cache";
import { listDocuments } from "@/features/documents/api/documentsApi";
import type { GeneratedDocumentRead } from "@/features/documents/api/documentsApi";
// triggerGenerationはPhase 3-5(hearingApi.ts)のものをそのまま再利用する
// (プロジェクトの生成トリガー自体はヒアリング画面の承認・ドキュメント画面の再生成の
// どちらでも同じ1エンドポイントであり、機能固有のロジックを持たないため)。
import { triggerGeneration } from "@/features/hearing/api/hearingApi";
import type { AsyncStatus } from "@/lib/api/types";

type DocumentsStore = {
  documents: GeneratedDocumentRead[];
  status: AsyncStatus;
  error: string | null;
  fetchedAt: number | null;
  regenerating: boolean;

  fetchDocuments: (projectId: string, options?: { force?: boolean }) => Promise<void>;
  regenerate: (projectId: string) => Promise<void>;
  // useGenerationPollingのcompletedコールバックから呼ぶ。regeneratingを下ろし、
  // 一覧をforce再取得して新しいバージョンを反映する。
  onRegenerationCompleted: (projectId: string) => void;
};

export const useDocumentsStore = create<DocumentsStore>((set, get) => ({
  documents: [],
  status: "idle",
  error: null,
  fetchedAt: null,
  regenerating: false,

  fetchDocuments: async (projectId, { force = false } = {}) => {
    if (!force && isCacheFresh(get().fetchedAt)) return;
    set({ status: "loading", error: null });
    try {
      const documents = await listDocuments(projectId);
      set({ documents, status: "success", fetchedAt: Date.now() });
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : "ドキュメントの取得に失敗しました",
      });
    }
  },

  regenerate: async (projectId) => {
    set({ regenerating: true });
    await triggerGeneration(projectId);
  },

  onRegenerationCompleted: (projectId) => {
    set({ regenerating: false });
    void get().fetchDocuments(projectId, { force: true });
  },
}));
