# Phase-44-3: 各段階の表の行の印と「表で見る」

## この章の目的

印を段階の表の行にも出し、「表で見る」と「段階Nで直す」で移った先の行を強調する([41-2](../Phase-41/Phase-41-2.md) 決定8「作業領域のパネル + 各表の印」・[`docs/external_design.md`](../../docs/external_design.md) 2.10節「段階の状態と印」)。段階1〜8 の表が同じ形で印を引けるよう、フック `useStageImpact` に集める。

自動実装モード: on([introduction](./Phase-44-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/frontend/src/features/detailed-design/` 配下(依存順。#30)。

| ファイル | 新規/更新 | 責務(印を付ける行のキー) |
| --- | --- | --- |
| [`hooks/useStageImpact.ts`](../samples/frontend/src/features/detailed-design/hooks/useStageImpact.ts) | 新規 | 段階の印の引き方(`mark(key)`)と強調する行の props(`row(key)`)。`HIGHLIGHT_ROW` |
| [`components/FunctionListPanel.tsx`](../samples/frontend/src/features/detailed-design/components/FunctionListPanel.tsx) | 更新 | 段階1 機能一覧の処理の行(`fn:`) |
| [`components/DataFlowPanel.tsx`](../samples/frontend/src/features/detailed-design/components/DataFlowPanel.tsx) | 更新 | 段階2 処理概要表の行(`summary:`) |
| [`components/TableDefinitionTable.tsx`](../samples/frontend/src/features/detailed-design/components/TableDefinitionTable.tsx) | 更新 | 段階3 テーブル定義のテーブルの見出しの行(`table:`) |
| [`components/CrudMatrix.tsx`](../samples/frontend/src/features/detailed-design/components/CrudMatrix.tsx) | 更新 | 段階3 CRUD 図のセル(`crud:`)。強調は外枠 |
| [`components/ModuleListTable.tsx`](../samples/frontend/src/features/detailed-design/components/ModuleListTable.tsx) | 更新 | 段階4 モジュール一覧の行(`module:`) |
| [`components/ProcedurePanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedurePanel.tsx) | 更新 | 段階5 手順の索引の行(`proc:`) |
| [`components/LogicPanel.tsx`](../samples/frontend/src/features/detailed-design/components/LogicPanel.tsx) | 更新 | 段階6 処理ロジックの逆引きの行(`logic:`) |
| [`components/PlanTables.tsx`](../samples/frontend/src/features/detailed-design/components/PlanTables.tsx) | 更新 | 段階7 タスクの行(`task:<単位のキー>`)・横断事項の行(`cc:`) |
| [`components/ProcedureDocPanel.tsx`](../samples/frontend/src/features/detailed-design/components/ProcedureDocPanel.tsx) | 更新 | 段階8 単位の一覧の行(`unit:<単位のキー>`) |
| ── ここからテスト ── | | |
| [`test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | `impactWith(...marks)`(渡した印だけを持つ影響) |
| [`components/__tests__/FunctionListPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/FunctionListPanel.test.tsx) ほか8件 | 更新 | 上の表の各ファイルに1件ずつ「印が出る・強調される」(`DataFlowPanel`・`TableDefinitionTable`・`CrudMatrix`・`ModuleListTable`・`ProcedurePanel`・`LogicPanel`・`PlanTables`・`ProcedureDocPanel` の各 `.test.tsx`) |

## 要点の抜粋

### 1. フック

```ts
// src/features/detailed-design/hooks/useStageImpact.ts
export function useStageImpact(stage: number): {
  mark: (key: string) => ImpactMarkRead | undefined;
  row: (key: string) => RowHighlight;   // { ref?, style?, "aria-current"? }
  highlighted: string | null;
}
```

- `row(key)` は強調する行なら、背景(段階5の手順の表の強調と同じ `var(--yellow4)`)・`aria-current="true"`・表示したときに行までスクロールする `ref` を返す。それ以外は空。`<tr {...impact.row(key)}>` と広げて使う。
- スクロールの `ref` は強調の行が変わったときだけ作り直す(`useCallback`)。同じ行の入力欄を打つたびに再描画でスクロールし直さないため。

### 2. 各表での使い方

```tsx
// src/features/detailed-design/components/ModuleListTable.tsx(抜粋)
const impact = useStageImpact(4);
...
<tr key={index} {...impact.row(elementKey.module(row.path))}>
  <td ...>
    <input ... />
    <ImpactBadge mark={impact.mark(elementKey.module(row.path))} />
```

- 印は行の ID(またはパスの欄)の横に出し、列は増やさない(編集できる表の列の並びを変えないため)。
- `TableDefinitionTable`・`CrudMatrix`・`ModuleListTable`・`PlanTables` は段階番号を受け取らない表なので、置かれる段階(3・3・4・7)を直に書く。
- CRUD 図は下書きのセルが黄色の背景なので、強調は背景でなく外枠(`outline`)にした。
- 段階8の行は、開いた単位の背景(`var(--blue2)`)より強調の背景を優先する。
- 段階5・6 は、「表で見る」で既存の `focus` も立つので、索引・逆引きの行の強調に加えて、その処理・関数のタブが開く(44-1)。段階6は、タブの編集欄へのスクロールが後に効く。

## 設計判断

### 印は表ごとの1行ずつ、フックに集める

要素の種類ごとに表の形が違う(段階3はセル、段階7は表が2つ)。印の引き方と強調の props だけを共通にし、どこに置くかは各表が決める形にした。強調の状態はストアの `highlight`(44-1)1つなので、別の段階へ移れば消える。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| 各段階の表(`useStageImpact`・`ImpactBadge` を含む) | vitest + Testing Library(描画) | ストアに `impactWith(...)` の影響と `highlight` を置く(API は呼ばない)。パネルの既存のスタブ(`save`・`generate` など)はそのまま | 印のバッジが出る、強調の行(段階3の CRUD はセル)に `aria-current="true"`。段階7は単位のキー(`U-002`)でタスクの行を引き、横断事項の確認済みも出す。段階8は単位のキーで引く。各テストの終わりで影響を消す(同じファイルの他のテストに印を残さない) |

```sh
cd devex-ui && npx vitest run src/features/detailed-design/components/__tests__/{FunctionListPanel,DataFlowPanel,TableDefinitionTable,CrudMatrix,ModuleListTable,ProcedurePanel,LogicPanel,PlanTables,ProcedureDocPanel}.test.tsx
```
