# Phase-20-4: 型・生成の本文・ストア(FE)

## この章の目的

バックエンドの 20-1〜20-3 に合わせて、フロントエンドの型と API の口を足す。段階5の意味モデル(手順)の型と、生成に対象の処理(`function_ids`)を渡す口ができる。あわせて、生成の受け付けの 409 `DESIGN_STAGE_INVALID` は、承認の文言でなくサーバーの理由を出すようにする。

納期モード([introduction](./Phase-20-introduction.md) 参照)。SUT/ドライバ/スタブの言語化は省略し、型は `tsc` で確かめる。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | 定型 | `ProcedureStep`・`Procedure`・`ProcedureModel`・`MAX_PROCEDURE_TARGETS` |
| [`api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | 定型 | `generateDesignStage(projectId, stage, functionIds?)`。指定があるときだけ本文 `{function_ids}` を送る |
| [`detailed-design-store.ts`](../samples/frontend/src/features/detailed-design/detailed-design-store.ts) | 更新 | 定型 | `generate(projectId, stage, functionIds?)`。受け付けの `DESIGN_STAGE_INVALID` はサーバーの理由を出す |
| ── ここからテスト ── | | | |
| [`test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | 定型 | `makeStep(patch?)`・`makeBranch(action?, branch?)`・`makeProcedures()`(F-01 の手順1つと分岐1つ) |
| [`api/__tests__/designStagesApi.test.ts`](../samples/frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts) | 更新 | 定型 | 段階5は本文に `function_ids`、指定が無ければ本文なし |
| [`__tests__/detailed-design-store.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/detailed-design-store.test.ts) | 更新 | 定型 | 対象の処理を渡すこと、受け付けの 409 の理由を出すこと |

## 要点の抜粋

```ts
// api/types.ts
export type ProcedureStep = {
  caller: string; callee: string; call: string; data: string;
  action: string; result: string; db: string; branch: string;
  is_branch: boolean;                       // 分岐の行(元の手順の直後に置く)
};
export type Procedure = { function_id: string; reason: string; note: string; steps: ProcedureStep[] };
export type ProcedureModel = { procedures: Procedure[] };
export const MAX_PROCEDURE_TARGETS = 5;     // devex-api の MAX_PROCEDURE_TARGETS と同じ
```

```ts
// api/designStagesApi.ts
export function generateDesignStage(projectId: string, stage: number, functionIds?: string[]) {
  return apiFetch<DesignStageRead>(`${base(projectId)}/${stage}/generate`, {
    method: "POST",
    ...(functionIds ? { body: JSON.stringify({ function_ids: functionIds }) } : {}),
  });
}
```

```ts
// detailed-design-store.ts(generate の catch)
const invalid = err instanceof ApiError && err.code === "DESIGN_STAGE_INVALID";
set({ actionError: invalid ? err.message : messageOf(err, "下書きの生成を始められませんでした") });
```

- 本文は、指定があるときだけ送る。段階1〜4の生成は、これまでどおり本文なしのリクエストになる(バックエンドは本文を省略可にしてある。20-3)。
- `DESIGN_STAGE_INVALID` の共通の文言は「検証のエラーがあるため承認できません」で、承認のためのものである。生成の受け付けで同じコードが返る理由(対象の数・選択)は、サーバーの文言の方が正しい。段階2の「グループが上限を超えている」も、これでサーバーの理由が出るようになる。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/api src/features/detailed-design/__tests__/detailed-design-store.test.ts
# 16 passed
npx tsc --noEmit
```
