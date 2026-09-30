// 作成：Phase-11-4｜更新：Phase-13-6
// 写経レベル: コア ── ポーリングの継続条件(isGenerating)と、受け付け後に一覧を取り直してポーリングを始める流れ。
import { create } from "zustand";
import { isCacheFresh } from "@/lib/api/cache";
import {
  generateDiagrams,
  getCandidates,
  listDiagrams,
  listGenerationRuns,
} from "@/features/uml/api/umlApi";
import type {
  UmlCandidatesRead,
  UmlDiagramRead,
  UmlGenerateRequest,
  UmlGenerationRunRead,
} from "@/features/uml/api/types";
import type { AsyncStatus } from "@/lib/api/types";

// 生成・一覧画面(/projects/[id]/uml)の状態。図の一覧・生成候補・生成履歴をまとめて持つ。
type UmlStore = {
  projectId: string | null;
  diagrams: UmlDiagramRead[];
  candidates: UmlCandidatesRead | null;
  runs: UmlGenerationRunRead[];
  status: AsyncStatus;
  error: string | null;
  fetchedAt: number | null;
  // 生成の受け付け(POST /diagrams)の失敗。400/409 の detail をそのまま見せる。
  generateError: string | null;
  submitting: boolean;

  fetchAll: (projectId: string, options?: { force?: boolean }) => Promise<void>;
  // ポーリング用。候補は生成で変わらないため、図の一覧と生成履歴だけを取り直す。
  refresh: (projectId: string) => Promise<void>;
  generate: (projectId: string, request: UmlGenerateRequest) => Promise<void>;
};

// 生成中の図が1件でもあるか。ポーリングの継続条件と、生成ボタンの無効化に使う
// (バックエンドはプロジェクト内に generating の図があると 409 UML_GENERATION_IN_PROGRESS を返す)。
export function isGenerating(diagrams: UmlDiagramRead[]): boolean {
  return diagrams.some((d) => d.generation_status === "generating");
}

// Phase-13-6:追記
// 図を生成した後に、内部設計書が再生成・復元されたか(図が古い)。devex-api
// app/uml/sync/staleness.py の source_outdated と同じ規則(「等しくない」で比べる ── 復元で
// 版の番号が下がることがあるため)。一覧画面では、取得済みの生成候補の版と比べる
// (SVG を含む GET .../embeds を一覧のために呼ばない)。
export function isSourceOutdated(diagram: UmlDiagramRead, currentVersion: number | null): boolean {
  const source = diagram.source_doc_versions?.internal_design;
  return source != null && currentVersion != null && source !== currentVersion;
}

// ── ここから Phase-11-4 の作成分 ──
export const useUmlStore = create<UmlStore>((set, get) => ({
  projectId: null,
  diagrams: [],
  candidates: null,
  runs: [],
  status: "idle",
  error: null,
  fetchedAt: null,
  generateError: null,
  submitting: false,

  fetchAll: async (projectId, { force = false } = {}) => {
    // 別プロジェクトのキャッシュは使わない
    if (!force && get().projectId === projectId && isCacheFresh(get().fetchedAt)) return;
    set({ projectId, status: "loading", error: null });
    try {
      const [diagrams, candidates, runs] = await Promise.all([
        listDiagrams(projectId),
        getCandidates(projectId),
        listGenerationRuns(projectId),
      ]);
      set({ diagrams, candidates, runs, status: "success", fetchedAt: Date.now() });
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : "設計図の取得に失敗しました",
      });
    }
  },

  refresh: async (projectId) => {
    const [diagrams, runs] = await Promise.all([
      listDiagrams(projectId),
      listGenerationRuns(projectId),
    ]);
    set({ diagrams, runs, fetchedAt: Date.now() });
  },

  generate: async (projectId, request) => {
    set({ submitting: true, generateError: null });
    try {
      await generateDiagrams(projectId, request);
      // 受け付けた時点で対象の図は generating になっている。一覧を取り直すとポーリングが始まる。
      await get().refresh(projectId);
    } catch (err) {
      set({
        generateError: err instanceof Error ? err.message : "生成の受け付けに失敗しました",
      });
    } finally {
      set({ submitting: false });
    }
  },
}));
