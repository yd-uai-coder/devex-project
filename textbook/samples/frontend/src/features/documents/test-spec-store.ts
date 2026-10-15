// 作成：Phase-57-2
import { create } from "zustand";
import { ApiError } from "@/lib/api/client";
import { getTestSpec } from "@/features/documents/api/documentsApi";
import type { TestSpecRead } from "@/features/documents/api/documentsApi";
import { triggerGeneration } from "@/features/hearing/api/hearingApi";
import type { AsyncStatus } from "@/lib/api/types";

// テスト仕様書の今の版と、その生成(詳細設計モードの「作る」)。プレビューのタブ(簡易)と
// 詳細設計画面(詳細)・詳細設計書の zip の注記が読む。簡易モードの作り直しは文書の再生成と同じ
// 流れ(documents-store の regenerate)を使うので、ここの generate は詳細設計画面だけが使う。
type TestSpecStore = {
  projectId: string | null;
  // まだ無ければ null
  testSpec: TestSpecRead | null;
  status: AsyncStatus;
  error: string | null;
  // 生成を受け付けてから完了を検知するまで true
  generating: boolean;
  generateError: string | null;

  fetchTestSpec: (projectId: string) => Promise<void>;
  // POST /generate {start_from: "test_spec"}。完了は画面が useGenerationPolling で待つ
  generate: (projectId: string) => Promise<void>;
  onGenerated: (projectId: string) => void;
};

export const useTestSpecStore = create<TestSpecStore>((set, get) => ({
  projectId: null,
  testSpec: null,
  status: "idle",
  error: null,
  generating: false,
  generateError: null,

  fetchTestSpec: async (projectId) => {
    // 別のプロジェクトに移ったら、前のプロジェクトのテスト仕様書を捨てる
    if (get().projectId !== projectId) {
      set({ projectId, testSpec: null, generating: false, generateError: null });
    }
    set({ status: "loading", error: null });
    try {
      const testSpec = await getTestSpec(projectId);
      if (get().projectId !== projectId) return;
      set({ testSpec, status: "success" });
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : "テスト仕様書の取得に失敗しました",
      });
    }
  },

  generate: async (projectId) => {
    set({ generating: true, generateError: null });
    try {
      await triggerGeneration(projectId, "test_spec");
    } catch (err) {
      // すでに生成中なら失敗にせず、その完了を待つ
      if (err instanceof ApiError && err.code === "DOC_GENERATION_IN_PROGRESS") return;
      set({
        generating: false,
        generateError: err instanceof Error ? err.message : "テスト仕様書の生成を始められませんでした",
      });
    }
  },

  onGenerated: (projectId) => {
    set({ generating: false });
    void get().fetchTestSpec(projectId);
  },
}));
