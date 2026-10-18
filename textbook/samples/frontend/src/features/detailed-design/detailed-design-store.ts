// 作成：Phase-15-7｜更新：Phase-16-6,18-9,18-9,20-4,21-4,21-7(画面確認後の修正),27-3,28-3,44-1,54-3,78-1
// 写経レベル: コア ── 承認の後に全段階を取り直す(後ろの段階が開く・古いが消える)。
// Phase-16-6:追記 ── @/features/detailed-design/api/designStagesApi.generateDesignStage, @/features/detailed-design/api/designStagesApi.saveDesignStage
// Phase-18-9:追記 ── @/features/detailed-design/labels.approvalBlockers
// Phase-21-4:追記 ── @/features/detailed-design/api/types.LogicTarget
// Phase-44-1:追記 ── @/features/detailed-design/api/designStagesApi(getDesignImpact, reviewImpactMarks), @/features/detailed-design/api/types.DesignImpactRead, @/features/detailed-design/impactOps(focusTargetFor, mayHaveImpact, regenerationArgs, resolveFixTarget)
import { create } from "zustand";
import {
  approveDesignStage,
  generateDesignStage,
  getDesignImpact,
  listDesignStages,
  reviewImpactMarks,
  saveDesignStage,
} from "@/features/detailed-design/api/designStagesApi";
import type {
  DesignImpactRead,
  DesignStageRead,
  LogicTarget,
} from "@/features/detailed-design/api/types";
import {
  focusTargetFor,
  mayHaveImpact,
  regenerationArgs,
  resolveFixTarget,
} from "@/features/detailed-design/impactOps";
import { approvalBlockers } from "@/features/detailed-design/labels";
// Phase-78-1：更新
// import { ApiError } from "@/lib/api/client";
// ↓↓
import { ApiError, isNotFound } from "@/lib/api/client";
import type { AsyncStatus } from "@/lib/api/types";

// Phase-21-4:追記
// 段階をまたいで移動した先(Phase 21)。target は、段階5なら手順ID(F-01#4)、段階6なら関数の鍵
// (logicOps の logicKey)。移動先のパネルが開いたときに読み、そのタブを開いて行を強調してから消す。
export type StageFocus = { stage: number; target: string };

// Phase-44-1:追記
// 段階の表で強調する行(要素のキー。impactOps の elementKey)。変更の影響の「表で見る」と「段階Nで直す」
// で立て、段階を移るまで残す(focus と違い、パネルが開いても消さない)。
export type StageHighlight = { stage: number; key: string };

// ── ここから Phase-15-7 の作成分 ──
// 詳細設計画面(SCR-008)の状態。段階の一覧と、選んでいる段階を持つ。
type DetailedDesignStore = {
  projectId: string | null;
  stages: DesignStageRead[];
  selectedStage: number;
  status: AsyncStatus;
  error: string | null;
  // Phase-78-1:追記
  // 段階の一覧の取得が404だった(プロジェクトが削除された・無い)。画面は本体の代わりに知らせを出す
  notFound: boolean;
  // 承認の失敗(409 VERSION_CONFLICT など)。段階の一覧の取得の失敗(error)とは分けて出す。
  actionError: string | null;
  approving: boolean;
  // Phase-16-6:追記
  saving: boolean;
  // 生成の受け付け(POST)を待っている間。受け付けた後の「生成中」は段階の generation_status で見る
  requestingGeneration: boolean;
  // Phase-21-4:追記
  focus: StageFocus | null;
  // Phase-21-7:追記(画面確認後の修正。保存・生成でパネルが作り直されてもタブを保つ)
  // パネルのタブの選択(鍵 → タブ)。保存・生成でパネルが作り直されても、開いていたタブに戻すため
  // (Phase 21 の画面確認後)。鍵は "5:procedure"・"6:outer"・"6:inner" など、段階と場所で決める。
  tabs: Record<string, string | null>;
  // Phase-44-1:追記
  // 変更の影響(印も承認後の編集も無ければ null。取得の失敗は impactError に出し、段階の一覧は出す)
  impact: DesignImpactRead | null;
  impactError: string | null;
  // 印の確認済みの切り替えを待っている間
  reviewing: boolean;
  highlight: StageHighlight | null;

  // ── ここから Phase-15-7 の作成分 ──
  fetchStages: (projectId: string) => Promise<void>;
  selectStage: (stage: number) => void;
  // Phase-18-9：更新
  // approve: (projectId: string, stage: number) => Promise<void>;
  // ↓↓
  // 承認できたら true(画面は承認の完了ダイアログを出す。Phase 18)
  approve: (projectId: string, stage: number) => Promise<boolean>;
  // Phase-16-6:追記
  // 保存に成功したら true(画面は編集中の内容を保存済みとして扱う)
  save: (
    projectId: string,
    stage: number,
    model: Record<string, unknown>,
  ) => Promise<boolean>;
  // Phase-21-4：更新(段階6の対象の関数 logics を足す)
  // // 段階5は functionIds で下書きを作る処理を選べる(Phase 20)
  // generate: (projectId: string, stage: number, functionIds?: string[]) => Promise<void>;
  // ↓↓
  // Phase-54-3：更新
  // // 段階5は functionIds で下書きを作る処理を、段階6は logics で関数を、段階8は unitIds で単位を選べる
  // ↓↓
  // 段階5は functionIds で下書きを作る処理を、段階6は logics で関数を、段階8は unitIds で単位を選べる。
  // findingIds は修正指示に入れる、AI 設計レビューの採用した指摘
  // (Phase 20・21・28)
  generate: (
    projectId: string,
    stage: number,
    functionIds?: string[],
    logics?: LogicTarget[],
    // Phase-28-3:追記
    unitIds?: string[],
    // Phase-54-3:追記
    findingIds?: string[],
  ) => Promise<void>;
  // Phase-44-1:追記
  // 段階の印を確認済み(reviewed=false で未確認)にする。確認できたら true
  reviewMarks: (
    projectId: string,
    stage: number,
    keys: string[],
    reviewed: boolean,
  ) => Promise<boolean>;
  // 再生成の候補(要素のキー)から、段階5・6・8 の部分再生成を呼ぶ
  regenerate: (projectId: string, stage: number, keys: string[]) => Promise<void>;
  // 変更の影響の「表で見る」: その段階へ移り、表の行を強調する
  showInTable: (stage: number, key: string) => void;
  // Phase-44-1：更新
  // // 05↔06 のバッジから、相手の段階のタブ・行へ移る(Phase 21)
  // ↓↓
  // 05↔06 のバッジ・「段階Nで直す」から、相手の段階のタブ・行へ移る(直す先の文字列から行を推定して強調する)
  jumpTo: (stage: number, target: string) => void;
  clearFocus: () => void;
  // Phase-21-7:追記(画面確認後の修正。保存・生成でパネルが作り直されてもタブを保つ)
  setTab: (key: string, value: string | null) => void;
};

// Phase-27-3：更新(段階1〜7 → 段階1〜8)
// 最初に開く段階: まだ承認されていない最初の段階(すべて承認済みなら段階8)。
export function firstPendingStage(stages: DesignStageRead[]): number {
  // Phase-27-3：更新
  // return stages.find((s) => s.state !== "approved")?.stage ?? 7;
  // ↓↓
  return stages.find((s) => s.state !== "approved")?.stage ?? 8;
}

// Phase-16-6:追記
const CODE_MESSAGES: Record<string, string> = {
  VERSION_CONFLICT:
    "他の画面でこの段階が更新されました。最新の内容を読み込み直しました。",
  DESIGN_STAGE_INVALID:
    "検証のエラーがあるため承認できません。エラーを直して保存してから承認してください。",
  DESIGN_STAGE_GENERATION_IN_PROGRESS:
    "この段階の下書きを生成中です。完了してからもう一度お試しください。",
  // Phase-44-1:追記
  DESIGN_STAGE_UNREVIEWED_IMPACT:
    "他の段階・文書の変更から届いた見直しの印が残っています。「変更の影響」で確かめて確認済みにしてから承認し直してください。",
};

function messageOf(err: unknown, fallback: string): string {
  // Phase-16-6：更新
  // if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
  //   return "他の画面でこの段階が更新されました。最新の内容を読み込み直しました。";
  // ↓↓
  if (err instanceof ApiError && err.code && CODE_MESSAGES[err.code]) {
    return CODE_MESSAGES[err.code];
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
    // Phase-78-1:追記
    notFound: false,
    actionError: null,
    approving: false,
    // Phase-16-6:追記
    saving: false,
    requestingGeneration: false,
    // Phase-21-4:追記
    focus: null,
    // Phase-21-7:追記(画面確認後の修正。保存・生成でパネルが作り直されてもタブを保つ)
    tabs: {},
    // ── ここから Phase-15-7 の作成分 ──
    // Phase-44-1:追記
    impact: null,
    impactError: null,
    reviewing: false,
    highlight: null,

    fetchStages: async (projectId) => {
      const switching = get().projectId !== projectId;
      set({
        status: "loading",
        error: null,
        // Phase-21-7：更新(画面確認後の修正。保存・生成でパネルが作り直されてもタブを保つ)
        // ...(switching ? { projectId, stages: [] } : {}),
        // ↓↓
        // Phase-44-1：更新
        // ...(switching ? { projectId, stages: [], tabs: {} } : {}),
        // ↓↓
        // Phase-78-1:追記
        notFound: false,
        ...(switching
          ? { projectId, stages: [], tabs: {}, impact: null, highlight: null }
          : {}),
        // ── ここから Phase-15-7 の作成分 ──
      });
      // Phase-44-1:追記
      let stages: DesignStageRead[];
      try {
        // Phase-44-1：更新
        // const stages = await listDesignStages(projectId);
        // ↓↓
        stages = await listDesignStages(projectId);
        set({
          stages,
          status: "success",
          ...(switching ? { selectedStage: firstPendingStage(stages) } : {}),
        });
      } catch (err) {
        set({
          status: "error",
          error: messageOf(err, "段階の取得に失敗しました"),
          // Phase-78-1:追記
          notFound: isNotFound(err),
        });
        // Phase-44-1:追記
        return;
      }
      // 印も承認後の編集も無ければ取りに行かない
      if (!mayHaveImpact(stages)) {
        set({ impact: null, impactError: null });
        return;
      }
      try {
        set({ impact: await getDesignImpact(projectId), impactError: null });
      } catch (err) {
        set({ impactError: messageOf(err, "変更の影響の取得に失敗しました") });
      }
    },

    // Phase-21-4：更新(段階を選び直したら、段階またぎの移動先を消す)
    // selectStage: (stage) => set({ selectedStage: stage, actionError: null }),
    // ↓↓
    // Phase-44-1：更新
    // selectStage: (stage) => set({ selectedStage: stage, actionError: null, focus: null }),
    // ↓↓
    selectStage: (stage) =>
      set({ selectedStage: stage, actionError: null, focus: null, highlight: null }),
    // ── ここから Phase-15-7 の作成分 ──

    approve: async (projectId, stage) => {
      const current = get().stages.find((s) => s.stage === stage);
      // Phase-18-9：更新(承認できたかを返す。以下の return false・return approved も同じ)
      // if (!current || current.version === null) return;
      // ↓↓
      if (!current || current.version === null) return false;
      // Phase-18-9:追記
      // 図(DFD・ER)が未承認なら、API を呼ばずに理由を出す(Phase 18)
      const blockers = approvalBlockers(current);
      if (blockers.length > 0) {
        set({
          actionError: [
            ...blockers.map((issue) => issue.message),
            "図のエディタで承認してから、段階を承認してください。",
          ].join(" "),
        });
        return false;
      }
      set({ approving: true, actionError: null });
      // Phase-18-9:追記
      let approved = false;
      try {
        await approveDesignStage(projectId, stage, current.version);
        // Phase-18-9:追記
        approved = true;
      } catch (err) {
        set({ actionError: messageOf(err, "承認に失敗しました") });
      } finally {
        set({ approving: false });
      }
      // 承認すると、後ろの段階が開いたり「古い」が消えたりするため、全段階を取り直す
      await get().fetchStages(projectId);
      // Phase-18-9:追記
      return approved;
    },

    // Phase-16-6:追記
    save: async (projectId, stage, model) => {
      const current = get().stages.find((s) => s.stage === stage);
      if (!current) return false;
      set({ saving: true, actionError: null });
      let saved = false;
      try {
        await saveDesignStage(projectId, stage, {
          version: current.version,
          model,
        });
        saved = true;
      } catch (err) {
        set({ actionError: messageOf(err, "保存に失敗しました") });
      } finally {
        set({ saving: false });
      }
      // 保存すると、承認済みの段階はレビュー中に戻り、後ろの段階が「古い」になるため、全段階を取り直す
      await get().fetchStages(projectId);
      return saved;
    },

    // Phase-20-4：更新
    // generate: async (projectId, stage) => {
    //   set({ requestingGeneration: true, actionError: null });
    //   try {
    //     await generateDesignStage(projectId, stage);
    //   } catch (err) {
    //     set({ actionError: messageOf(err, "下書きの生成を始められませんでした") });
    //   } finally {
    // ↓↓
    // Phase-21-4：更新(段階6の対象の関数 logics を渡す)
    // generate: async (projectId, stage, functionIds) => {
    //   set({ requestingGeneration: true, actionError: null });
    //   try {
    //     await generateDesignStage(projectId, stage, functionIds);
    // ↓↓
    // Phase-28-3：更新
    // generate: async (projectId, stage, functionIds, logics) => {
    // ↓↓
    // Phase-54-3：更新
    // generate: async (projectId, stage, functionIds, logics, unitIds) => {
    // ↓↓
    generate: async (projectId, stage, functionIds, logics, unitIds, findingIds) => {
      set({ requestingGeneration: true, actionError: null });
      try {
        // Phase-28-3：更新
        // await generateDesignStage(projectId, stage, functionIds, logics);
        // ↓↓
        // Phase-54-3：更新
        // await generateDesignStage(projectId, stage, functionIds, logics, unitIds);
        // ↓↓
        await generateDesignStage(projectId, stage, functionIds, logics, unitIds, findingIds);
      // ── ここから Phase-20-4 の作成分 ──
      } catch (err) {
        // 生成の受け付けの 409 DESIGN_STAGE_INVALID(対象の数・選択)は、承認の文言でなくサーバーの理由を出す
        const invalid = err instanceof ApiError && err.code === "DESIGN_STAGE_INVALID";
        set({
          actionError: invalid
            ? err.message
            : messageOf(err, "下書きの生成を始められませんでした"),
        });
      } finally {
        set({ requestingGeneration: false });
      }
      // 受け付けた段階は generation_status が generating になる(画面はそれを見てポーリングする)
      await get().fetchStages(projectId);
    },

    // Phase-21-4:追記
    // Phase-44-1：更新
    // jumpTo: (stage, target) =>
    //   set({ selectedStage: stage, actionError: null, focus: { stage, target } }),
    // ↓↓
    reviewMarks: async (projectId, stage, keys, reviewed) => {
      set({ reviewing: true, impactError: null });
      let done = false;
      try {
        await reviewImpactMarks(projectId, stage, keys, reviewed);
        done = true;
      } catch (err) {
        set({ impactError: messageOf(err, "確認済みにできませんでした") });
      } finally {
        set({ reviewing: false });
      }
      // 段階の一覧の印の件数も変わるため、全段階を取り直す
      await get().fetchStages(projectId);
      return done;
    },

    regenerate: async (projectId, stage, keys) => {
      const plan = get().stages.find((s) => s.stage === 8)?.plan ?? null;
      const args = regenerationArgs(stage, keys, plan);
      await get().generate(projectId, stage, args.functionIds, args.logics, args.unitIds);
    },

    showInTable: (stage, key) =>
      set({
        selectedStage: stage,
        actionError: null,
        highlight: { stage, key },
        // 段階5・6 はタブを開くため、既存の移動先も立てる
        focus:
          stage === 5 || stage === 6
            ? { stage, target: focusTargetFor(stage, "", key) }
            : null,
      }),

    jumpTo: (stage, target) => {
      const key = resolveFixTarget(stage, target, get().stages);
      set({
        selectedStage: stage,
        actionError: null,
        focus: { stage, target: focusTargetFor(stage, target, key) },
        highlight: key ? { stage, key } : null,
      });
    },

    clearFocus: () => set({ focus: null }),

    // Phase-21-7:追記(画面確認後の修正。保存・生成でパネルが作り直されてもタブを保つ)
    setTab: (key, value) => set((state) => ({ tabs: { ...state.tabs, [key]: value } })),
  }),
);
