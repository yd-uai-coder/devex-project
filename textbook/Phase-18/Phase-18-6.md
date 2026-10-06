# Phase-18-6: ER の属性パネルで制約・説明を編集する(FE)

## この章の目的

SCR-007 の図のエディタの属性パネルで、ER の列の制約・説明と、テーブルの説明を直せるようにする。テーブル定義の正本は ER なので(着手時の決定2)、テーブル定義の編集の場所はここになる。

自動実装モード: on([introduction](./Phase-18-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`uml/model/editOps.ts`](../samples/frontend/src/features/uml/model/editOps.ts) | 更新 | **コア** | `updateTableDescription`(テーブルの説明を書き換える。古いテーブルにも足す) |
| [`uml/uml-editor-store.ts`](../samples/frontend/src/features/uml/uml-editor-store.ts) | 更新 | 定型 | `updateTableDescription` のアクション |
| [`uml/components/ElementInspector.tsx`](../samples/frontend/src/features/uml/components/ElementInspector.tsx) | 更新 | **コア** | カラム表の上に「テーブルの説明」、各カラムに「制約」「説明」。ER では汎用の「説明」を出さない |
| ── ここからテスト ── | | | |
| [`uml/model/__tests__/editOps.test.ts`](../samples/frontend/src/features/uml/model/__tests__/editOps.test.ts) | 更新 | **コア** | テーブルの説明の書き換え(他のテーブルは同じ参照のまま、ER 以外は変えない) |
| [`uml/components/__tests__/ElementInspector.test.tsx`](../samples/frontend/src/features/uml/components/__tests__/ElementInspector.test.tsx) | 更新 | **コア** | 3つの入力欄がそれぞれのアクションを呼び、汎用の「説明」は出ないこと |

## 要点の抜粋

```ts
// uml/model/editOps.ts
export function updateTableDescription(model: SemanticModel, tableId: string, description: string): SemanticModel {
  if (model.notation !== "er") return model;
  return { ...model, elements: model.elements.map((el) => (el.id === tableId ? { ...el, description } : el)) };
}
```

```tsx
// uml/components/ElementInspector.tsx(抜粋)
{"description" in element && model.notation !== "er" ? (<Input aria-label="説明" … />) : null}
// ColumnTable
<Input aria-label="テーブルの説明" value={table.description ?? ""}
       onChangeText={(text) => updateTableDescription(table.id, text)} />
<Input aria-label={`カラム${index + 1}の制約`} value={column.constraints ?? ""}
       onChangeText={(constraints) => updateColumn(table.id, index, { constraints })} />
<Input aria-label={`カラム${index + 1}の説明`} … />
```

## 設計判断

### テーブルの説明に専用の操作を足した

要素の汎用の書き換え `updateElement` は「記法に無い属性は足さない」(`key in el` のときだけ書く。ER に layer を足さないため)。古い ER のテーブルには `description` のキーが無いので、`updateElement` では説明を足せない。そこでテーブルの説明だけの操作を足した。列の制約・説明は、既存の `updateColumn`(列を丸ごと展開して上書き)で足せる。

### ER では汎用の「説明」を出さない

汎用の「説明」は、空にすると `description: null` を入れる(component・DFD の説明は `null` 可のため)。バックエンドの `ErElement.description` は `str`(既定 `""`)なので、`null` を送ると保存が 422 になる。ER のテーブルの説明は「テーブルの説明」の欄(空文字を入れる)で直すことにし、汎用の欄は ER では出さない。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `updateTableDescription` | vitest | スタブ不要。純粋関数で、外部依存を呼ばないため | 書き換えたテーブル以外は同じ参照のまま、ER 以外のモデルはそのまま |
| `ElementInspector`(ER のテーブル) | render と入力の操作 | エディタのストアのアクション(vi.fn)── 意味モデルの書き換えは editOps のテストで見るので、呼び方だけを見る | テーブルの説明・列の制約・列の説明の3つ、汎用の「説明」が出ないこと |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/uml/components/__tests__/ElementInspector.test.tsx src/features/uml/model
# 17 passed
```
