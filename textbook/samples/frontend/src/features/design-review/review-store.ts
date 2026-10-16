// 作成：Phase-53-3｜更新：Phase-54-1,54-4,68-4
// Phase-54-1:追記 ── @/features/design-review/api/reviewApi.ReviewFindingRead, @/features/design-review/api/reviewApi.requestRehearing
import { create } from "zustand";
import { isCacheFresh } from "@/lib/api/cache";
import {
  decideFinding,
  getCurrentUser,
  listReviewGates,
  // Phase-54-1:追記
  requestRehearing,
  requestReview,
  updateReviewSettings,
} from "@/features/design-review/api/reviewApi";
import type {
  CurrentUserRead,
  FindingDecision,
  // Phase-54-1:追記
  ReviewFindingRead,
  ReviewGate,
  ReviewGateSummaryRead,
} from "@/features/design-review/api/reviewApi";
import type { AsyncStatus } from "@/lib/api/types";

// 設計レビューのパネル(プレビュー SCR-005・作業領域 SCR-008 で共通)のストア。区切りの状態は
// Phase-68-4：更新
// // プロジェクトごと、ログイン中のユーザー(superuser か・設定)はプロジェクトによらない。
// ↓↓
// プロジェクトごと、ログイン中のユーザー(レビューを使えるか・設定)はプロジェクトによらない。
type ReviewStore = {
  projectId: string | null;
  gates: ReviewGateSummaryRead[];
  status: AsyncStatus;
  error: string | null;
  fetchedAt: number | null;
  // ログイン中のユーザー。取得するまでは null(パネルを出さない)
  me: CurrentUserRead | null;
  savingSetting: boolean;
  // 受け付けを待っている区切りと、操作(流す・採否・設定)の失敗
  requesting: ReviewGate | null;
  decidingId: string | null;
  actionError: string | null;

  fetchMe: () => Promise<void>;
  setReviewEnabled: (enabled: boolean) => Promise<void>;
  fetchGates: (projectId: string, options?: { force?: boolean }) => Promise<void>;
  // 区切りのレビューを流す。受け付けたら区切りを取り直す(実行中になる)。受け付けたかを返す
  runReview: (projectId: string, gate: ReviewGate) => Promise<boolean>;
  decide: (projectId: string, findingId: string, decision: FindingDecision) => Promise<void>;
  // Phase-54-1:追記
  // 採用したヒアリングの指摘で聞き直す(観点を未決に戻し、チャットに問いかけを出す)。受け付けたかを返す
  rehear: (projectId: string, findingIds: string[]) => Promise<boolean>;
  rehearing: boolean;
};

const PROJECT_INITIAL = {
  gates: [] as ReviewGateSummaryRead[],
  status: "idle" as AsyncStatus,
  error: null,
  fetchedAt: null,
  requesting: null,
  decidingId: null,
  actionError: null,
  // Phase-54-1:追記
  rehearing: false,
} as const;

const messageOf = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export const useReviewStore = create<ReviewStore>((set, get) => ({
  projectId: null,
  ...PROJECT_INITIAL,
  me: null,
  savingSetting: false,

  fetchMe: async () => {
    try {
      set({ me: await getCurrentUser() });
    } catch {
      // ユーザーが取れなければパネルを出さない(文書・段階の表示は続ける)
      set({ me: null });
    }
  },

  setReviewEnabled: async (enabled) => {
    set({ savingSetting: true, actionError: null });
    try {
      set({ me: await updateReviewSettings(enabled), savingSetting: false });
    } catch (err) {
      set({ savingSetting: false, actionError: messageOf(err, "設定を変えられませんでした") });
    }
  },

  fetchGates: async (projectId, { force = false } = {}) => {
    switchProject(set, get, projectId);
    if (!force && isCacheFresh(get().fetchedAt)) return;
    set({ status: "loading", error: null });
    try {
      const gates = await listReviewGates(projectId);
      // 取得中に別のプロジェクトへ移っていたら、古い結果で上書きしない
      if (get().projectId !== projectId) return;
      set({ gates, status: "success", fetchedAt: Date.now() });
    } catch (err) {
      set({ status: "error", error: messageOf(err, "レビューの状態を取得できませんでした") });
    }
  },

  runReview: async (projectId, gate) => {
    set({ requesting: gate, actionError: null });
    try {
      await requestReview(projectId, gate);
      set({ requesting: null });
      await get().fetchGates(projectId, { force: true });
      return true;
    } catch (err) {
      set({ requesting: null, actionError: messageOf(err, "レビューを始められませんでした") });
      return false;
    }
  },

  // Phase-54-1:追記
  rehear: async (projectId, findingIds) => {
    set({ rehearing: true, actionError: null });
    try {
      await requestRehearing(projectId, findingIds);
      set({ rehearing: false });
      return true;
    } catch (err) {
      set({ rehearing: false, actionError: messageOf(err, "聞き直しを始められませんでした") });
      return false;
    }
  },

  decide: async (projectId, findingId, decision) => {
    set({ decidingId: findingId, actionError: null });
    try {
      const updated = await decideFinding(projectId, findingId, decision);
      if (get().projectId !== projectId) return;
      set({
        decidingId: null,
        // Phase-54-1：更新
        // gates: get().gates.map((g) =>
        //   g.run
        //     ? { ...g, run: { ...g.run, findings: g.run.findings.map((f) => (f.id === updated.id ? updated : f)) } }
        //     : g,
        // ),
        // ↓↓
        gates: get().gates.map((g) => {
          const replace = (f: ReviewFindingRead) => (f.id === updated.id ? updated : f);
          return {
            ...g,
            run: g.run ? { ...g.run, findings: g.run.findings.map(replace) } : g.run,
            adopted_before: g.adopted_before.map(replace),
          };
        }),
      });
    } catch (err) {
      set({ decidingId: null, actionError: messageOf(err, "採否を記録できませんでした") });
    }
  },
}));

// 別のプロジェクトに移ったら、前のプロジェクトの区切りを捨てる(documents-store と同じ形)
function switchProject(
  set: (partial: Partial<ReviewStore>) => void,
  get: () => ReviewStore,
  projectId: string,
) {
  if (get().projectId === projectId) return;
  set({ projectId, ...PROJECT_INITIAL });
}
