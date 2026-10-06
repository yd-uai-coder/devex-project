# Phase-19-6: モジュール一覧の編集操作と表(FE)

## この章の目的

段階4のモジュール一覧を画面で直せるようにする。行の追加・更新・削除と、「,」区切りの欄の読み書きを純粋関数にまとめ、パス / 層 / 責務 / 主な依存先 / 関わる処理の表を作る。層は構成図の層から選ばせ、構成図に無い層は印を付けて残す。この章の表は編集した内容を呼び出し元へ返すだけで、保存は 19-7 の作業領域が行う。

自動実装モード: on([introduction](./Phase-19-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`moduleListOps.ts`](../samples/frontend/src/features/detailed-design/moduleListOps.ts) | 新規 | **コア** | `toModuleList`・`hasModuleDraft`・`componentLayers`・`addModule`・`updateModule`・`removeModule`・`listToText`・`textToList`・`duplicatePaths`(純粋) |
| [`components/ModuleListTable.tsx`](../samples/frontend/src/features/detailed-design/components/ModuleListTable.tsx) | 新規 | **コア** | モジュール一覧の表(層のセレクト・全処理のチェック・「,」区切りの入力欄 `ListInput`・重複の表示・追加と削除) |
| ── ここからテスト ── | | | |
| [`__tests__/moduleListOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/moduleListOps.test.ts) | 新規 | 定型 | 形の補い、構成図の層、行の追加・更新・削除、区切りの変換、重複したパス |
| [`components/__tests__/ModuleListTable.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/ModuleListTable.test.tsx) | 新規 | 定型 | 層の選択肢、「,」を打っても消えないこと、全処理、追加・重複・削除、無効のとき |

## 要点の抜粋

```ts
// moduleListOps.ts
export function toModuleList(model: Record<string, unknown> | null): ModuleListModel   // 欠けた値は既定値
export function hasModuleDraft(model: ModuleListModel): boolean                        // 作り直しの確認を出すか
export function componentLayers(model: ComponentSemanticModel | null): string[]        // バックエンドの component_layers と同じ
export function addModule(model, layers): ModuleListModel        // 層は構成図の先頭の層
export function updateModule(model, index, patch): ModuleListModel   // 行は位置で扱う
export function removeModule(model, index): ModuleListModel
export function listToText(items: string[]): string             // "a, b"
export function textToList(text: string): string[]              // 「,」「、」改行で区切る
export function duplicatePaths(model): Set<string>              // 2回以上現れるパス
```

```tsx
// components/ModuleListTable.tsx(抜粋)
export function ModuleListTable({ layers, model, disabled, onChange }) {
  // 層: 構成図の層の選択肢。今の値が構成図に無ければ「api(構成図に無い)」として残す
  // 関わる処理: 「全処理」のチェックを入れると、処理IDの欄を隠す
}

// 「,」区切りの入力欄。入力中の文字列は手元に持ち、配列に直した値だけを返す
function ListInput({ label, items, disabled, style, onChange }) {
  const [text, setText] = useState(() => listToText(items));
  const current = sameItems(textToList(text), items) ? text : listToText(items);   // 外から変わったら作り直す
}
```

## 設計判断

### 行はパスで引かず、位置で扱う

段階1の機能一覧は処理ID(変わらない鍵)で行を引く。モジュール一覧のパスは人が書き換える欄で、編集の途中では空や重複もありうる(重複は検証のエラーとして一旦は許す)。そのため、行の更新・削除は並びの位置で行い、表の `key` も位置にした。重複したパスは表で「パスが重複しています」と示す(バックエンドの `DUPLICATE_PATH` と同じ判定)。

### 「,」区切りの欄は、入力中の文字列を手元に持つ

依存先と関わる処理は配列で持つ。入力欄の値を毎回「配列 → 文字列」で作り直すと、区切りの「,」を打った瞬間に空の項目が捨てられて「,」が消え、次の項目を書けない。`ListInput` は入力中の文字列を手元の state に持ち、親へは配列に直した値だけを返す。行の削除などで外から値が変わったとき(手元の文字列を配列に直した値と、受け取った値が違うとき)だけ、文字列を作り直す。

### 構成図に無い層は消さずに示す

層の選択肢は構成図(エディタで編集中の内容)の層から作る(19-7)。構成図で層を改名・削除すると、モジュール一覧の層が選択肢に無くなる。値を勝手に変えず、「(構成図に無い)」と添えて残す。検証の警告(`UNKNOWN_LAYER`)と同じ扱いで、人が選び直す。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `moduleListOps` の各関数 | vitest | スタブ不要 ── 純粋関数(副作用なし)で、外部依存を呼ばないため | 欠けた値の補い、層の初出順と空の除外、引数を変えないこと、区切りの変換、空のパスを重複に数えないこと |
| `ModuleListTable`(と `ListInput`) | render と入力操作(`userEvent`) | スタブ不要 ── 表示と `onChange` だけの部品で、API やストアを呼ばないため。編集の結果は、呼び出し元の代わりのラッパー(`Harness`)が持つ | 構成図に無い層の印、「,」を打っても消えず配列で返ること、全処理のチェックで欄が隠れること、追加した行に同じパスを書くと重複の表示が出て、削除で消えること |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/__tests__/moduleListOps.test.ts \
  src/features/detailed-design/components/__tests__/ModuleListTable.test.tsx
# 9 passed
```
