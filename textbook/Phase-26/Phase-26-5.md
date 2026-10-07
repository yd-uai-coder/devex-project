# Phase-26-5: 段階7の作業領域 ── 単位の表と依存の付け替え(FE)

## この章の目的

SCR-008 の段階7の作業領域(マイルストーンとタスクの表)を、26-1 の単位の形に合わせる。タスクの表を「ID/種別/タスク/処理/依存/モジュール/環境・設定のファイル(例)」にし、タスクもマイルストーンの中で上下に動かせるようにする。単位の ID は並び順から導くので、動かす・消す操作が依存先の ID を新しい並びへ付け替える。

自動実装モード: on([introduction](./Phase-26-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/` 基準) | 新規/更新 | 責務 |
| --- | --- | --- |
| [`src/features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | `UnitKind`・`UNIT_KINDS`・`MAX_UNIT_FUNCTIONS`、`PlanTask` の新しい形、`Milestone` から `function_ids` を削除(`TaskArea`・`TASK_AREAS` を削除) |
| [`src/features/detailed-design/labels.ts`](../samples/frontend/src/features/detailed-design/labels.ts) | 更新 | `UNIT_KIND_LABELS`(機能/基盤) |
| [`src/features/detailed-design/planOps.ts`](../samples/frontend/src/features/detailed-design/planOps.ts) | 更新 | `toPlan`(新しい形)・`taskId`・`milestoneFunctions`・`relinkDependencies`・`moveTask`、`moveMilestone`・`removeMilestone`・`removeTask` の付け替え(純粋) |
| [`src/features/detailed-design/components/PlanTables.tsx`](../samples/frontend/src/features/detailed-design/components/PlanTables.tsx) | 更新 | `TaskTable` の列と上下のボタン、`MilestoneList` の処理を導出の表示に |
| ── ここからテスト ── | | |
| [`src/features/detailed-design/test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | `makePlan()` を基盤 M-01-T01 と機能 M-01-T02(M-01-T01 に依存)に |
| [`src/features/detailed-design/__tests__/planOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/planOps.test.ts) | 更新 | 付け替え(動かす・消す)と、新しい欄の読み込み |
| [`src/features/detailed-design/components/__tests__/PlanTables.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/PlanTables.test.tsx) | 更新 | 単位の表の表示と、種別の選び直し・単位の移動 |

`PlanPanel.tsx`(段階7のパネル)は、表を `PlanTables` に任せているので変えていない。

## 要点の抜粋

```ts
// src/features/detailed-design/planOps.ts
export function taskId(milestone: number, task: number): string;     // (0, 1) → "M-01-T02"
export function milestoneFunctions(milestone: Milestone): string[];   // タスクの処理を重複なく

// 並べ替え・削除の後の model(after)の依存先を、新しい並びの ID へ付け替える。
// 動かした単位は同じオブジェクトのまま並びが変わるので、before のオブジェクトから元の ID を引く。
export function relinkDependencies(before: PlanModel, after: PlanModel): PlanModel {
  const oldIds = new Map<PlanTask, string>();   // before のタスク → 元の ID
  const renamed = new Map<string, string>();    // 元の ID → after での ID
  // 消した単位への依存は外す。一覧に元から無い依存先は、そのまま残す(検証が指摘する)
}

export function moveTask(model, milestone, index, delta): PlanModel   // マイルストーンの中で上下
// moveMilestone・removeMilestone・removeTask も relinkDependencies を通す
```

```tsx
// src/features/detailed-design/components/PlanTables.tsx(TaskTable の列)
// ID | 種別(select: 機能/基盤) | タスク | 処理 | 依存 | モジュール | 環境・設定のファイル(例) | ↑ ↓ 削除
// 入力欄の aria-label は単位の ID で「M-01-T02 の依存」のように付ける
```

## 設計判断

### 付け替えはオブジェクトの同一性で行う

並べ替え・削除の操作は、タスクのオブジェクトを作り直さずに配列の中の位置だけを変える(`removeAt`・入れ替え)。そこで「操作の前の model でのオブジェクト → 元の ID」の表を作り、操作の後の model で同じオブジェクトがどの ID になったかを引けば、元の ID → 新しい ID の対応が分かる。操作ごとに付け替えの規則を書かずに済み、`relinkDependencies` 1つで4つの操作を賄える。

| 場面 | 付け替えの結果 |
|---|---|
| 依存先の単位が別の位置へ動く | 新しい ID に書き換わる |
| 依存先の単位が消える | その依存を外す |
| 一覧に元から無い ID(打ち間違いなど) | そのまま残す(検証の `UNKNOWN_DEPENDENCY` で見える) |
| 動かした結果、依存先が後ろになる | ID は付け替わるが、検証の `FORWARD_DEPENDENCY` で見える(並び順を直すのは人) |

タスクをマイルストーンの間で動かす操作は作っていない(削除して別のマイルストーンに足す)。必要になったら、`relinkDependencies` を通す操作を1つ足せばよい。

### マイルストーンの処理は表示だけ

マイルストーンの「動くようにする処理」は、入力欄をやめて `milestoneFunctions` の結果を文字で出す(26-1 で保存をやめたため)。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `planOps`(`toPlan`・`taskId`・`milestoneFunctions`・`relinkDependencies`・`moveTask`・`moveMilestone`・`removeTask`・`removeMilestone`)、`UNIT_KINDS`・`MAX_UNIT_FUNCTIONS`・`UNIT_KIND_LABELS` | vitest | スタブ不要。純粋関数(副作用なし)で、外部依存を呼ばないため | 第一テストの統合スモーク(保存済みの model を読み、編集しても元が変わらない)。付け替えの4つの場面 |
| `CrossCuttingTable`・`MilestoneList`・`RiskTable` | render と userEvent | `onChange`(vi.fn)── 表は編集した model を返すだけで、保存は呼び出し元(`PlanPanel`)の責務のため | 単位の ID の付いた入力欄、種別の選び直し、単位を上へ動かすと依存先が付け替わる、端のボタンは押せない |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/__tests__/planOps.test.ts src/features/detailed-design/components/__tests__/PlanTables.test.tsx
# 18 passed
npx tsc --noEmit && npx eslint src/features/detailed-design
```
