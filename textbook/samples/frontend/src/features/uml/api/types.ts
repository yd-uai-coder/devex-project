// 作成：Phase-11-2｜更新：Phase-12-2,12-5
// 写経レベル: 定型 ── バックエンドの Pydantic スキーマを snake_case のまま写した型定義。
// devex-api の UML API(app/api/routes/uml.py)が返す・受け取る JSON の型。
// バックエンドの Pydantic スキーマに合わせて snake_case のまま手書きする(既存 feature と同じ方針)。
// 各型のコメントに、対応するバックエンドの定義を記す。

// app/uml/domain/__init__.py の NotationType
export type NotationType = "component" | "er" | "dfd";

// ---- 意味モデル(app/uml/domain/) ----
// 要素・関係の id は図の中だけで一意な文字列(DB の UUID ではない)。

// app/uml/domain/component.py
export type ComponentElement = {
  id: string;
  name: string;
  kind: "module";
  description: string | null;
  layer: string | null;
};
export type ComponentRelation = {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: "depends_on";
};
export type ComponentSemanticModel = {
  notation: "component";
  elements: ComponentElement[];
  relations: ComponentRelation[];
};

// app/uml/domain/er.py
export type ErColumn = {
  name: string;
  type: string;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  nullable: boolean;
};
export type ErElement = { id: string; name: string; kind: "table"; columns: ErColumn[] };
export type ErRelationType = "one_to_one" | "one_to_many" | "many_to_many";
export type ErRelation = {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: ErRelationType;
};
export type ErSemanticModel = { notation: "er"; elements: ErElement[]; relations: ErRelation[] };

// app/uml/domain/dfd.py(要素は element_type で判別する)
export type DfdProcess = {
  id: string;
  name: string;
  element_type: "process";
  description: string | null;
  layer: string | null;
};
export type DfdExternalEntity = { id: string; name: string; element_type: "external_entity" };
export type DfdDataStore = { id: string; name: string; element_type: "data_store" };
export type DfdElement = DfdProcess | DfdExternalEntity | DfdDataStore;
export type DfdElementType = DfdElement["element_type"];
// フローはラベルを持たず、データ辞書(DataItem)の id を参照する。
export type DfdFlow = { id: string; source_id: string; target_id: string; data_item_id: string };
export type DfdSemanticModel = { notation: "dfd"; elements: DfdElement[]; relations: DfdFlow[] };

// notation で判別する union(バックエンドの SemanticModel と同じ判別キー)
export type SemanticModel = ComponentSemanticModel | ErSemanticModel | DfdSemanticModel;
export type UmlElement = SemanticModel["elements"][number];
export type UmlRelation = SemanticModel["relations"][number];

// ---- 配置(app/uml/layout/model.py の出力スキーマ) ----
// x, y はノードの左上。points は端点を含む直交折れ線。空リストは「折れ点なし」(D2)。
export type LayoutBox = { x: number; y: number; w: number; h: number; lane: number; row: number };
// Phase-12-2：更新(BE の LayoutEdgeGeometry に label_pos が増えた)
// export type LayoutEdgeGeometry = { points: [number, number][] };
// ↓↓
// label_pos: 辺ラベルの中心(出力の draw.io/SVG が使う。レビュー画面は React Flow が自前で置く)。
// ラベルの無い辺・手で動かしたノードにつながる辺(points=[])では null か省略。
export type LayoutEdgeGeometry = {
  points: [number, number][];
  label_pos?: [number, number] | null;
};
// ── ここから Phase-11-2 の作成分 ──
export type LayoutModel = {
  width: number;
  height: number;
  nodes: Record<string, LayoutBox>;
  edges: Record<string, LayoutEdgeGeometry>;
  metrics: { crossings: number; overlaps: number; collisions: number };
};

// ---- 図(app/schemas/uml_diagram.py) ----
export type DiagramStatus = "draft" | "reviewing" | "approved" | "exported";
export type GenerationStatus = "generating" | "completed" | "failed";

// UmlDiagramRead
export type UmlDiagramRead = {
  id: string;
  view: string;
  notation: NotationType;
  // component・ER 全体図は ""、ER 部分図はグループ名、DFD は処理名
  subject: string;
  scope: { tables: string[] } | null;
  semantic_model: SemanticModel;
  // POST .../layout の実行前と、AI で再生成した直後は null
  layout_model: LayoutModel | null;
  status: DiagramStatus;
  version: number;
  generation_status: GenerationStatus;
  generation_error: string | null;
  source_doc_versions: { internal_design: number } | null;
  created_at: string;
  updated_at: string;
};

// UmlDiagramUpdate(version は楽観ロック用。layout_model を省略すると保存済みの配置を保つ)
export type UmlDiagramUpdate = {
  version: number;
  semantic_model: SemanticModel;
  layout_model?: LayoutModel | null;
};

// Phase-12-5:追記
// UmlDiagramApprove(version は画面で見ていた版。違えば 409 VERSION_CONFLICT)
export type UmlDiagramApprove = { version: number };

// 出力の形式(GET .../export/drawio | .../export/svg)
export type ExportFormat = "drawio" | "svg";

// ---- 生成(app/schemas/uml_generation.py) ----
export type UmlSubjectSpec = { subject?: string; tables?: string[] | null };
export type UmlGenerateRequest = { notation: NotationType; subjects?: UmlSubjectSpec[] };
export type DfdSubjectRead = { code: string; title: string };
export type UmlCandidatesRead = {
  // 内部設計書が無いときは null
  internal_design_version: number | null;
  dfd_subjects: DfdSubjectRead[];
  er_tables: string[];
};
export type GenerationOutcome = "succeeded" | "failed" | "skipped";
// app/uml/generation/failures.py
export type GenerationReasonCode =
  | "QUOTA_EXCEEDED"
  | "TOKEN_LIMIT"
  | "INVALID_OUTPUT"
  | "GENERATION_FAILED";
export type UmlGenerationResultRead = {
  subject: string;
  diagram_id: string;
  outcome: GenerationOutcome;
  reason_code: GenerationReasonCode | null;
  message: string | null;
};
export type GenerationRunStatus = "running" | "completed" | "partial" | "failed";
export type UmlGenerationRunRead = {
  id: string;
  notation: NotationType;
  status: GenerationRunStatus;
  requested: { subject: string; diagram_id: string }[];
  // 202 の応答では空。対象ごとに処理が終わるたびに追加される
  results: UmlGenerationResultRead[];
  started_at: string;
  finished_at: string | null;
};

// ---- データ辞書(app/schemas/data_item.py) ----
export type DataItemField = { name: string; type?: string | null; required?: boolean | null };
export type DataItemRead = {
  id: string;
  name: string;
  fields: DataItemField[];
  created_at: string;
  updated_at: string;
};

// ---- 検証(app/uml/validation/base.py) ----
export type ValidationIssue = { code: string; message: string; element_id: string | null };
export type ValidationResult = { errors: ValidationIssue[]; warnings: ValidationIssue[] };
