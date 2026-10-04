# Phase-17-8: データ辞書の表(FE)

## この章の目的

段階2の作業領域に、データ辞書の表を足す。データ辞書はプロジェクト共通の `data_items` が正本で、DFD の線が id で参照している。画面にはこれまで、データ辞書を編集する場所が無かった(SCR-007 では線のデータ項目を選ぶだけだった)。

- 名前とフィールド(「名前:型」を「,」で区切る)を行ごとに編集し、行ごとに保存・削除する。
- 保存のたびに段階の一覧を取り直し(承認済みの段階2は差し戻されるため。17-4)、開いている DFD のエディタのデータ項目も同じ一覧に差し替える。

学習モード([introduction](./Phase-17-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`dataDictionaryOps.ts`](../samples/frontend/src/features/detailed-design/dataDictionaryOps.ts) | 新規 | 定型 | `fieldsToText`・`textToFields`・`isDuplicateName`(純粋) |
| [`components/DataDictionaryTable.tsx`](../samples/frontend/src/features/detailed-design/components/DataDictionaryTable.tsx) | 新規 | **コア** | データ辞書の表(行ごとの保存・削除、段階とエディタの取り直し) |
| [`components/DataFlowPanel.tsx`](../samples/frontend/src/features/detailed-design/components/DataFlowPanel.tsx) | 更新 | **コア** | DFD のタブの下に `DataDictionaryTable` を置く |
| ── ここからテスト ── | | | |
| [`__tests__/dataDictionaryOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/dataDictionaryOps.test.ts) | 新規 | 定型 | 文字列との行き来、必須の指定の引き継ぎ、名前の重複 |
| [`components/__tests__/DataDictionaryTable.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DataDictionaryTable.test.tsx) | 新規 | **コア** | 一覧とエディタへの反映、更新・作成・削除、名前の衝突、生成中 |
| [`components/__tests__/DataFlowPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DataFlowPanel.test.tsx) | 更新 | 定型 | 表を差し替え、置かれていることを確かめる |

## 要点の抜粋

```ts
// dataDictionaryOps.ts
fieldsToText([{ name: "id", type: "UUID" }, { name: "note" }])   // → "id:UUID, note"
textToFields("id:str, item_id", previous)                         // 同じ名前の required は引き継ぐ
isDuplicateName(" 予約 ", items, selfId)                          // 前後の空白を除いて比べる
```

```tsx
// components/DataDictionaryTable.tsx
const apply = useCallback((loaded: DataItemRead[]) => {
  setItems(loaded);
  setDrafts(loaded.map(toDraft));
  useUmlEditorStore.setState({ dataItems: loaded });      // 開いている DFD の線のラベルを合わせる
}, []);

const run = async (action) => {                           // 作成・更新・削除の共通の流れ
  await action();
  await reload();                                         // 一覧を読み直す
  await fetchStages(projectId);                           // 段階2の状態(差し戻し)と検証の結果
};
```

## 設計判断

### 行ごとに保存する(段階の「保存する」とは別)

データ辞書は段階の `model` の外にあり、API も1項目ずつである(Phase 8)。段階のパネルの「保存する」に混ぜると、1回の操作で複数の API を呼ぶことになり、途中で失敗したときにどこまで保存できたか分かりにくい。行ごとに「保存」「削除」ボタンを持たせた。

そのため、データ辞書の行の未保存の編集は、段階の承認ボタンを止めない(段階の承認は、保存済みのデータ辞書で行われる)。

### 保存のたびに、段階の一覧とエディタのデータ項目を取り直す

- 承認済みの段階2は、データ項目を直すと差し戻される(17-4)。画面の段階の状態を合わせるため、`fetchStages` を呼ぶ。
- DFD のエディタ(17-7)は、開いたときに読み込んだデータ項目で線のラベルを描く。名前を変えたら、エディタのストアの `dataItems` も同じ一覧に差し替える。

### 削除は確認する

DFD の線がその項目を参照していると、削除した後で DFD の検証が「参照切れ」(`UNKNOWN_DATA_ITEM`)になる。バックエンドは参照を確かめずに消す(Phase 8 の判断)ので、画面で確認してから消す。

### 名前の重複は保存の前に止め、409 も表示する

同じ名前はバックエンドの一意制約で 409 `DATA_ITEM_NAME_CONFLICT` になる。画面でも保存の前に止め、それでも起きた(他の画面と競合した)ときは同じ文言を出す。大小文字は、バックエンドと同じく区別する。

### 生成中は表を出さない

段階2の生成は、AI の DFD が使うデータ項目を足す(17-3)。生成中に編集すると、生成の結果と競合する。表の場所には「生成中」とだけ出す(作業後のユーザーの要望。処理概要表・生成ボタンの表示とそろえた。17-6)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `dataDictionaryOps` の各関数 | Vitest | スタブ不要。純粋関数(副作用なし)で、外部依存を呼ばないため | 文字列との行き来、required の引き継ぎ、重複の判定 |
| `DataDictionaryTable` | Vitest + Testing Library(userEvent) | `umlApi` の4関数を `vi.mock`(データ辞書の API の代わり)。ストアの `fetchStages` を `vi.fn`。確認ダイアログは `window.confirm` を `vi.spyOn` | 第一テストの統合スモーク(一覧を表示し、エディタのデータ項目も差し替える)。更新で required を保ち段階を取り直す、作成、重複を保存前に止める、409 の表示、確認してからの削除、生成中 |
| `DataFlowPanel`(17-8 の追記分) | Vitest + Testing Library | `DataDictionaryTable` を `vi.mock` | 表が置かれていること |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/__tests__/dataDictionaryOps.test.ts \
  src/features/detailed-design/components/__tests__/DataDictionaryTable.test.tsx
# 9 passed
```
