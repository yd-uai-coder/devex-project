// 作成：Phase-57-2｜更新：Phase-69-3
import { create } from "zustand";
import { ApiError } from "@/lib/api/client";
// Phase-69-3：更新
// import { getTestSpec } from "@/features/documents/api/documentsApi";
// ↓↓
import { getGenerationProgress, getTestSpec } from "@/features/documents/api/documentsApi";
import type { TestSpecRead } from "@/features/documents/api/documentsApi";
// Phase-69-3：更新
// import { triggerGeneration } from "@/features/hearing/api/hearingApi";
// ↓↓
import type { ProjectRead } from "@/features/dashboard/api/projects";
import { getProject, triggerGeneration } from "@/features/hearing/api/hearingApi";
import type { AsyncStatus } from "@/lib/api/types";
// Phase-69-3:追記
import { failureFor } from "@/lib/generation-failure";
import type { GenerationFailure } from "@/lib/generation-failure";

// テスト仕様書の今の版と、その生成(詳細設計モードの「作る」)。プレビューのタブ(簡易)と
// 詳細設計画面(詳細)・詳細設計書の zip の注記が読む。簡易モードの作り直しは文書の再生成と同じ
// 流れ(documents-store の regenerate)を使うので、ここの generate は詳細設計画面だけが使う。
type TestSpecStore = {
  projectId: string | null;
  // まだ無ければ null
  testSpec: TestSpecRead | null;
  status: AsyncStatus;
  error: string | null;
  // Phase-69-3：更新
  // // 生成を受け付けてから完了を検知するまで true
  // ↓↓
  // 生成を受け付けてから完了を検知するまで true。画面を開き直したときも、サーバーがテスト仕様書を
  // 作っていれば true にする(fetchTestSpec がプロジェクトの状態と進み具合を読む)
  generating: boolean;
  // Phase-69-3:追記
  // 生成の受け付けの失敗
  generateError: string | null;
  // Phase-69-3:追記
  // 直近の作成の失敗(テスト仕様書を作り直そうとした失敗だけ。次の作成を始めるまで出す)
  generationFailure: GenerationFailure | null;

  fetchTestSpec: (projectId: string) => Promise<void>;
  // POST /generate {start_from: "test_spec"}。完了は画面が useGenerationPolling で待つ
  generate: (projectId: string) => Promise<void>;
  // Phase-69-3：更新
  // onGenerated: (projectId: string) => void;
  // ↓↓
  // useGenerationPolling の終わりのコールバックから呼ぶ(読んだプロジェクトの失敗の記録を持つ)
  onGenerated: (projectId: string, project?: ProjectRead) => void;
};

export const useTestSpecStore = create<TestSpecStore>((set, get) => ({
  projectId: null,
  testSpec: null,
  status: "idle",
  error: null,
  generating: false,
  generateError: null,
  // Phase-69-3:追記
  generationFailure: null,

  fetchTestSpec: async (projectId) => {
    // 別のプロジェクトに移ったら、前のプロジェクトのテスト仕様書を捨てる
    if (get().projectId !== projectId) {
      // Phase-69-3：更新
      // set({ projectId, testSpec: null, generating: false, generateError: null });
      // ↓↓
      set({ projectId, testSpec: null, generating: false, generateError: null, generationFailure: null });
    }
    set({ status: "loading", error: null });
    try {
      // Phase-69-3：更新
      // const testSpec = await getTestSpec(projectId);
      // ↓↓
      const [testSpec, generation] = await Promise.all([
        getTestSpec(projectId),
        readGeneration(projectId),
      ]);
      if (get().projectId !== projectId) return;
      // Phase-69-3：更新
      // set({ testSpec, status: "success" });
      // ↓↓
      set({
        testSpec,
        status: "success",
        generationFailure: generation.failure,
        // 作っている印は立てるだけにする(受け付けの直後に読んだ古い状態で、待つのを止めないため。
        // 下ろすのは onGenerated)
        ...(generation.generating ? { generating: true } : {}),
      });
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : "テスト仕様書の取得に失敗しました",
      });
    }
  },

  generate: async (projectId) => {
    // Phase-69-3：更新
    // set({ generating: true, generateError: null });
    // ↓↓
    set({ generating: true, generateError: null, generationFailure: null });
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

  // Phase-69-3：更新
  // onGenerated: (projectId) => {
  //   set({ generating: false });
  // ↓↓
  onGenerated: (projectId, project) => {
    set({
      generating: false,
      ...(project ? { generationFailure: failureFor(project.generation_failure, "test_spec") } : {}),
    });
    void get().fetchTestSpec(projectId);
  },
}));

// Phase-69-3:追記
// サーバーがテスト仕様書を作っているか(生成中で、進み具合の対象にテスト仕様書がある。進み具合が
// 読めなければ作っているとみなす)と、テスト仕様書を作り直そうとした直近の失敗。読めなければ、
// どちらも無いとみなす(テスト仕様書の表示は止めない)。
async function readGeneration(
  projectId: string,
): Promise<{ generating: boolean; failure: GenerationFailure | null }> {
  try {
    const project = await getProject(projectId);
    const failure = failureFor(project.generation_failure, "test_spec");
    if (project.status !== "generating") return { generating: false, failure };
    const progress = await getGenerationProgress(projectId).catch(() => null);
    return { generating: progress === null || progress.targets.includes("test_spec"), failure };
  } catch {
    return { generating: false, failure: null };
  }
}
