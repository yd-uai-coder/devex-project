// 作成：Phase-11-2
// 写経レベル: 定型 ── テスト用のサンプルデータ。
import type {
  ComponentSemanticModel,
  DataItemRead,
  DfdSemanticModel,
  ErSemanticModel,
  LayoutModel,
  UmlCandidatesRead,
  UmlDiagramRead,
  UmlGenerationRunRead,
} from "@/features/uml/api/types";

// UML 機能のテストで共有するサンプルデータ(バックエンドの応答と同じ形)。

export const COMPONENT_MODEL: ComponentSemanticModel = {
  notation: "component",
  elements: [
    { id: "c1", name: "認証API", kind: "module", description: null, layer: "API層" },
    { id: "c2", name: "認証サービス", kind: "module", description: "トークン発行", layer: "Service層" },
  ],
  relations: [{ id: "r1", source_id: "c1", target_id: "c2", relation_type: "depends_on" }],
};

export const ER_MODEL: ErSemanticModel = {
  notation: "er",
  elements: [
    {
      id: "t1",
      name: "users",
      kind: "table",
      columns: [
        { name: "id", type: "uuid", is_primary_key: true, is_foreign_key: false, nullable: false },
      ],
    },
    {
      id: "t2",
      name: "projects",
      kind: "table",
      columns: [
        { name: "id", type: "uuid", is_primary_key: true, is_foreign_key: false, nullable: false },
        { name: "user_id", type: "uuid", is_primary_key: false, is_foreign_key: true, nullable: false },
      ],
    },
  ],
  relations: [{ id: "r1", source_id: "t1", target_id: "t2", relation_type: "one_to_many" }],
};

export const DATA_ITEM: DataItemRead = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "ログイン要求",
  fields: [{ name: "email" }, { name: "password" }],
  created_at: "2026-09-30T00:00:00Z",
  updated_at: "2026-09-30T00:00:00Z",
};

export const DFD_MODEL: DfdSemanticModel = {
  notation: "dfd",
  elements: [
    { id: "e1", name: "利用者", element_type: "external_entity" },
    { id: "p1", name: "ログイン", element_type: "process", description: "認証する", layer: null },
    { id: "s1", name: "users", element_type: "data_store" },
  ],
  relations: [
    { id: "f1", source_id: "e1", target_id: "p1", data_item_id: DATA_ITEM.id },
    { id: "f2", source_id: "s1", target_id: "p1", data_item_id: DATA_ITEM.id },
  ],
};

export const COMPONENT_LAYOUT: LayoutModel = {
  width: 400,
  height: 120,
  nodes: {
    c1: { x: 20, y: 20, w: 120, h: 48, lane: 0, row: 0 },
    c2: { x: 240, y: 20, w: 120, h: 48, lane: 1, row: 0 },
  },
  edges: {
    r1: {
      points: [
        [140, 44],
        [240, 44],
      ],
    },
  },
  metrics: { crossings: 0, overlaps: 0, collisions: 0 },
};

export function makeDiagram(overrides: Partial<UmlDiagramRead> = {}): UmlDiagramRead {
  return {
    id: "d1",
    view: "structure",
    notation: "component",
    subject: "",
    scope: null,
    semantic_model: COMPONENT_MODEL,
    layout_model: COMPONENT_LAYOUT,
    status: "draft",
    version: 1,
    generation_status: "completed",
    generation_error: null,
    source_doc_versions: { internal_design: 1 },
    created_at: "2026-09-30T00:00:00Z",
    updated_at: "2026-09-30T00:00:00Z",
    ...overrides,
  };
}

export function makeCandidates(overrides: Partial<UmlCandidatesRead> = {}): UmlCandidatesRead {
  return {
    internal_design_version: 1,
    dfd_subjects: [
      { code: "DF-1", title: "ログイン" },
      { code: "DF-2", title: "プロジェクト作成" },
    ],
    er_tables: ["users", "projects"],
    ...overrides,
  };
}

export function makeRun(overrides: Partial<UmlGenerationRunRead> = {}): UmlGenerationRunRead {
  return {
    id: "run1",
    notation: "dfd",
    status: "completed",
    requested: [{ subject: "ログイン", diagram_id: "d1" }],
    results: [
      { subject: "ログイン", diagram_id: "d1", outcome: "succeeded", reason_code: null, message: null },
    ],
    started_at: "2026-09-30T00:00:00Z",
    finished_at: "2026-09-30T00:01:00Z",
    ...overrides,
  };
}
