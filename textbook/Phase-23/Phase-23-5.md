# Phase-23-5: 段階7の型と編集操作(FE)

## この章の目的

FE に段階7の model の型(`PlanModel` ほか)と、画面で model を直す純粋関数 `planOps` を作る。型は BE の `app/detailed_design/plan.py`(23-1)と同じ形にする。

- 保存されている JSON を、編集できる形にそろえる(`toPlan`)。
- 横断事項・マイルストーン・タスク・リスクの追加・更新・削除と、マイルストーンの並べ替えを行う。
- マイルストーンの番号(`M-01`…)は、BE と同じく並び順から導く(`milestoneId`)。

自動実装モード: on([introduction](./Phase-23-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`features/detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | 定型 | `Priority`・`TaskArea`・`CrossCuttingRow`・`PlanTask`・`Milestone`・`Risk`・`PlanModel`、`PRIORITIES`・`TASK_AREAS`・`CROSSCUTTING_TOPICS` |
| [`features/detailed-design/planOps.ts`](../samples/frontend/src/features/detailed-design/planOps.ts) | 新規 | 定型 | `toPlan`・`hasPlanDraft`・`milestoneId`・`missingTopics`、行の追加・更新・削除、`moveMilestone` |
| ── ここからテスト ── | | | |
| [`features/detailed-design/test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | 定型 | `makePlan()`(BE の fixture `plan_model` と同じ内容) |
| [`features/detailed-design/__tests__/planOps.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/planOps.test.ts) | 新規 | 定型 | 読み込みのそろえ方、番号、既定の項目、行の操作、並べ替え |

## 要点の抜粋

```ts
// features/detailed-design/api/types.ts
export type PlanModel = {
  crosscutting: CrossCuttingRow[];   // { topic, policy, modules }
  milestones: Milestone[];           // { name, goal, priority, function_ids, tasks: PlanTask[] }
  environment: string;
  risks: Risk[];                     // { risk, mitigation }
};
export const PRIORITIES: Priority[] = ["Must", "Should", "Could"];
export const TASK_AREAS: TaskArea[] = ["準備", "バックエンド", "フロントエンド", "テスト", "デプロイ"];
export const CROSSCUTTING_TOPICS = ["例外と HTTP", "認証", "トランザクション", "ログ"];
```

```ts
// features/detailed-design/planOps.ts
export function toPlan(model: Record<string, unknown> | null): PlanModel   // 選択肢に無い優先度・区分は既定値
export function milestoneId(index: number): string                       // 0 → "M-01"
export function missingTopics(model: PlanModel): string[]
export function addTask(model, milestone): PlanModel                      // タスクはマイルストーンの中を直す
export function updateTask(model, milestone, index, patch): PlanModel
export function moveMilestone(model, index, delta: -1 | 1): PlanModel    // 端を越えると同じ model を返す
```

## 設計判断

### 行は位置で扱う

マイルストーンや横断事項の名前は、人が書き換える欄で、一時的に重複することもある(検証のエラーとして知らせる。23-1)。そのため、行は名前で引かず、並びの位置で扱う。段階4のモジュール一覧(`moduleListOps`)と同じ形にした。

タスクはマイルストーンの中にあるので、タスクの操作は「何番目のマイルストーンの、何番目のタスク」で指定する。中身は `updateMilestone` で、そのマイルストーンの `tasks` を置き換える。

### 読み込みで形をそろえる

保存されている model は、AI の下書きや古い版の JSON で、形が保証されない。`toPlan` は、欠けた欄を空の値で埋める。優先度と区分は、選択肢に無い値なら既定値(Must・バックエンド)にする。画面のセレクトが、必ずどれかの選択肢を指すようにするため。

## テスト観点(#14)

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `toPlan`・`updateTask` | vitest | スタブ不要。純粋(副作用なし)で、外部依存を呼ばないため | 第一テストの統合スモーク(fixture を読み、直しても元の model は変わらない) |
| `toPlan` | vitest | スタブ不要。同上 | 空・形の崩れた値、選択肢に無い優先度・区分 |
| `milestoneId`・`missingTopics` | vitest | スタブ不要。同上 | BE の `milestone_id`・`missing_topics` と同じ結果 |
| 行の操作・`moveMilestone` | vitest | スタブ不要。同上 | 入れ子のタスクの操作、端を越える移動は同じ model |

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/__tests__/planOps.test.ts
# 7 passed
```
