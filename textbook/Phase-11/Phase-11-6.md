# Phase-11-6: 編集(要素・関係の追加と削除、属性、検証結果)

## この章の目的

レビュー画面で図を編集できるようにする。

- 3記法の要素を追加・削除し、名前などの属性を編集する。
- 関係(線)を追加・削除する。ER は多重度、DFD はデータ項目を選ぶ。
- ER のカラム表を編集する。
- 検証(`POST /validate`)の結果を一覧にし、該当の要素へ移れるようにする。

編集は React Flow を経由せず、意味モデルへの純粋な操作(`editOps`)として行う。

自動実装モード: on([introduction](./Phase-11-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`src/features/uml/model/editOps.ts`](../samples/frontend/src/features/uml/model/editOps.ts) | 新規 | **コア** | `nextId`・`addElement`・`updateElement`・`deleteElement`・`addRelation`・`updateRelation`・`deleteRelation`・`addColumn`・`updateColumn`・`deleteColumn`、型 `ElementPatch`/`RelationPatch` |
| [`src/features/uml/uml-editor-store.ts`](../samples/frontend/src/features/uml/uml-editor-store.ts) | 更新 | **コア** | `selection`・`validation` と編集アクション・`validate` を追加する。共通処理 `commit` と `withoutGeometry` |
| [`src/features/uml/components/ElementInspector.tsx`](../samples/frontend/src/features/uml/components/ElementInspector.tsx) | 新規 | **コア** | 選択中の要素・線の属性を記法ごとに編集する |
| [`src/features/uml/components/ValidationPanel.tsx`](../samples/frontend/src/features/uml/components/ValidationPanel.tsx) | 新規 | 定型 | エラー・警告の一覧。押すと該当の要素・線を選ぶ |
| [`src/features/uml/components/UmlCanvas.tsx`](../samples/frontend/src/features/uml/components/UmlCanvas.tsx) | 更新 | **コア** | 選択の同期、ドラッグでの線の追加(`onConnect`)、Delete キーでの削除 |
| `src/features/uml/components/UmlDiagramPageContent.tsx` | 更新 | 定型 | 検証ボタン、記法ごとの要素追加ボタン、属性パネル・検証パネルの配置 |
| ── ここからテスト ── | | | |
| [`src/features/uml/model/__tests__/editOps.test.ts`](../samples/frontend/src/features/uml/model/__tests__/editOps.test.ts) | 新規 | **コア** | 下記テスト観点参照 |
| [`src/features/uml/__tests__/uml-editor-store.test.ts`](../samples/frontend/src/features/uml/__tests__/uml-editor-store.test.ts) | 更新 | **コア** | 「編集アクション」の describe を追加する |
| [`src/features/uml/components/__tests__/ElementInspector.test.tsx`](../samples/frontend/src/features/uml/components/__tests__/ElementInspector.test.tsx) | 新規 | 定型 | 同上 |
| [`src/features/uml/components/__tests__/ValidationPanel.test.tsx`](../samples/frontend/src/features/uml/components/__tests__/ValidationPanel.test.tsx) | 新規 | 定型 | 同上 |
| `src/features/uml/components/__tests__/UmlDiagramPageContent.test.tsx` | 更新 | 定型 | 検証ボタンと要素追加ボタンのケースを追加する |

## 要点の抜粋

```ts
// src/features/uml/model/editOps.ts
export function nextId(model, prefix): string   // 要素と関係で名前空間を共有(DUPLICATE_ID と同じ)
export function addElement(model, dfdElementType = "process"): { model; id }
export function deleteElement(model, id): SemanticModel   // つながる関係も消す(参照切れを残さない)
export function addRelation(model, sourceId, targetId, { dataItemId }): { model; id }
  // component: depends_on / ER: one_to_many / DFD: dataItemId が無ければ例外
```

```ts
// src/features/uml/uml-editor-store.ts(11-6 の追記)
const commit = (model, layout = get().layout) =>
  set({ model, layout: placeMissingNodes(model, layout), dirty: true, validation: null });

deleteElement: (id) => commit(deleteElement(model, id), withoutGeometry(layout, [id, ...つながる関係の id]))
addRelation: (source, target) => DFD でデータ項目が0件なら false。先頭の項目で作り、属性パネルで選び直す
validate: dirty なら先に save() → POST /validate
```

依存の向き: `editOps.ts` → `api/types.ts` のみ(React Flow もストアも知らない)。ストアが `editOps` を呼び、コンポーネントはストアのアクションだけを呼ぶ。

## 設計判断

### 編集を React Flow ではなく意味モデルに対して行う

React Flow にも `addEdge` や `applyNodeChanges`(remove)がある。しかしそれを使うと、正本が React Flow の state になり、意味モデルへの書き戻しが要る(11-3 の「非対称な変換」の裏返し)。

- 線の追加(`onConnect`)や削除(`onNodesDelete`/`onEdgesDelete`)のイベントは受け取る。ただし処理は、ストアのアクション経由で `editOps` に渡す。
- 表示は、意味モデルが変わった結果として Adapter が作り直す。

`editOps` は純粋関数なので、「削除したらつながる関係も消える」「DFD の線はデータ項目が必須」といった規則を、描画なしでテストできる。

### 削除は座標まで連鎖させる

`nextId` は、空いている最小の番号を使う(`c1`, `c2` … の隙間を埋める)。削除した要素の座標を配置に残しておくと、同じ id で追加した新しい要素が古い位置と折れ点を引き継いでしまう。そこでストアの `withoutGeometry` で、消した要素・関係の座標を配置からも除く。サーバー側の `reconcile_layout`(11-1)も同じことをするが、画面の表示は保存前から正しくある必要がある。

### DFD の線は既存のデータ項目から選ぶ(ユーザー確定事項2)

DFD のフローは、自由記述のラベルではなくデータ辞書の項目を参照する(M2b)。データ辞書の管理 UI は後の Phase に回したため、線を追加すると先頭の項目で作り、属性パネルの select で選び直してもらう。項目が0件のときは線を追加せず、理由をキャンバスの上に表示する。

### 編集すると検証結果を捨てる

検証結果は、保存済みのモデルに対するものである。編集した後も古い結果を見せ続けると、直したはずのエラーが残って見える。そこで `commit` で `validation` を null に戻す。検証は、保存してから `POST /validate` を呼び直す。

### 選択をストアで持つ

属性パネル(`ElementInspector`)と検証パネル(`ValidationPanel`)は、キャンバスと同じ「今どれを選んでいるか」を使う。

- 選択はストアの `selection` に置く。
- キャンバスは、ストアの選択を `selected` として表示に反映する。
- キャンバスで選び直したときは、`onSelectionChange` でストアへ戻す。

このとき、「ストアへ戻す → 表示を作り直す → 選択イベント」が繰り返されないよう、同じ対象なら更新しない。

### 素の `<select>` と `<input type="checkbox">` を使った箇所

属性パネルのデータ項目・多重度の選択と、カラムの PK/FK/NULL 可のチェックは、Tamagui の `Select`/`Checkbox` ではなく素の要素にした。Tamagui の `Select` はポータルに描画するため、キャンバス横の狭いパネルでは扱いにくく、テストでの選択操作も重い。色はテーマの CSS 変数で揃えている。生成パネル(11-4)は既存の `CheckboxWithLabel` を使っている。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 見ること |
|---|---|---|---|
| `editOps` | vitest | スタブ不要。モデルを受け取って新しいモデルを返す純粋関数のため | `nextId` の名前空間、記法ごとの既定値、記法に無い属性を足さない、削除の連鎖、DFD のデータ項目必須、カラムの操作、引数を書き換えない |
| `useUmlEditorStore`(編集アクション) | vitest | `stubFetch`(読み込みと validate の応答) | 追加した要素の選択と配置の補完、削除で座標と折れ点も消える、編集で検証結果を捨てる、DFD でデータ項目0件なら false、保存→検証の順序 |
| `ElementInspector` | `render` + `userEvent`/`fireEvent` | ストアの編集アクションを `vi.fn` に置き換える | 記法ごとの項目(ER に layer が無い)、カラム表、データ項目・多重度の select |
| `ValidationPanel` | `render` + `userEvent` | ストアの `select` を `vi.fn` に置き換える | 未検証なら何も出さない、問題なしの表示、要素と線の選び分け |
| `UmlDiagramPageContent`(追加分) | `render` + `userEvent` | 子のパネルを `vi.mock` | 検証ボタン、DFD は3種類の追加ボタン |

Tamagui の `Input` は、`userEvent.type` だと1文字ごとに `onChangeText` が呼ばれる。ストアを `vi.fn` にした状態では値が戻らないので、属性の入力は `fireEvent.change` で最終値を1回だけ渡して確かめた。

`UmlCanvas` の `onConnect`・Delete キーは、jsdom では React Flow の接続操作を再現できないため、自動テストの対象外にした。処理の本体(ストアの `addRelation`・`deleteElement`)は上のストアのテストで確かめている。ブラウザでの確認対象である。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/uml
# 20 files / 89 passed
npx tsc --noEmit && npm run lint
# エラーなし(既存の警告1件のみ)
npm run build
# 成功
```
