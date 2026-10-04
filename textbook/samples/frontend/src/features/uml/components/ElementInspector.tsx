// 作成：Phase-11-6｜更新：Phase-18-6
// 写経レベル: コア ── 記法ごとの編集項目の出し分け(layer の有無、ER のカラム表、DFD はデータ辞書から選ぶ)。
"use client";

import type { CSSProperties } from "react";
import { Button, H3, Input, Text, XStack, YStack } from "tamagui";
import type {
  DataItemRead,
  ErElement,
  ErRelationType,
  SemanticModel,
  UmlElement,
  UmlRelation,
} from "@/features/uml/api/types";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";

const ER_RELATION_OPTIONS: { value: ErRelationType; label: string }[] = [
  { value: "one_to_one", label: "1対1" },
  { value: "one_to_many", label: "1対多" },
  { value: "many_to_many", label: "多対多" },
];

// 選択肢の少ない select は素の <select> を使う(Tamagui の Select はポータル描画で、
// キャンバス横の狭いパネルでは扱いにくく、テストでも選択操作が重いため)。
const SELECT_STYLE: CSSProperties = {
  padding: 6,
  color: "var(--color)",
  background: "var(--background)",
  border: "1px solid var(--borderColor)",
};

// 選択中の要素・関係の属性を、記法ごとの項目で編集する。
// 入力のたびに意味モデルを更新する(保存はツールバーの「保存」でまとめて行う)。
export function ElementInspector() {
  const model = useUmlEditorStore((s) => s.model);
  const selection = useUmlEditorStore((s) => s.selection);
  const dataItems = useUmlEditorStore((s) => s.dataItems);

  if (!model || !selection) {
    return (
      <YStack gap="$2" width={320}>
        <H3>属性</H3>
        <Text color="$color11">図の要素または線を選ぶと、ここで編集できます。</Text>
      </YStack>
    );
  }

  if (selection.kind === "element") {
    const element = model.elements.find((el) => el.id === selection.id);
    return element ? <ElementForm model={model} element={element} /> : null;
  }
  const relation = model.relations.find((rel) => rel.id === selection.id);
  return relation ? (
    <RelationForm model={model} relation={relation} dataItems={dataItems} />
  ) : null;
}

function ElementForm({ model, element }: { model: SemanticModel; element: UmlElement }) {
  const updateElement = useUmlEditorStore((s) => s.updateElement);
  const deleteElement = useUmlEditorStore((s) => s.deleteElement);

  return (
    <YStack gap="$2" width={320}>
      <H3>要素の属性</H3>
      <Input
        aria-label="名前"
        value={element.name}
        onChangeText={(name) => updateElement(element.id, { name })}
      />
      {/* Phase-18-6：更新 */}
      {/* {"description" in element ? ( */}
      {/* ↓↓ */}
      {/* ER のテーブルの説明は、カラム表の上の「テーブルの説明」で直す(null を入れないため。Phase 18) */}
      {"description" in element && model.notation !== "er" ? (
        <Input
          aria-label="説明"
          placeholder={model.notation === "dfd" ? "加工の内容(1行)" : "責務(1行)"}
          value={element.description ?? ""}
          onChangeText={(text) => updateElement(element.id, { description: text || null })}
        />
      ) : null}
      {"layer" in element ? (
        <Input
          aria-label="レイヤー"
          placeholder="レイヤー(例: API層)。自動レイアウトのレーンになる"
          value={element.layer ?? ""}
          onChangeText={(text) => updateElement(element.id, { layer: text || null })}
        />
      ) : null}
      {"columns" in element ? <ColumnTable table={element} /> : null}
      <XStack>
        <Button size="$2" theme="red" onPress={() => deleteElement(element.id)}>
          この要素を削除
        </Button>
      </XStack>
    </YStack>
  );
}

// ER のカラム表。PK/FK/NULL 許可は小さなチェックボックスで切り替える。
// 制約・説明とテーブルの説明は、詳細設計モードの段階3でテーブル定義の表に出す(Phase 18)。
function ColumnTable({ table }: { table: ErElement }) {
  const addColumn = useUmlEditorStore((s) => s.addColumn);
  const updateColumn = useUmlEditorStore((s) => s.updateColumn);
  const deleteColumn = useUmlEditorStore((s) => s.deleteColumn);
  // Phase-18-6:追記
  const updateTableDescription = useUmlEditorStore((s) => s.updateTableDescription);

  return (
    <YStack gap="$2">
      {/* Phase-18-6:追記 */}
      <Input
        aria-label="テーブルの説明"
        placeholder="テーブルの説明(役割・複合一意制約など)"
        value={table.description ?? ""}
        onChangeText={(text) => updateTableDescription(table.id, text)}
      />
      <Text fontWeight="700">カラム</Text>
      {table.columns.map((column, index) => (
        <YStack key={index} gap="$1" padding="$2" borderWidth={1} borderColor="$borderColor">
          <XStack gap="$2">
            <Input
              flex={1}
              aria-label={`カラム${index + 1}の名前`}
              value={column.name}
              onChangeText={(name) => updateColumn(table.id, index, { name })}
            />
            <Input
              flex={1}
              aria-label={`カラム${index + 1}の型`}
              value={column.type}
              onChangeText={(type) => updateColumn(table.id, index, { type })}
            />
          </XStack>
          {/* Phase-18-6:追記 */}
          <XStack gap="$2">
            <Input
              flex={1}
              aria-label={`カラム${index + 1}の制約`}
              placeholder="制約(UNIQUE・既定値など)"
              value={column.constraints ?? ""}
              onChangeText={(constraints) => updateColumn(table.id, index, { constraints })}
            />
            <Input
              flex={1}
              aria-label={`カラム${index + 1}の説明`}
              placeholder="説明"
              value={column.description ?? ""}
              onChangeText={(description) => updateColumn(table.id, index, { description })}
            />
          </XStack>
          <XStack gap="$3" alignItems="center">
            {(
              [
                ["is_primary_key", "PK"],
                ["is_foreign_key", "FK"],
                ["nullable", "NULL可"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={column[key]}
                  onChange={(e) => updateColumn(table.id, index, { [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
            <Button
              size="$1"
              aria-label={`カラム${index + 1}を削除`}
              onPress={() => deleteColumn(table.id, index)}
            >
              削除
            </Button>
          </XStack>
        </YStack>
      ))}
      <XStack>
        <Button size="$2" onPress={() => addColumn(table.id)}>
          カラムを追加
        </Button>
      </XStack>
    </YStack>
  );
}

function RelationForm({
  model,
  relation,
  dataItems,
}: {
  model: SemanticModel;
  relation: UmlRelation;
  dataItems: DataItemRead[];
}) {
  const updateRelation = useUmlEditorStore((s) => s.updateRelation);
  const deleteRelation = useUmlEditorStore((s) => s.deleteRelation);
  const nameOf = (id: string) => model.elements.find((el) => el.id === id)?.name ?? id;

  return (
    <YStack gap="$2" width={320}>
      <H3>線の属性</H3>
      <Text>{`${nameOf(relation.source_id)} → ${nameOf(relation.target_id)}`}</Text>
      {"data_item_id" in relation ? (
        // DFD のフローはデータ辞書の項目から選ぶ(自由記述のラベルにしない。M2b)
        <select
          aria-label="データ項目"
          style={SELECT_STYLE}
          value={relation.data_item_id}
          onChange={(e) => updateRelation(relation.id, { data_item_id: e.target.value })}
        >
          {dataItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      ) : null}
      {model.notation === "er" && "relation_type" in relation ? (
        <select
          aria-label="多重度"
          style={SELECT_STYLE}
          value={relation.relation_type}
          onChange={(e) => updateRelation(relation.id, { relation_type: e.target.value })}
        >
          {ER_RELATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
      <XStack>
        <Button size="$2" theme="red" onPress={() => deleteRelation(relation.id)}>
          この線を削除
        </Button>
      </XStack>
    </YStack>
  );
}
