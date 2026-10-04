// 作成：Phase-11-5｜更新：Phase-11-6,12-5,13-6,18-6
// 写経レベル: コア ── 正本(意味モデル+配置)と表示の分離、保存・自動レイアウト・検証の「先に保存してから」の順序、409 の扱い。
// Phase-11-6:追記 ── umlApi.validateDiagram, types(DfdElementType, ErColumn, ValidationResult),
//   @/features/uml/model/editOps の全操作と ElementPatch / RelationPatch
// Phase-12-5:追記 ── umlApi(approveDiagram, exportDiagram), types.ExportFormat, @/lib/api/download.saveFile
// Phase-13-6:追記 ── @/features/documents/documents-store.useDocumentsStore
// Phase-18-6:追記 ── @/features/uml/model/editOps.updateTableDescription
import { create } from "zustand";
import { ApiError } from "@/lib/api/client";
import { useDocumentsStore } from "@/features/documents/documents-store";
import {
  approveDiagram,
  computeLayout,
  exportDiagram,
  getDiagram,
  listDataItems,
  updateDiagram,
  validateDiagram,
} from "@/features/uml/api/umlApi";
import type {
  DataItemRead,
  DfdElementType,
  ErColumn,
  ExportFormat,
  LayoutModel,
  SemanticModel,
  UmlDiagramRead,
  ValidationResult,
} from "@/features/uml/api/types";
import {
  applyMovedPositions,
  placeMissingNodes,
  type Position,
} from "@/features/uml/adapters/reactFlowAdapter";
import {
  addColumn,
  addElement,
  addRelation,
  deleteColumn,
  deleteElement,
  deleteRelation,
  updateColumn,
  updateTableDescription,
  updateElement,
  updateRelation,
  type ElementPatch,
  type RelationPatch,
} from "@/features/uml/model/editOps";
import type { AsyncStatus } from "@/lib/api/types";
import { saveFile } from "@/lib/api/download";

// Phase-11-6:追記
// 属性パネルで編集する対象。キャンバスでの選択と同期する。
export type Selection = { kind: "element" | "relation"; id: string } | null;

// レビュー画面(/projects/[id]/uml/[diagramId])の編集状態。
// 正本は意味モデル(model)で、React Flow の nodes/edges は表示のたびに model + layout から作る。
// diagram はサーバーが最後に返した状態(version を楽観ロックに使う)。
type UmlEditorStore = {
  projectId: string | null;
  diagram: UmlDiagramRead | null;
  model: SemanticModel | null;
  // 表示用の配置。サーバーの layout_model に、配置の無い要素の格子配置を補ったもの(常に全要素を含む)。
  layout: LayoutModel | null;
  dataItems: DataItemRead[];
  dirty: boolean;
  status: AsyncStatus;
  error: string | null;
  saving: boolean;
  layingOut: boolean;
  // 409 VERSION_CONFLICT。他の画面・再生成で更新された。再読み込みするまで保存できない。
  conflict: boolean;
  // 自動レイアウトできなかった理由(30件超・検証エラー等)。格子配置で表示を続ける。
  layoutNotice: string | null;
  // Phase-11-6:追記
  selection: Selection;
  // 最後に実行した検証の結果(編集すると古くなるため null に戻す)
  validation: ValidationResult | null;
  validating: boolean;
  // Phase-12-5:追記
  approving: boolean;
  exporting: boolean;

  // ── ここから Phase-11-5 の作成分 ──
  load: (projectId: string, diagramId: string) => Promise<void>;
  moveNodes: (moved: Record<string, Position>) => void;
  save: () => Promise<boolean>;
  runLayout: () => Promise<void>;

  // Phase-11-6:追記
  select: (selection: Selection) => void;
  addElement: (dfdElementType?: DfdElementType) => void;
  updateElement: (id: string, patch: ElementPatch) => void;
  deleteElement: (id: string) => void;
  // DFD でデータ項目が0件のときは追加せず false を返す
  addRelation: (sourceId: string, targetId: string) => boolean;
  updateRelation: (id: string, patch: RelationPatch) => void;
  deleteRelation: (id: string) => void;
  addColumn: (tableId: string) => void;
  updateColumn: (tableId: string, index: number, patch: Partial<ErColumn>) => void;
  deleteColumn: (tableId: string, index: number) => void;
  // Phase-18-6:追記
  // ER のテーブルの説明(テーブル定義の注記。Phase 18)
  updateTableDescription: (tableId: string, description: string) => void;
  validate: () => Promise<void>;
  // Phase-12-5:追記
  // 承認(M7)。未保存の変更があれば先に保存してから承認する
  approve: () => Promise<void>;
  // 出力(M8)。ファイルを保存させた後、図を取り直す(状態が exported になるため)
  exportDiagram: (format: ExportFormat) => Promise<void>;
};

const INITIAL = {
  projectId: null,
  diagram: null,
  model: null,
  layout: null,
  dataItems: [],
  dirty: false,
  status: "idle" as AsyncStatus,
  error: null,
  saving: false,
  layingOut: false,
  conflict: false,
  layoutNotice: null,
  // Phase-11-6:追記
  selection: null,
  validation: null,
  validating: false,
  // Phase-12-5:追記
  approving: false,
  exporting: false,
};

// Phase-11-6:追記

// 消した要素・関係のジオメトリを配置から除く。同じ id を後で再利用したとき
// (nextId は空いている最小の番号を使う)に古い座標・折れ点を引き継がないようにするため。
function withoutGeometry(layout: LayoutModel, ids: string[]): LayoutModel {
  const nodes = { ...layout.nodes };
  const edges = { ...layout.edges };
  for (const id of ids) {
    delete nodes[id];
    delete edges[id];
  }
  return { ...layout, nodes, edges };
}

// サーバーの図を編集状態へ取り込む(保存・自動レイアウトの応答でも使う)。
function fromServer(diagram: UmlDiagramRead) {
  return {
    diagram,
    model: diagram.semantic_model,
    layout: placeMissingNodes(diagram.semantic_model, diagram.layout_model),
    dirty: false,
  };
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// Phase-11-6：更新(編集アクションが共通処理 commit を使うため、オブジェクトを直接返す形から
// 関数本体を持つ形に変えた。既存のアクション(load〜runLayout)は1段深くなっただけで中身は変えていない)
// export const useUmlEditorStore = create<UmlEditorStore>((set, get) => ({
//   ...INITIAL,
//   ...
// }));
// ↓↓
export const useUmlEditorStore = create<UmlEditorStore>((set, get) => {
  // 意味モデルを編集した後の共通処理: 配置の無い要素を補い、未保存にし、検証結果を古いものとして捨てる
  const commit = (model: SemanticModel, layout: LayoutModel | null = get().layout) =>
    set({ model, layout: placeMissingNodes(model, layout), dirty: true, validation: null });

  return {
    ...INITIAL,

    load: async (projectId, diagramId) => {
      set({ ...INITIAL, projectId, status: "loading" });
      try {
        const [diagram, dataItems] = await Promise.all([
          getDiagram(projectId, diagramId),
          listDataItems(projectId),
        ]);
        set({ ...fromServer(diagram), dataItems, status: "success" });
        // 自動レイアウトの「初回」(M6): 生成直後は layout_model が null なので1回だけ実行する。
        // 以降は明示的な再実行のときだけ(手動で動かした座標を上書きしない)。
        if (
          diagram.layout_model === null &&
          diagram.generation_status !== "generating" &&
          diagram.semantic_model.elements.length > 0
        ) {
          await get().runLayout();
        }
      } catch (err) {
        set({ status: "error", error: messageOf(err, "設計図の取得に失敗しました") });
      }
    },

    moveNodes: (moved) => {
      const { layout, model } = get();
      if (!layout || !model) return;
      set({ layout: applyMovedPositions(layout, model, moved), dirty: true });
    },

    save: async () => {
      const { projectId, diagram, model, layout } = get();
      if (!projectId || !diagram || !model) return false;
      set({ saving: true, error: null });
      try {
        // 意味モデルと座標を1回の保存・1つの version で送る(Phase 11-1 で PUT を拡張)
        const saved = await updateDiagram(projectId, diagram.id, {
          version: diagram.version,
          semantic_model: model,
          layout_model: layout,
        });
        set(fromServer(saved));
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
          set({ conflict: true });
        } else {
          set({ error: messageOf(err, "保存に失敗しました") });
        }
        return false;
      } finally {
        set({ saving: false });
      }
    },

    runLayout: async () => {
      const { projectId, diagram } = get();
      if (!projectId || !diagram) return;
      // 自動レイアウトは DB に保存済みの意味モデルを配置する。未保存の編集があれば先に保存する。
      if (get().dirty && !(await get().save())) return;
      set({ layingOut: true, layoutNotice: null });
      try {
        const laidOut = await computeLayout(projectId, diagram.id);
        set(fromServer(laidOut));
      } catch (err) {
        // LAYOUT_NODE_LIMIT_EXCEEDED(30件超)・LAYOUT_VALIDATION_FAILED 等。
        // 図は見られるよう、格子配置のまま理由を表示する。
        if (err instanceof ApiError && err.code?.startsWith("LAYOUT_")) {
          set({ layoutNotice: `自動レイアウトできませんでした: ${err.message}` });
        } else {
          set({ error: messageOf(err, "自動レイアウトに失敗しました") });
        }
      } finally {
        set({ layingOut: false });
      }
    },

    // Phase-11-6:追記
    select: (selection) => set({ selection }),

    addElement: (dfdElementType) => {
      const { model } = get();
      if (!model) return;
      const result = addElement(model, dfdElementType);
      commit(result.model);
      set({ selection: { kind: "element", id: result.id } });
    },

    updateElement: (id, patch) => {
      const { model } = get();
      if (model) commit(updateElement(model, id, patch));
    },

    deleteElement: (id) => {
      const { model, layout } = get();
      if (!model || !layout) return;
      // 要素につながる関係も消えるため、その関係の折れ点も除く
      const removed = [
        id,
        ...model.relations.filter((r) => r.source_id === id || r.target_id === id).map((r) => r.id),
      ];
      commit(deleteElement(model, id), withoutGeometry(layout, removed));
      set({ selection: null });
    },

    addRelation: (sourceId, targetId) => {
      const { model, dataItems } = get();
      if (!model) return false;
      // DFD のフローはデータ辞書の項目を参照する。項目の管理 UI はまだ無いため、先頭の項目で作り、
      // 属性パネルで選び直してもらう。
      if (model.notation === "dfd" && dataItems.length === 0) return false;
      const result = addRelation(model, sourceId, targetId, { dataItemId: dataItems[0]?.id });
      const layout = get().layout;
      commit(result.model, layout ? withoutGeometry(layout, [result.id]) : layout);
      set({ selection: { kind: "relation", id: result.id } });
      return true;
    },

    updateRelation: (id, patch) => {
      const { model } = get();
      if (model) commit(updateRelation(model, id, patch));
    },

    deleteRelation: (id) => {
      const { model, layout } = get();
      if (!model || !layout) return;
      commit(deleteRelation(model, id), withoutGeometry(layout, [id]));
      set({ selection: null });
    },

    addColumn: (tableId) => {
      const { model } = get();
      if (model) commit(addColumn(model, tableId));
    },

    updateColumn: (tableId, index, patch) => {
      const { model } = get();
      if (model) commit(updateColumn(model, tableId, index, patch));
    },

    deleteColumn: (tableId, index) => {
      const { model } = get();
      if (model) commit(deleteColumn(model, tableId, index));
    },

    // Phase-18-6:追記
    updateTableDescription: (tableId, description) => {
      const { model } = get();
      if (model) commit(updateTableDescription(model, tableId, description));
    },

    // Phase-12-5:追記
    approve: async () => {
      const { projectId, diagram } = get();
      if (!projectId || !diagram) return;
      // 承認は DB に保存済みの版に対して行う。未保存の変更があれば先に保存する(検証と同じ順序)。
      if (get().dirty && !(await get().save())) return;
      set({ approving: true, error: null });
      try {
        // 保存した場合は version が変わっているので、get() で取り直した版を送る
        const current = get().diagram ?? diagram;
        set(fromServer(await approveDiagram(projectId, current.id, current.version)));
        // Phase-13-6:追記
        // 承認と同時に内部設計書へ反映される(本文が変わる)ので、文書一覧のキャッシュを捨てる
        useDocumentsStore.setState({ fetchedAt: null });
      } catch (err) {
        if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
          set({ conflict: true });
        } else if (err instanceof ApiError && err.code === "UML_APPROVAL_VALIDATION_FAILED") {
          // 検証エラーの一覧は検証パネルに出す(承認の応答は件数だけを返す)
          set({ error: err.message });
          await get().validate();
        } else {
          set({ error: messageOf(err, "承認に失敗しました") });
        }
      } finally {
        set({ approving: false });
      }
    },

    exportDiagram: async (format) => {
      const { projectId, diagram } = get();
      if (!projectId || !diagram) return;
      set({ exporting: true, error: null });
      try {
        const file = await exportDiagram(projectId, diagram.id, format);
        saveFile(file.filename, file.content, file.mimeType);
        // 出力に成功すると approved が exported になる。状態の表示を合わせるため取り直す
        // (出力は承認済み=未保存の変更が無い状態でしか呼ばないので、取り直しても編集は失われない)
        set(fromServer(await getDiagram(projectId, diagram.id)));
      } catch (err) {
        set({ error: messageOf(err, "出力に失敗しました") });
      } finally {
        set({ exporting: false });
      }
    },

    // ── ここから Phase-11-6 の追記分 ──
    validate: async () => {
      const { projectId, diagram } = get();
      if (!projectId || !diagram) return;
      // 検証も DB に保存済みの意味モデルに対して行う。未保存の変更があれば先に保存する。
      if (get().dirty && !(await get().save())) return;
      set({ validating: true });
      try {
        set({ validation: await validateDiagram(projectId, diagram.id) });
      } catch (err) {
        set({ error: messageOf(err, "検証に失敗しました") });
      } finally {
        set({ validating: false });
      }
    },
  };
});
