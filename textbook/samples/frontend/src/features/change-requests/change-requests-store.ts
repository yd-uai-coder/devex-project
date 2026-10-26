// 作成：Phase-87-1｜更新：Phase-88-2,88(完了後の調整),89(完了後の調整),98-2,107-2,107-3,107-4,107-5,112-4
// Phase-89(完了後の調整)：更新
// import { triggerGeneration } from "@/features/hearing/api/hearingApi";
// ↓↓
// Phase-88-2:追記
// Phase-88(完了後の調整):追記
  // Phase-88-2:追記
  // Phase-88-2:追記
  // Phase-88-2:追記
  // Phase-88-2:追記
  // Phase-88-2：削除
  // listBaselineRequirements,
  // listBaselines,
  // Phase-88-2：削除
  // BaselineRequirementRead,
  // BaselineSummaryRead,
  // Phase-88-2:追記
// Phase-98-2:追記 ── @/features/baselines/api/baselinesApi.listBaselineOrigins, @/features/baselines/api/types.BaselineOriginRead
// Phase-107-2:追記 ── @/features/change-requests/api/changeRequestsApi.updateChangeRequestOptions, @/features/change-requests/api/types.ChangeRequestOptionsIn
// Phase-107-3:追記 ── @/features/change-requests/api/changeRequestsApi.adoptOptionDraft, @/features/change-requests/api/changeRequestsApi.createOptionDraft, @/features/change-requests/api/changeRequestsApi.getOptionDraft, @/features/change-requests/api/types.OptionDraftRead
// Phase-107-4:追記 ── @/features/change-requests/api/changeRequestsApi.createShareLink, @/features/change-requests/api/changeRequestsApi.extendShareLink, @/features/change-requests/api/changeRequestsApi.listShareLinks, @/features/change-requests/api/changeRequestsApi.revokeShareLink, @/features/change-requests/api/types.ShareLinkCreatedRead, @/features/change-requests/api/types.ShareLinkRead
// Phase-107-5:追記 ── @/features/change-requests/api/changeRequestsApi.listComments, @/features/change-requests/api/changeRequestsApi.replyComment, @/features/change-requests/api/types.ChangeRequestCommentRead
// Phase-112-4:追記 ── @/features/change-requests/api/changeRequestsApi.checkChangeRequestConflicts
import { create } from "zustand";
import { ApiError, isNotFound } from "@/lib/api/client";
import { isCacheFresh } from "@/lib/api/cache";
import type { AsyncStatus } from "@/lib/api/types";
import type { ProjectRead } from "@/features/dashboard/api/projects";
import { getProject, triggerGeneration } from "@/features/hearing/api/hearingApi";
import type { GenerationFailure } from "@/lib/generation-failure";
import { isDetailedModeOnly } from "@/features/change-requests/changeRequestOps";
import { listBaselineOrigins, listBaselineRequirements, listBaselines } from "@/features/baselines/api/baselinesApi";
import type {
  BaselineOriginRead,
  BaselineRequirementRead,
  BaselineSummaryRead,
} from "@/features/baselines/api/types";
import {
  adoptOptionDraft,
  checkChangeRequestConflicts,
  checkChangeRequestDocuments,
  confirmExplanationSummary,
  copyChangeRequest,
  createChangeRequest,
  createExplanationSummary,
  createOptionDraft,
  createShareLink,
  decideChangeRequest,
  editExplanationSummary,
  explainChangeRequest,
  extendShareLink,
  getChangeRequest,
  getChangeRequestComparison,
  getChangeRequestImpact,
  getChangeRequestTrace,
  getChangeRequestVerification,
  getExplanation,
  getOptionDraft,
  linkChangeRequestReview,
  listChangeRequests,
  listComments,
  listReviewCandidates,
  listShareLinks,
  replyComment,
  revokeShareLink,
  updateChangeRequest,
  updateChangeRequestOptions,
  verifyChangeRequest,
  withdrawChangeRequest,
} from "@/features/change-requests/api/changeRequestsApi";
import type {
  ChangeRequestCommentRead,
  ChangeRequestComparisonRead,
  ChangeRequestCreate,
  ChangeRequestDecision,
  ChangeRequestExplanationRead,
  ChangeRequestImpactRead,
  ChangeRequestOptionsIn,
  ChangeRequestRead,
  ChangeRequestSummaryRead,
  ChangeRequestTraceRead,
  ChangeRequestUpdate,
  ChangeRequestVerificationRead,
  OptionDraftRead,
  ReviewRunBriefRead,
  ShareLinkCreatedRead,
  ShareLinkRead,
} from "@/features/change-requests/api/types";

// 詳細のタブが読むもの(タブを開いたときに読む。CR が変わったら捨てる)
export type DetailViews = {
  impact: ChangeRequestImpactRead | null;
  comparison: ChangeRequestComparisonRead | null;
  verification: ChangeRequestVerificationRead | null;
  trace: ChangeRequestTraceRead | null;
  candidates: ReviewRunBriefRead[] | null;
  // Phase-88-2:追記
  explanation: ChangeRequestExplanationRead | null;
  // Phase-107-3:追記
  // 選択肢の LLM の下書き(読んだら draft。下書きが無ければ draft は null)
  optionDraft: { draft: OptionDraftRead | null } | null;
  // Phase-107-4:追記
  // 共有リンク(新しい順。取り消したものも)
  shareLinks: ShareLinkRead[] | null;
  // Phase-107-5:追記
  // コメント欄(クライアントのコメントごとに返信をまとめ、古い順)
  comments: ChangeRequestCommentRead[] | null;
};
export type DetailView = keyof DetailViews;

const VIEWS_INITIAL: DetailViews = {
  impact: null,
  comparison: null,
  verification: null,
  trace: null,
  candidates: null,
  // Phase-88-2:追記
  explanation: null,
  // Phase-107-3:追記
  optionDraft: null,
  // Phase-107-4:追記
  shareLinks: null,
  // Phase-107-5:追記
  comments: null,
};

// Phase-107-3:追記
// 下書きは作るまで無い(404)ので、無いことも読めた結果にする
async function fetchOptionDraft(projectId: string, number: number): Promise<{ draft: OptionDraftRead | null }> {
  try {
    return { draft: await getOptionDraft(projectId, number) };
  } catch (err) {
    if (isNotFound(err)) return { draft: null };
    throw err;
  }
}

const VIEW_FETCHERS: { [K in DetailView]: (projectId: string, number: number) => Promise<DetailViews[K]> } = {
  impact: getChangeRequestImpact,
  comparison: getChangeRequestComparison,
  verification: getChangeRequestVerification,
  trace: getChangeRequestTrace,
  candidates: listReviewCandidates,
  // Phase-88-2:追記
  explanation: getExplanation,
  // Phase-107-3:追記
  optionDraft: fetchOptionDraft,
  // Phase-107-4:追記
  shareLinks: listShareLinks,
  // Phase-107-5:追記
  comments: listComments,
};

type ChangeRequestsStore = {
  // 今の内容がどのプロジェクトのものか(別のプロジェクトを開いたら捨てる)
  projectId: string | null;
  list: ChangeRequestSummaryRead[];
  status: AsyncStatus;
  error: string | null;
  // 一覧の取得が404(プロジェクトが無い)
  notFound: boolean;
  // Phase-88(完了後の調整):追記
  // 簡易ドキュメントモードのプロジェクト(API が 409 DESIGN_STAGES_NOT_AVAILABLE で断った)
  unavailable: boolean;
  fetchedAt: number | null;
  // 合意済みの版(束)の一覧(作成のフォームの基準の束)。取得するまでは null
  baselines: BaselineSummaryRead[] | null;
  // 束の番号 → 要件定義書の写しの要件
  requirements: Record<number, BaselineRequirementRead[]>;
  // Phase-98-2:追記
  // 束の番号 → 新しい要件の予測の起点に選べる要素
  origins: Record<number, BaselineOriginRead[]>;

  // 開いている CR の詳細
  detail: ChangeRequestRead | null;
  detailStatus: AsyncStatus;
  detailError: string | null;
  detailNotFound: boolean;
  views: DetailViews;
  // タブの読み込みの失敗(比較は反映の前に 409 になる)
  viewErrors: Partial<Record<DetailView, string>>;

  // 作成・編集・状態の操作の実行中と、その失敗
  acting: boolean;
  actionError: string | null;
  // 文書への反映(再生成)の受け付けから完了まで
  reflecting: boolean;
  reflectError: string | null;
  reflectFailure: GenerationFailure | null;
  // Phase-88-2:追記
  // 説明書の要約の操作(作る = LLM・直す・確かめる)の実行中と、その失敗
  summaryActing: SummaryAction | null;
  summaryError: string | null;
  // Phase-107-3:追記
  // 選択肢の下書きの操作(作る = LLM・取り込む)の実行中と、その失敗
  draftActing: DraftAction | null;
  draftError: string | null;
  // Phase-107-4:追記
  // 作った共有リンク(トークンつき。作った直後だけ持ち、別の CR を開くと捨てる)
  createdLink: { number: number; link: ShareLinkCreatedRead } | null;
  // 共有リンクの操作(作る・取り消す・延ばす)の実行中と、その失敗
  shareActing: ShareAction | null;
  shareError: string | null;
  // Phase-107-5:追記
  // 返信の送信中のコメントの ID と、返信の失敗
  replying: string | null;
  replyError: string | null;

  fetchList: (projectId: string, options?: { force?: boolean }) => Promise<void>;
  fetchBaselines: (projectId: string) => Promise<void>;
  fetchRequirements: (projectId: string, baselineNumber: number) => Promise<void>;
  // Phase-98-2:追記
  fetchOrigins: (projectId: string, baselineNumber: number) => Promise<void>;
  fetchDetail: (projectId: string, number: number) => Promise<void>;
  fetchView: (projectId: string, number: number, view: DetailView) => Promise<void>;
  clearActionError: () => void;
  // 作れたら作った CR を返す(失敗は actionError)
  create: (projectId: string, body: ChangeRequestCreate) => Promise<ChangeRequestRead | null>;
  update: (projectId: string, number: number, body: ChangeRequestUpdate) => Promise<boolean>;
  // Phase-107-2:追記
  // 選択肢(案)だけを直す(説明済みは下書きに戻る)
  updateOptions: (projectId: string, number: number, options: ChangeRequestOptionsIn) => Promise<boolean>;
  explain: (projectId: string, number: number) => Promise<boolean>;
  // Phase-112-4:追記
  // 重なる CR の競合を、今の文と見比べて確かめた、にする
  checkConflicts: (projectId: string, number: number) => Promise<boolean>;
  decide: (projectId: string, number: number, body: ChangeRequestDecision) => Promise<boolean>;
  withdraw: (projectId: string, number: number, reason: string) => Promise<boolean>;
  // 写しの先を返す(画面はその番号へ移る)
  copy: (projectId: string, number: number) => Promise<ChangeRequestRead | null>;
  verify: (projectId: string, number: number, note: string) => Promise<boolean>;
  linkReview: (projectId: string, number: number, reviewRunId: string) => Promise<boolean>;
  checkDocuments: (projectId: string, number: number, keys: string[], reviewed: boolean) => Promise<void>;
  // CR を渡して要件定義書から文書を再生成する(完了は画面が useGenerationPolling で待つ)
  reflectDocuments: (projectId: string, number: number) => Promise<void>;
  onReflectionFinished: (projectId: string, number: number, project: ProjectRead) => void;
  // Phase-89(完了後の調整)：更新
  // // 生成中のプロジェクトを開いたとき、完了を待ち直す
  // setReflecting: (reflecting: boolean) => void;
  // ↓↓
  // 生成中のプロジェクトで詳細を開いたとき(生成中に別の画面へ移って戻ったときなど)、完了を待ち直す
  resumeReflection: (projectId: string) => Promise<void>;
  // Phase-88-2:追記
  // 要約の操作。応答の説明書で説明書のタブの内容を置き換える(CR の状態は変わらない)
  summarize: (projectId: string, number: number) => Promise<boolean>;
  editSummary: (projectId: string, number: number, text: string) => Promise<boolean>;
  confirmSummary: (projectId: string, number: number) => Promise<boolean>;
  // Phase-107-3:追記
  // 選択肢の下書きを作る(応答で下書きのビューを置き換える)・取り込む(CR の案になり、詳細を置き換える)
  draftOptions: (projectId: string, number: number) => Promise<boolean>;
  adoptDraft: (projectId: string, number: number) => Promise<boolean>;
  // Phase-107-4:追記
  // 共有リンクを作り、CR を読み直す(下書きは説明済みになり、前のリンクは取り消しになる)
  createShare: (projectId: string, number: number, expiresInDays: number) => Promise<boolean>;
  revokeShare: (projectId: string, number: number, linkId: string) => Promise<boolean>;
  extendShare: (projectId: string, number: number, linkId: string, expiresInDays: number) => Promise<boolean>;
  dismissCreatedLink: () => void;
  // Phase-107-5:追記
  // クライアントのコメントに返信する(返ったコメントで一覧の同じコメントを置き換える)
  reply: (projectId: string, number: number, commentId: string, body: string) => Promise<boolean>;
};

// Phase-88-2:追記
export type SummaryAction = "create" | "edit" | "confirm";
// Phase-107-3:追記
export type DraftAction = "create" | "adopt";
// Phase-107-4:追記
export type ShareAction = "create" | "revoke" | "extend";

const PROJECT_INITIAL = {
  list: [] as ChangeRequestSummaryRead[],
  status: "idle" as AsyncStatus,
  error: null,
  notFound: false,
  // Phase-88(完了後の調整):追記
  unavailable: false,
  fetchedAt: null,
  baselines: null,
  requirements: {},
  // Phase-98-2:追記
  origins: {},
  detail: null,
  detailStatus: "idle" as AsyncStatus,
  detailError: null,
  detailNotFound: false,
  views: VIEWS_INITIAL,
  viewErrors: {},
  acting: false,
  actionError: null,
  reflecting: false,
  reflectError: null,
  reflectFailure: null,
  // Phase-88-2:追記
  summaryActing: null,
  summaryError: null,
  // Phase-107-3:追記
  draftActing: null,
  draftError: null,
  // Phase-107-4:追記
  createdLink: null,
  shareActing: null,
  shareError: null,
  // Phase-107-5:追記
  replying: null,
  replyError: null,
};

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export const useChangeRequestsStore = create<ChangeRequestsStore>((set, get) => {
  // 詳細を新しい CR で置き換える。状態が変わると予測・比較・検証・記録も変わるので、タブの内容を捨て、
  // 一覧の鮮度も落とす
  const replaceDetail = (projectId: string, cr: ChangeRequestRead) => {
    if (get().projectId !== projectId) return;
    set({ detail: cr, views: VIEWS_INITIAL, viewErrors: {}, fetchedAt: null });
  };

  // 状態の操作の共通の流れ(実行中の印・失敗の文・詳細の置き換え)
  const act = async (
    projectId: string,
    run: () => Promise<ChangeRequestRead>,
    fallback: string,
    { replace = true }: { replace?: boolean } = {},
  ): Promise<ChangeRequestRead | null> => {
    set({ acting: true, actionError: null });
    try {
      const cr = await run();
      if (replace) replaceDetail(projectId, cr);
      else set({ fetchedAt: null });
      set({ acting: false });
      return cr;
    } catch (err) {
      set({ acting: false, actionError: message(err, fallback) });
      return null;
    // Phase-88-2:追記
    }
  };

  const summaryAct = async (
    projectId: string,
    number: number,
    action: SummaryAction,
    run: () => Promise<ChangeRequestExplanationRead>,
    fallback: string,
  ): Promise<boolean> => {
    set({ summaryActing: action, summaryError: null });
    try {
      const explanation = await run();
      if (get().projectId !== projectId || get().detail?.number !== number) return false;
      set({ summaryActing: null, views: { ...get().views, explanation } });
      return true;
    } catch (err) {
      set({ summaryActing: null, summaryError: message(err, fallback) });
      return false;
    }
  };

  // Phase-107-4:追記
  // 共有リンク1本の操作。応答のリンクで一覧の同じ行を置き換える
  const shareLinkAct = async (
    projectId: string,
    number: number,
    action: ShareAction,
    run: () => Promise<ShareLinkRead>,
    fallback: string,
  ): Promise<boolean> => {
    set({ shareActing: action, shareError: null });
    try {
      const link = await run();
      if (get().projectId !== projectId || get().detail?.number !== number) return false;
      const links = get().views.shareLinks;
      set({
        shareActing: null,
        views: { ...get().views, shareLinks: links ? links.map((l) => (l.id === link.id ? link : l)) : links },
      });
      return true;
    } catch (err) {
      set({ shareActing: null, shareError: message(err, fallback) });
      return false;
    }
  };

  return {
    projectId: null,
    ...PROJECT_INITIAL,

    fetchList: async (projectId, { force = false } = {}) => {
      switchProject(set, get, projectId);
      if (!force && isCacheFresh(get().fetchedAt)) return;
      set({ status: "loading", error: null, notFound: false });
      try {
        const list = await listChangeRequests(projectId);
        if (get().projectId !== projectId) return;
        set({ list, status: "success", fetchedAt: Date.now() });
      } catch (err) {
        // Phase-88(完了後の調整)：更新
        // set({ status: "error", error: message(err, "変更要求の取得に失敗しました"), notFound: isNotFound(err) });
        // ↓↓
        set({
          status: "error",
          error: message(err, "変更要求の取得に失敗しました"),
          notFound: isNotFound(err),
          unavailable: isDetailedModeOnly(err),
        });
      }
    },

    fetchBaselines: async (projectId) => {
      switchProject(set, get, projectId);
      try {
        const baselines = await listBaselines(projectId);
        if (get().projectId !== projectId) return;
        set({ baselines });
      } catch (err) {
        // Phase-88(完了後の調整)：更新
        // set({ baselines: [], actionError: message(err, "合意済みの版の取得に失敗しました") });
        // ↓↓
        set({
          baselines: [],
          actionError: message(err, "合意済みの版の取得に失敗しました"),
          unavailable: isDetailedModeOnly(err),
        });
      }
    },

    fetchRequirements: async (projectId, baselineNumber) => {
      switchProject(set, get, projectId);
      if (get().requirements[baselineNumber]) return;
      try {
        const rows = await listBaselineRequirements(projectId, baselineNumber);
        if (get().projectId !== projectId) return;
        set({ requirements: { ...get().requirements, [baselineNumber]: rows } });
      } catch (err) {
        // Phase-88(完了後の調整)：更新
        // set({ actionError: message(err, "合意済みの版の要件の取得に失敗しました") });
        // ↓↓
        set({ actionError: message(err, "合意済みの版の要件の取得に失敗しました"), unavailable: isDetailedModeOnly(err) });
      // Phase-98-2:追記
      }
    },

    fetchOrigins: async (projectId, baselineNumber) => {
      switchProject(set, get, projectId);
      if (get().origins[baselineNumber]) return;
      try {
        const rows = await listBaselineOrigins(projectId, baselineNumber);
        if (get().projectId !== projectId) return;
        set({ origins: { ...get().origins, [baselineNumber]: rows } });
      } catch (err) {
        set({ actionError: message(err, "予測の起点の候補の取得に失敗しました"), unavailable: isDetailedModeOnly(err) });
      }
    },

    fetchDetail: async (projectId, number) => {
      switchProject(set, get, projectId);
      const same = get().detail?.number === number;
      set({
        detailStatus: "loading",
        detailError: null,
        detailNotFound: false,
        // Phase-107-4：更新
        // ...(same ? {} : { detail: null, views: VIEWS_INITIAL, viewErrors: {}, actionError: null }),
        // ↓↓
        ...(same ? {} : { detail: null, views: VIEWS_INITIAL, viewErrors: {}, actionError: null, createdLink: null }),
      });
      try {
        const detail = await getChangeRequest(projectId, number);
        if (get().projectId !== projectId) return;
        set({ detail, detailStatus: "success", views: VIEWS_INITIAL, viewErrors: {} });
      } catch (err) {
        set({
          detailStatus: "error",
          detailError: message(err, "変更要求の取得に失敗しました"),
          detailNotFound: isNotFound(err),
          // Phase-88(完了後の調整):追記
          unavailable: isDetailedModeOnly(err),
        });
      }
    },

    fetchView: async (projectId, number, view) => {
      try {
        const data = await VIEW_FETCHERS[view](projectId, number);
        if (get().projectId !== projectId || get().detail?.number !== number) return;
        const viewErrors = { ...get().viewErrors };
        delete viewErrors[view];
        set({ views: { ...get().views, [view]: data }, viewErrors });
      } catch (err) {
        set({ viewErrors: { ...get().viewErrors, [view]: message(err, "読み込みに失敗しました") } });
      }
    },

    clearActionError: () => set({ actionError: null }),

    create: (projectId, body) =>
      act(projectId, () => createChangeRequest(projectId, body), "変更要求を作れませんでした", { replace: false }),

    update: async (projectId, number, body) =>
      (await act(projectId, () => updateChangeRequest(projectId, number, body), "変更要求を直せませんでした")) !==
      null,

    // Phase-107-2:追記
    updateOptions: async (projectId, number, options) =>
      (await act(projectId, () => updateChangeRequestOptions(projectId, number, options), "案を保存できませんでした")) !==
      null,

    explain: async (projectId, number) =>
      (await act(projectId, () => explainChangeRequest(projectId, number), "説明済みにできませんでした")) !== null,

    // Phase-112-4:追記
    checkConflicts: async (projectId, number) =>
      (await act(projectId, () => checkChangeRequestConflicts(projectId, number), "確かめた印を付けられませんでした")) !==
      null,

    decide: async (projectId, number, body) =>
      (await act(projectId, () => decideChangeRequest(projectId, number, body), "判断を記録できませんでした")) !==
      null,

    withdraw: async (projectId, number, reason) =>
      (await act(projectId, () => withdrawChangeRequest(projectId, number, reason), "取り下げられませんでした")) !==
      null,

    copy: (projectId, number) =>
      act(projectId, () => copyChangeRequest(projectId, number), "写せませんでした", { replace: false }),

    verify: async (projectId, number, note) =>
      (await act(projectId, () => verifyChangeRequest(projectId, number, note), "検証済みにできませんでした")) !==
      null,

    linkReview: async (projectId, number, reviewRunId) =>
      (await act(
        projectId,
        () => linkChangeRequestReview(projectId, number, reviewRunId),
        "レビューを結べませんでした",
      )) !== null,

    checkDocuments: async (projectId, number, keys, reviewed) => {
      set({ acting: true, actionError: null });
      try {
        const verification = await checkChangeRequestDocuments(projectId, number, keys, reviewed);
        if (get().projectId !== projectId) return;
        set({ acting: false, views: { ...get().views, verification } });
      } catch (err) {
        set({ acting: false, actionError: message(err, "確認の項目を変えられませんでした") });
      }
    },

    reflectDocuments: async (projectId, number) => {
      // 押した時点でボタンを無効にする(二度押しの防止。サーバーも生成中は409)
      set({ reflecting: true, reflectError: null, reflectFailure: null });
      try {
        await triggerGeneration(projectId, undefined, [], number);
      } catch (err) {
        // すでに生成中なら失敗にせず、その完了を待つ
        if (err instanceof ApiError && err.code === "DOC_GENERATION_IN_PROGRESS") return;
        set({ reflecting: false, reflectError: message(err, "反映(再生成)を始められませんでした") });
      }
    },

    onReflectionFinished: (projectId, number, project) => {
      set({ reflecting: false, reflectFailure: project.generation_failure ?? null });
      // 文書の再生成が成功すると、CR は反映済みになる(時系列・比較も変わる)
      void get().fetchDetail(projectId, number);
    },

    // Phase-89(完了後の調整)：更新
    // setReflecting: (reflecting) => set({ reflecting }),
    // ↓↓
    resumeReflection: async (projectId) => {
      try {
        const project = await getProject(projectId);
        if (project.status === "generating" && get().projectId === projectId) set({ reflecting: true });
      } catch {
        // 読めなければ待たない(反映を押せば、生成中の 409 から待ち直せる)
      }
    },

    // Phase-88-2:追記
    summarize: (projectId, number) =>
      summaryAct(projectId, number, "create", () => createExplanationSummary(projectId, number), "要約を作れませんでした"),

    editSummary: (projectId, number, text) =>
      summaryAct(projectId, number, "edit", () => editExplanationSummary(projectId, number, text), "要約を保存できませんでした"),

    confirmSummary: (projectId, number) =>
      summaryAct(projectId, number, "confirm", () => confirmExplanationSummary(projectId, number), "確認を記録できませんでした"),

    // Phase-107-3:追記
    draftOptions: async (projectId, number) => {
      set({ draftActing: "create", draftError: null });
      try {
        const draft = await createOptionDraft(projectId, number);
        if (get().projectId !== projectId || get().detail?.number !== number) return false;
        set({ draftActing: null, views: { ...get().views, optionDraft: { draft } } });
        return true;
      } catch (err) {
        set({ draftActing: null, draftError: message(err, "下書きを作れませんでした") });
        return false;
      }
    },

    // Phase-107-4:追記
    createShare: async (projectId, number, expiresInDays) => {
      set({ shareActing: "create", shareError: null });
      try {
        const link = await createShareLink(projectId, number, expiresInDays);
        if (get().projectId !== projectId || get().detail?.number !== number) return false;
        set({ createdLink: { number, link } });
        replaceDetail(projectId, await getChangeRequest(projectId, number));
        set({ shareActing: null });
        return true;
      } catch (err) {
        set({ shareActing: null, shareError: message(err, "共有リンクを作れませんでした") });
        return false;
      }
    },

    revokeShare: (projectId, number, linkId) =>
      shareLinkAct(projectId, number, "revoke", () => revokeShareLink(projectId, number, linkId), "取り消せませんでした"),

    extendShare: (projectId, number, linkId, expiresInDays) =>
      shareLinkAct(
        projectId,
        number,
        "extend",
        () => extendShareLink(projectId, number, linkId, expiresInDays),
        "期限を延ばせませんでした",
      ),

    dismissCreatedLink: () => set({ createdLink: null }),

    // Phase-107-5:追記
    reply: async (projectId, number, commentId, body) => {
      set({ replying: commentId, replyError: null });
      try {
        const thread = await replyComment(projectId, number, commentId, body);
        if (get().projectId !== projectId || get().detail?.number !== number) return false;
        const comments = get().views.comments;
        set({
          replying: null,
          // 返信は時系列にも1行残るので、記録のタブは読み直させる
          views: {
            ...get().views,
            comments: comments ? comments.map((c) => (c.id === thread.id ? thread : c)) : comments,
            trace: null,
          },
        });
        return true;
      } catch (err) {
        set({ replying: null, replyError: message(err, "返信できませんでした") });
        return false;
      }
    },

    adoptDraft: async (projectId, number) => {
      set({ draftActing: "adopt", draftError: null });
      try {
        const cr = await adoptOptionDraft(projectId, number);
        replaceDetail(projectId, cr);
        set({ draftActing: null });
        return true;
      } catch (err) {
        set({ draftActing: null, draftError: message(err, "下書きを取り込めませんでした") });
        return false;
      }
    },
  };
});

// 別のプロジェクトに移ったら、前のプロジェクトの内容を捨てる(documents-store と同じ形)
function switchProject(
  set: (partial: Partial<ChangeRequestsStore>) => void,
  get: () => ChangeRequestsStore,
  projectId: string,
) {
  if (get().projectId === projectId) return;
  set({ projectId, ...PROJECT_INITIAL });
}
