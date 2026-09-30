// 作成：Phase-11-6
// 写経レベル: コア ── 編集を React Flow ではなく意味モデルへの純粋な操作として行う設計と、削除の連鎖(参照切れを残さない)。
import type {
  ComponentElement,
  DfdElement,
  DfdElementType,
  ErColumn,
  ErElement,
  SemanticModel,
  UmlElement,
  UmlRelation,
} from "@/features/uml/api/types";

// 意味モデル(正本)への編集操作。すべて純粋関数で、引数のモデルを書き換えず新しいモデルを返す。
// React Flow を経由しない(要素・関係の追加や属性の編集は、React Flow の nodes/edges ではなく
// 意味モデルに対して行い、表示は Adapter が作り直す)。
//
// 記法ごとに要素・関係の形が違うため、union を記法で分けてから組み立てる。
// 意味の検証(参照切れ・DFD 規則など)はここでは行わず、サーバーの POST .../validate に任せる。

// 図の中で一意な id を作る。要素と関係で同じ名前空間を共有する(バックエンドの DUPLICATE_ID 検査と同じ)。
export function nextId(model: SemanticModel, prefix: string): string {
  const used = new Set<string>([
    ...model.elements.map((el) => el.id),
    ...model.relations.map((rel) => rel.id),
  ]);
  let n = 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

const DFD_PREFIX: Record<DfdElementType, string> = {
  process: "p",
  external_entity: "e",
  data_store: "s",
};

export function addElement(
  model: SemanticModel,
  dfdElementType: DfdElementType = "process",
): { model: SemanticModel; id: string } {
  if (model.notation === "component") {
    const id = nextId(model, "c");
    const element: ComponentElement = {
      id,
      name: "新しいモジュール",
      kind: "module",
      description: null,
      layer: null,
    };
    return { model: { ...model, elements: [...model.elements, element] }, id };
  }
  if (model.notation === "er") {
    const id = nextId(model, "t");
    const element: ErElement = {
      id,
      name: "new_table",
      kind: "table",
      columns: [{ name: "id", type: "uuid", is_primary_key: true, is_foreign_key: false, nullable: false }],
    };
    return { model: { ...model, elements: [...model.elements, element] }, id };
  }
  const id = nextId(model, DFD_PREFIX[dfdElementType]);
  const element: DfdElement =
    dfdElementType === "process"
      ? { id, name: "新しい処理", element_type: "process", description: null, layer: null }
      : dfdElementType === "external_entity"
        ? { id, name: "新しい外部実体", element_type: "external_entity" }
        : { id, name: "新しいデータストア", element_type: "data_store" };
  return { model: { ...model, elements: [...model.elements, element] }, id };
}

// id と種別(kind / element_type)は変えられない。名前・説明・layer などの属性だけを更新する。
export type ElementPatch = { name?: string; description?: string | null; layer?: string | null };

export function updateElement(model: SemanticModel, id: string, patch: ElementPatch): SemanticModel {
  const apply = <T extends UmlElement>(el: T): T => {
    if (el.id !== id) return el;
    const next = { ...el } as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      // 記法に無い属性(例: ER に layer)は足さない
      if (key in el) next[key] = value;
    }
    return next as T;
  };
  return mapElements(model, apply);
}

// 要素を消すと、その要素につながる関係も消す(参照切れを残さない)。
export function deleteElement(model: SemanticModel, id: string): SemanticModel {
  const keep = (rel: UmlRelation) => rel.source_id !== id && rel.target_id !== id;
  if (model.notation === "component") {
    return {
      ...model,
      elements: model.elements.filter((el) => el.id !== id),
      relations: model.relations.filter(keep),
    };
  }
  if (model.notation === "er") {
    return {
      ...model,
      elements: model.elements.filter((el) => el.id !== id),
      relations: model.relations.filter(keep),
    };
  }
  return {
    ...model,
    elements: model.elements.filter((el) => el.id !== id),
    relations: model.relations.filter(keep),
  };
}

// 関係を追加する。DFD のフローはデータ辞書の項目を参照するため dataItemId が必須
// (呼び出し側で項目が0件なら追加しない)。
export function addRelation(
  model: SemanticModel,
  sourceId: string,
  targetId: string,
  options: { dataItemId?: string } = {},
): { model: SemanticModel; id: string } {
  if (model.notation === "component") {
    const id = nextId(model, "r");
    return {
      model: {
        ...model,
        relations: [
          ...model.relations,
          { id, source_id: sourceId, target_id: targetId, relation_type: "depends_on" },
        ],
      },
      id,
    };
  }
  if (model.notation === "er") {
    const id = nextId(model, "r");
    return {
      model: {
        ...model,
        relations: [
          ...model.relations,
          { id, source_id: sourceId, target_id: targetId, relation_type: "one_to_many" },
        ],
      },
      id,
    };
  }
  if (!options.dataItemId) {
    throw new Error("DFD のフローにはデータ項目の指定が必要です");
  }
  const id = nextId(model, "f");
  return {
    model: {
      ...model,
      relations: [
        ...model.relations,
        { id, source_id: sourceId, target_id: targetId, data_item_id: options.dataItemId },
      ],
    },
    id,
  };
}

// 関係の属性(ER の多重度、DFD のデータ項目)を更新する。端点は変えない(付け替えは削除 + 追加)。
export type RelationPatch = { relation_type?: string; data_item_id?: string };

export function updateRelation(model: SemanticModel, id: string, patch: RelationPatch): SemanticModel {
  const apply = <T extends UmlRelation>(rel: T): T => {
    if (rel.id !== id) return rel;
    const next = { ...rel } as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      if (key in rel) next[key] = value;
    }
    return next as T;
  };
  if (model.notation === "component") return { ...model, relations: model.relations.map(apply) };
  if (model.notation === "er") return { ...model, relations: model.relations.map(apply) };
  return { ...model, relations: model.relations.map(apply) };
}

export function deleteRelation(model: SemanticModel, id: string): SemanticModel {
  if (model.notation === "component") {
    return { ...model, relations: model.relations.filter((rel) => rel.id !== id) };
  }
  if (model.notation === "er") {
    return { ...model, relations: model.relations.filter((rel) => rel.id !== id) };
  }
  return { ...model, relations: model.relations.filter((rel) => rel.id !== id) };
}

// ---- ER のカラム表 ----

export function addColumn(model: SemanticModel, tableId: string): SemanticModel {
  return mapTable(model, tableId, (columns) => [
    ...columns,
    {
      name: `column_${columns.length + 1}`,
      type: "text",
      is_primary_key: false,
      is_foreign_key: false,
      nullable: true,
    },
  ]);
}

export function updateColumn(
  model: SemanticModel,
  tableId: string,
  index: number,
  patch: Partial<ErColumn>,
): SemanticModel {
  return mapTable(model, tableId, (columns) =>
    columns.map((column, i) => (i === index ? { ...column, ...patch } : column)),
  );
}

export function deleteColumn(model: SemanticModel, tableId: string, index: number): SemanticModel {
  return mapTable(model, tableId, (columns) => columns.filter((_, i) => i !== index));
}

function mapTable(
  model: SemanticModel,
  tableId: string,
  update: (columns: ErColumn[]) => ErColumn[],
): SemanticModel {
  if (model.notation !== "er") return model;
  return {
    ...model,
    elements: model.elements.map((el) =>
      el.id === tableId ? { ...el, columns: update(el.columns) } : el,
    ),
  };
}

function mapElements(
  model: SemanticModel,
  apply: <T extends UmlElement>(el: T) => T,
): SemanticModel {
  if (model.notation === "component") return { ...model, elements: model.elements.map(apply) };
  if (model.notation === "er") return { ...model, elements: model.elements.map(apply) };
  return { ...model, elements: model.elements.map(apply) };
}
