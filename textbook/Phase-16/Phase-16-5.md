# Phase-16-5: API・型(FE)

## この章の目的

バックエンドの 16-3・16-4 に合わせて、フロントエンドの型と API クライアントを足す。段階の読み取りに生成の状態と検証の指摘が載り、段階1の意味モデルの型と、生成の API ができる。

自動実装モード: on([introduction](./Phase-16-introduction.md) 参照)。旧ルールの納期モード(旧 #21)で書いた章。SUT/ドライバ/スタブの言語化は省略し、型は `tsc` で確かめる。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | 定型 | `StageState` に `regenerated`、`StageIssue`・`StageGenerationStatus`、`DesignStageRead` の3項目、`FunctionKind`(「画面」を含む)・`FunctionRow`・`FunctionListModel` |
| [`api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | 定型 | `generateDesignStage`(`POST /{stage}/generate`) |
| ── ここからテスト ── | | | |
| [`test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | 定型 | `makeStages` に3項目の既定値 |
| [`api/__tests__/designStagesApi.test.ts`](../samples/frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts) | 更新 | 定型 | 生成の API の呼び方 |

## 要点の抜粋

```ts
// api/types.ts
export type DesignStageRead = {
  ...
  generation_status: StageGenerationStatus | null;   // null はまだ生成していない
  generation_error: string | null;
  issues: StageIssue[];                              // error があると承認できない
};

export type FunctionListModel = {
  groups: string[];
  functions: FunctionRow[];
  next_number: number;                               // 消えた番号は再利用しない
};
```

```ts
// api/designStagesApi.ts
export function generateDesignStage(projectId: string, stage: number): Promise<DesignStageRead> {
  return apiFetch<DesignStageRead>(`${base(projectId)}/${stage}/generate`, { method: "POST" });
}
```

`DesignStageRead.model` の型は `Record<string, unknown>` のまま残した。段階ごとに形が違い、段階1の形への変換は画面側(16-6 の `toFunctionList`)で行う。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/api
# 4 passed
npx tsc --noEmit
```
