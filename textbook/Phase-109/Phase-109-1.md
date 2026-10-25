# Phase-109-1: 段階2・3・7 の機能一覧に無い処理

## この章の目的

段階1(機能一覧)を作り直して処理 ID が変わると、後の段階に「機能一覧に無い処理」を参照する行が残る。Phase 106 で、段階7 の再生成もほかの段階と同じく機能一覧に無い ID を捨てるようにしたが、人が保存した行は検証(`UNKNOWN_FUNCTION`・`UNKNOWN_DFD_GROUP`)が指摘するだけだった。段階2 の処理概要表・段階3 の CRUD 図は機能一覧の処理だけを行にするので、切れた行は画面に出ず、手で直す方法が無かった(承認もできない)。この章で、段階5 の `StrayProcedureTable` と同じ「付け替え・消す・すべて消す」の一覧を、共通の部品1つで段階2・3・7 に置く(着手時の相談 (2))。

自動実装モード: on([introduction](./Phase-109-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/detailed-design/dataFlowOps.ts`](../samples/frontend/src/features/detailed-design/dataFlowOps.ts) | 更新 | `straySummaries`・`summaryTargets`・`reassignSummary`・`removeSummaryAt`・`removeStraySummaries`・`strayDfdGroups` |
| [`src/features/detailed-design/crudOps.ts`](../samples/frontend/src/features/detailed-design/crudOps.ts) | 更新 | `strayCrudFunctions`・`crudTargets`・`reassignCrudFunction`・`removeCrudFunction`・`removeStrayCrud` |
| [`src/features/detailed-design/planOps.ts`](../samples/frontend/src/features/detailed-design/planOps.ts) | 更新 | `strayTaskFunctions`・`taskFunctionTargets`・`reassignTaskFunction`・`removeTaskFunction`・`removeStrayTaskFunctions` |
| [`src/features/detailed-design/components/StrayFunctionTable.tsx`](../samples/frontend/src/features/detailed-design/components/StrayFunctionTable.tsx) | 新規 | 段階2・3・7 で共通の一覧の表 |
| [`src/features/detailed-design/components/DataFlowPanel.tsx`](../samples/frontend/src/features/detailed-design/components/DataFlowPanel.tsx) | 更新 | 機能一覧に無いグループ・処理概要の一覧 |
| [`src/features/detailed-design/components/DataModelPanel.tsx`](../samples/frontend/src/features/detailed-design/components/DataModelPanel.tsx) | 更新 | 機能一覧に無い処理のセルの一覧 |
| [`src/features/detailed-design/components/PlanPanel.tsx`](../samples/frontend/src/features/detailed-design/components/PlanPanel.tsx) | 更新 | 段階1 の読み込みと、機能一覧に無い処理を持つタスクの一覧 |
| [`src/features/detailed-design/test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | `makeFunctionListWithSpare`(付け替え先の F-02 を足した機能一覧) |
| [`src/features/detailed-design/__tests__/dataFlowOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/dataFlowOps.test.ts) | 更新 | 段階2 の一覧と操作 |
| [`src/features/detailed-design/__tests__/crudOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/crudOps.test.ts) | 更新 | 段階3 の一覧と操作 |
| [`src/features/detailed-design/__tests__/planOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/planOps.test.ts) | 更新 | 段階7 の一覧と操作 |
| [`src/features/detailed-design/components/__tests__/StrayFunctionTable.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/StrayFunctionTable.test.tsx) | 新規 | 表の選択と押した行 |
| [`src/features/detailed-design/components/__tests__/DataFlowPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DataFlowPanel.test.tsx) | 更新 | 消す・外すと保存の内容 |
| [`src/features/detailed-design/components/__tests__/DataModelPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DataModelPanel.test.tsx) | 更新 | 消すと保存の内容 |
| [`src/features/detailed-design/components/__tests__/PlanPanel.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/PlanPanel.test.tsx) | 更新 | 段階1 を機能一覧つきに。付け替えると保存の内容 |

## 1. 見た目

```
段階2(処理概要表の下)                       DFD を描く機能グループ
機能一覧に無い処理の処理概要(1)               ☑ reservations(2件)
| 作ったときの処理 | 処理内容 | 付け替え先 |    機能一覧に無いグループ「消えたグループ」が…  [外す]
| F-09 | 旧の集計の処理 | [選ぶ ▼] | [付け替える][消す] |
[機能一覧に無い処理概要をすべて消す]

段階3(CRUD 図の下)   | F-09 | reservations、users | [選ぶ ▼] | [付け替える][消す] |
段階7(マイルストーンの下) | F-09 | M-01-T02 予約を登録する | [選ぶ ▼] | [付け替える][外す] |
```

- 一覧は切れた行があるときだけ出る(無ければ何も描かない)。行の中身(処理内容・テーブル・タスク)で、どの行かが分かるようにした。
- 変更は下書きに入り、保存して反映する(自動では消さない。人が決める)。保存すると検証のエラーが消え、承認できるようになる。
- 段階5 の `StrayProcedureTable` は変えない。共通の部品へ移すと見た目は同じのまま差分だけが増え、それを今駆動する消費者がいない(#17 の (b))。

## 2. 共通の表

```tsx
// src/features/detailed-design/components/StrayFunctionTable.tsx(抜粋)
export type StrayRow = { key: string; functionId: string; detail: string; targets: FunctionRow[] };

export function StrayFunctionTable({ title, description, detailHead, rows, removeLabel, removeAllLabel,
  disabled, onReassign, onRemove, onRemoveAll }: { … onReassign: (key: string, functionId: string) => void; … })
```

- 表は「作ったときの処理 / 中身(`detailHead`)/ 付け替え先 / 操作」。行ごとの付け替え先の選択だけを部品の状態に持ち(`StrayProcedureTable` と同じ)、モデルの変換は持たない。押した行は `key` で返す ── 行の指し方(段階2 は並びの位置、段階3 は処理 ID、段階7 はタスクの位置と処理 ID)は段階ごとに違うため。
- 付け替え先が無い行は、選択を止めて「(付け替えられる処理がありません)」と出す。ボタンの名前は `F-09(旧の集計の処理) を付け替える` の形(同じ処理 ID が複数の行に出る段階7 でも区別できるように)。

## 3. 段階ごとの純粋関数

```ts
// src/features/detailed-design/dataFlowOps.ts(抜粋)
export type StraySummary = { index: number; functionId: string; process: string };
export function straySummaries(model, functionList): StraySummary[]
export function summaryTargets(model, functionList): FunctionRow[]        // 処理概要が空の処理
export function reassignSummary(model, functionList, index, functionId): DataFlowModel
export function strayDfdGroups(model, functionList): string[]            // 外すのは既存の toggleDfdGroup

// src/features/detailed-design/crudOps.ts(抜粋)
export type StrayCrudFunction = { functionId: string; tables: string[] };
export function crudTargets(model, functionList): FunctionRow[]          // セルの無い処理
export function reassignCrudFunction(model, from, to): CrudModel         // 下書き・推定の印を外す

// src/features/detailed-design/planOps.ts(抜粋)
export type StrayTaskFunction = { milestone: number; task: number; functionId: string; taskLabel: string };
export function taskFunctionTargets(model, functionList, milestone, task): FunctionRow[]
export function removeTaskFunction(model, milestone, task, functionId): PlanModel   // タスクは残す
```

- **段階2**: 付け替えは、中身(入力・処理内容・出力)をそのまま今の処理の行にし、付け替え先の空の行があれば置き換えて、機能一覧の順に並べ直す(段階5 の `reassignProcedure` と同じ規則)。付け替え先は処理概要が空の処理だけ(書いた行を上書きしない)。DFD を描くグループの選択は機能一覧のグループだけを出すので、消えたグループは選択の下に「外す」だけを置く(グループを付け替えると、そのグループの DFD の図の主題も変える必要があり、この Phase の範囲の外)。「すべて消す」はグループを外さない(処理概要の一覧の操作のため)。
- **段階3**: 処理ごとにまとめる(1つの処理が複数のテーブルのセルを持つ)。付け替え先はセルの無い処理だけにした(セルの重なりを合わせる規則を作らないため)。付け替えたセルは人が直したので、`setCellOps` と同じく下書き・推定の印を外す。
- **段階7**: タスクと処理 ID の組ごとに1行。付け替えは同じ位置で ID を置き換え、外すとタスクは残して ID だけを除く(Phase 106-1 の再生成の `drop_unknown_functions` と同じ扱い)。「すべて外す」は書きかけの空の欄を残す(`ListInput` の編集中の値を消さないため)。

## 4. パネルへの差し込み

- `DataFlowPanel`: 処理概要表の下に一覧、グループの選択の下に消えたグループ。生成中・閉じた段階では押せない。
- `DataModelPanel`: CRUD 図の下に一覧(生成中は出さない。CRUD 図と同じ)。
- `PlanPanel`: 段階1 の機能一覧を、ほかの段階のパネルと同じくストアの段階の一覧から読むようにした。マイルストーンの一覧の下に一覧。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `dataFlowOps.test.ts`・`crudOps.test.ts`・`planOps.test.ts` の「機能一覧に無い処理」 | 各段階の純粋関数 | vitest のテスト関数 | スタブ不要 ── 純粋関数で外部依存を呼ばないため |
| `StrayFunctionTable.test.tsx`(新規) | `StrayFunctionTable` | Testing Library(選択・クリック) | `onReassign`・`onRemove`・`onRemoveAll`(`vi.fn`)── 押した行の key と選んだ処理だけを見るため |
| `DataFlowPanel.test.tsx`・`DataModelPanel.test.tsx`・`PlanPanel.test.tsx` に1本ずつ | 各パネル(一覧は本物) | Testing Library | 段階のストアの `save`・`generate` ── 保存に送る内容を見るため |

- 統合スモーク: 各パネルの既存のテスト(切れた行の無い段階では一覧が出ない)。
- 段階2: 機能一覧に無い行とグループを拾う。付け替え先は処理概要が空の処理で、付け替えると中身はそのまま機能一覧の順に並ぶ。1行ずつ・すべて消す(グループの選択は変えない)。パネルで消す・外すと、保存の内容から両方が消える。
- 段階3: 処理ごとにまとめ、付け替え先はセルの無い処理。付け替えると操作はそのままで印を外す。パネルで消すと保存の内容が元のセルだけになる。
- 段階7: タスクごとに拾い、付け替え先はそのタスクに無い処理。付け替えは同じ位置、外すとタスクは残る。すべて外しても空の欄は残す。パネルで付け替えると保存の内容の ID が変わる。
- 表: 付け替え先を選ぶまで付け替えられない。付け替え先が無い旨。行が無ければ何も出さない。
- `PlanPanel.test.tsx` の段階の一覧の雛形は、段階1 を機能一覧(F-01・F-02)つきにした。段階1 が空だと、既存の計画の F-01 が「機能一覧に無い」と出るため。
