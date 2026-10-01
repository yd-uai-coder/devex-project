// 作成：Phase-15-7
// 写経レベル: コア ── 承認の後に全段階を取り直す(後ろの段階が開く・古いが消える)。
import { create } from "zustand";
import {
  approveDesignStage,
  listDesignStages,
} from "@/features/detailed-design/api/designStagesApi";
import type { DesignStageRead } from "@/features/detailed-design/api/types";
import { ApiError } from "@/lib/api/client";
import type { AsyncStatus } from "@/lib/api/types";

// 詳細設計画面(SCR-008)の状態。段階の一覧と、選んでいる段階を持つ。
type DetailedDesignStore = {
  projectId: string | null;
  stages: DesignStageRead[];
  selectedStage: number;
  status: AsyncStatus;
  error: string | null;
  // 承認の失敗(409 VERSION_CONFLICT など)。段階の一覧の取得の失敗(error)とは分けて出す。
  actionError: string | null;
  approving: boolean;

  fetchStages: (projectId: string) => Promise<void>;
  selectStage: (stage: number) => void;
  approve: (projectId: string, stage: number) => Promise<void>;
};

// 最初に開く段階: まだ承認されていない最初の段階(すべて承認済みなら段階7)。
export function firstPendingStage(stages: DesignStageRead[]): number {
  return stages.find((s) => s.state !== "approved")?.stage ?? 7;
}

function messageOf(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
    return "他の画面でこの段階が更新されました。最新の内容を読み込み直しました。";
  }
  return err instanceof Error ? err.message : fallback;
}

export const useDetailedDesignStore = create<DetailedDesignStore>(
  (set, get) => ({
    projectId: null,
    stages: [],
    selectedStage: 1,
    status: "idle",
    error: null,
    actionError: null,
    approving: false,

    fetchStages: async (projectId) => {
      const switching = get().projectId !== projectId;
      set({
        status: "loading",
        error: null,
        ...(switching ? { projectId, stages: [] } : {}),
      });
      try {
        const stages = await listDesignStages(projectId);
        set({
          stages,
          status: "success",
          ...(switching ? { selectedStage: firstPendingStage(stages) } : {}),
        });
      } catch (err) {
        set({
          status: "error",
          error: messageOf(err, "段階の取得に失敗しました"),
        });
      }
    },

    selectStage: (stage) => set({ selectedStage: stage, actionError: null }),

    approve: async (projectId, stage) => {
      const current = get().stages.find((s) => s.stage === stage);
      if (!current || current.version === null) return;
      set({ approving: true, actionError: null });
      try {
        await approveDesignStage(projectId, stage, current.version);
      } catch (err) {
        set({ actionError: messageOf(err, "承認に失敗しました") });
      } finally {
        set({ approving: false });
      }
      // 承認すると、後ろの段階が開いたり「古い」が消えたりするため、全段階を取り直す
      await get().fetchStages(projectId);
    },
  }),
);
