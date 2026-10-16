// 作成：Phase-3-6｜更新：Phase-15-7,15-8,24(完了後の調整),36-3,53(完了後の調整),54-2,64-4
// Phase-53(完了後の調整):追記 ── ApiError(@/lib/api/client), getGenerationProgress・DocType・GenerationProgressRead(@/features/documents/api/documentsApi)
// Phase-15-7:追記 ── getProject(@/features/hearing/api/hearingApi), ProjectMode(@/features/dashboard/api/projects)
// Phase-36-3:追記 ── adoptRequirement(@/features/documents/api/documentsApi)
import { create } from "zustand";
import { ApiError } from "@/lib/api/client";
import { isCacheFresh } from "@/lib/api/cache";
import { adoptRequirement, getGenerationProgress, listDocuments } from "@/features/documents/api/documentsApi";
import type {
  DocType,
  GeneratedDocumentRead,
  GenerationProgressRead,
} from "@/features/documents/api/documentsApi";
// triggerGenerationはPhase 3-5(hearingApi.ts)のものをそのまま再利用する
// (プロジェクトの生成トリガー自体はヒアリング画面の承認・ドキュメント画面の再生成の
// どちらでも同じ1エンドポイントであり、機能固有のロジックを持たないため)。
import { getProject, triggerGeneration } from "@/features/hearing/api/hearingApi";
import type { ProjectMode } from "@/features/dashboard/api/projects";
import type { AsyncStatus } from "@/lib/api/types";

type DocumentsStore = {
  // Phase-24:追記
  // 今の内容がどのプロジェクトのものか。別のプロジェクトを開いたら内容を捨てて取り直す
  // (ストアは画面をまたいで残るため、キャッシュの判定にプロジェクトを含めないと、前の
  // プロジェクトの文書・タブが残る)。
  projectId: string | null;
  documents: GeneratedDocumentRead[];
  status: AsyncStatus;
  error: string | null;
  fetchedAt: number | null;
  regenerating: boolean;
  // Phase-15-8:追記 ── 再生成の受け付けの失敗(生成中の 409 DOC_GENERATION_IN_PROGRESS など)
  regenerateError: string | null;
  // Phase-24：更新
  // // プロジェクトのモード。詳細設計モードでは、設計図の生成ではなく詳細設計(SCR-008)へ進ませる。
  // ↓↓
  // プロジェクトのモード。詳細設計モードでは、詳細設計(SCR-008)へのリンクを出す。
  // 詳細設計(SCR-008)へ進ませる。取得するまでは null。
  projectMode: ProjectMode | null;
  // Phase-36-3:追記
  // Phase-64-4:追記
  // プロジェクトの名前(削除の確認・知らせに出す)。取得するまでは null。
  projectTitle: string | null;
  // 「採用にする」を押している要件ID と、その失敗
  adoptingId: string | null;
  adoptError: string | null;

  fetchDocuments: (projectId: string, options?: { force?: boolean }) => Promise<void>;
  // Phase-15-7:追記
  fetchProjectMode: (projectId: string) => Promise<void>;
  // Phase-53(完了後の調整)：更新
  // regenerate: (projectId: string) => Promise<void>;
  // ↓↓
  // startFrom は再生成の起点(その文書から下流を作り直す)。省略で全部
  // Phase-54-2：更新
  // regenerate: (projectId: string, startFrom?: DocType) => Promise<void>;
  // ↓↓
  // findingIds: 再生成の指示に入れる、AI 設計レビューの採用した指摘
  regenerate: (projectId: string, startFrom?: DocType, findingIds?: string[]) => Promise<void>;
  // Phase-53(完了後の調整):追記
  // 再生成の進み具合(生成していなければ null)。再生成中に取り直す
  progress: GenerationProgressRead | null;
  fetchProgress: (projectId: string) => Promise<void>;
  // useGenerationPollingのcompletedコールバックから呼ぶ。regeneratingを下ろし、
  // 一覧をforce再取得して新しいバージョンを反映する。
  onRegenerationCompleted: (projectId: string) => void;
  // Phase-36-3:追記
  // 推測の要件を「採用」にし、返った要件定義書で一覧の同じ文書を置き換える
  adoptRequirement: (projectId: string, reqId: string) => Promise<void>;
};

// Phase-24:追記
// 別のプロジェクトを開いたときに戻す値
const PROJECT_INITIAL = {
  documents: [] as GeneratedDocumentRead[],
  fetchedAt: null,
  regenerating: false,
  regenerateError: null,
  // Phase-53(完了後の調整):追記
  progress: null,
  projectMode: null,
  // Phase-36-3:追記
  // Phase-64-4:追記
  projectTitle: null,
  adoptingId: null,
  adoptError: null,
} as const;

export const useDocumentsStore = create<DocumentsStore>((set, get) => ({
  // Phase-24:追記
  projectId: null,
  documents: [],
  status: "idle",
  error: null,
  fetchedAt: null,
  regenerating: false,
  // Phase-15-8:追記
  regenerateError: null,
  // Phase-53(完了後の調整):追記
  progress: null,
  // Phase-15-7:追記
  projectMode: null,
  // Phase-36-3:追記
  // Phase-64-4:追記
  projectTitle: null,
  adoptingId: null,
  adoptError: null,

  fetchDocuments: async (projectId, { force = false } = {}) => {
    // Phase-24:追記
    switchProject(set, get, projectId);
    if (!force && isCacheFresh(get().fetchedAt)) return;
    set({ status: "loading", error: null });
    try {
      const documents = await listDocuments(projectId);
      // Phase-24:追記
      // 取得中に別のプロジェクトへ移っていたら、古い結果で上書きしない
      if (get().projectId !== projectId) return;
      set({ documents, status: "success", fetchedAt: Date.now() });
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : "ドキュメントの取得に失敗しました",
      });
    }
  },

  // Phase-15-7:追記
  fetchProjectMode: async (projectId) => {
    // Phase-24:追記
    switchProject(set, get, projectId);
    try {
      const project = await getProject(projectId);
      // Phase-24:追記
      if (get().projectId !== projectId) return;
      // Phase-53(完了後の調整)：更新
      // set({ projectMode: project.mode });
      // ↓↓
      // 生成中なら、再生成中として扱う(読み込み直した後・待つ時間の上限の後も、ボタンを押せなくし、
      // 完了を待ち直す。押すとサーバーは409を返すため)
      // Phase-64-4：更新
      // set({ projectMode: project.mode, ...(project.status === "generating" ? { regenerating: true } : {}) });
      // ↓↓
      set({
        projectMode: project.mode,
        projectTitle: project.title,
        ...(project.status === "generating" ? { regenerating: true } : {}),
      });
    } catch {
      // モードが分からなくても文書の表示は続ける(遷移先のリンクを出さないだけ)
      // Phase-64-4：更新
      // set({ projectMode: null });
      // ↓↓
      set({ projectMode: null, projectTitle: null });
    }
  },

  // Phase-15-8：更新(受け付けの失敗で regenerating が立ったままになり、Promise の失敗も
  // 放置されていた。気づき#4 の二度押し防止とあわせて直した)
  // regenerate: async (projectId) => {
  //   set({ regenerating: true });
  //   await triggerGeneration(projectId);
  // },
  // ↓↓
  // Phase-53(完了後の調整)：更新
  // regenerate: async (projectId) => {
  //   set({ regenerating: true, regenerateError: null });
  //   try {
  //     await triggerGeneration(projectId);
  // ↓↓
  // Phase-54-2：更新
  // regenerate: async (projectId, startFrom) => {
  // ↓↓
  regenerate: async (projectId, startFrom, findingIds = []) => {
    // 押した時点で regenerating にし、ボタンを無効にする(二度押しの防止。バックエンドも生成中は409)
    set({ regenerating: true, regenerateError: null, progress: null });
    try {
      // Phase-54-2：更新
      // await triggerGeneration(projectId, startFrom);
      // ↓↓
      await triggerGeneration(projectId, startFrom, findingIds);
    } catch (err) {
      // Phase-53(完了後の調整):追記
      // すでに生成中(別のタブ・前の再生成の続き)なら失敗にせず、その完了を待つ
      if (err instanceof ApiError && err.code === "DOC_GENERATION_IN_PROGRESS") return;
      set({
        regenerating: false,
        regenerateError: err instanceof Error ? err.message : "再生成の開始に失敗しました",
      });
    }
  },

  // Phase-53(完了後の調整):追記
  fetchProgress: async (projectId) => {
    try {
      const progress = await getGenerationProgress(projectId);
      if (get().projectId !== projectId) return;
      set({ progress });
    } catch {
      // 進み具合が取れなくても、完了の検知(プロジェクトの状態)は続ける
    }
  },

  onRegenerationCompleted: (projectId) => {
    // Phase-53(完了後の調整)：更新
    // set({ regenerating: false });
    // ↓↓
    set({ regenerating: false, progress: null });
    void get().fetchDocuments(projectId, { force: true });
  },

  // Phase-36-3:追記
  adoptRequirement: async (projectId, reqId) => {
    set({ adoptingId: reqId, adoptError: null });
    try {
      const updated = await adoptRequirement(projectId, reqId);
      if (get().projectId !== projectId) return;
      set({
        documents: get().documents.map((doc) => (doc.doc_type === updated.doc_type ? updated : doc)),
        adoptingId: null,
      });
    } catch (err) {
      set({
        adoptingId: null,
        adoptError: err instanceof Error ? err.message : "採用にできませんでした",
      });
    }
  },
}));

// Phase-24:追記
// 別のプロジェクトに移ったら、前のプロジェクトの内容を捨てる(detailed-design-store と同じ形)
function switchProject(
  set: (partial: Partial<DocumentsStore>) => void,
  get: () => DocumentsStore,
  projectId: string,
) {
  if (get().projectId === projectId) return;
  set({ projectId, ...PROJECT_INITIAL });
}
