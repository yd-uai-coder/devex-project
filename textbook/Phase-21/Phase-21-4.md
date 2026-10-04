# Phase-21-4: 型・生成の本文・ストア(段階6と段階またぎ)(FE)

## この章の目的

バックエンドの 21-1〜21-3 に合わせて、フロントエンドの型と API の口を足す。段階6の意味モデル(関数の詳細)の型と、生成に対象の関数(`logics`)を渡す口ができる。あわせて、21-8 の「05↔06 のバッジから相手の段階へ移る」ための状態(移動先 `focus`)をストアに足す。

納期モード([introduction](./Phase-21-introduction.md) 参照)。SUT/ドライバ/スタブの言語化は省略し、型は `tsc` で確かめる。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/detailed-design/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | 定型 | `PseudoStep`・`LogicRow`・`LogicModel`・`LogicTarget`・`MAX_LOGIC_TARGETS` |
| [`api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | 定型 | `generateDesignStage(projectId, stage, functionIds?, logics?)`。指定があるものだけを本文に入れる |
| [`detailed-design-store.ts`](../samples/frontend/src/features/detailed-design/detailed-design-store.ts) | 更新 | **コア** | `generate(..., logics?)`、`focus`・`jumpTo(stage, target)`・`clearFocus()`。`selectStage` は `focus` を消す |
| ── ここからテスト ── | | | |
| [`test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | 定型 | `makeLogic(patch?)`・`makeLogics()`(`makeProcedures` の手順 F-01#1 が呼ぶ関数1つ) |
| [`api/__tests__/designStagesApi.test.ts`](../samples/frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts) | 更新 | 定型 | 段階6は本文に `logics` |
| [`__tests__/detailed-design-store.test.ts`](../samples/frontend/src/features/detailed-design/__tests__/detailed-design-store.test.ts) | 更新 | 定型 | 対象の関数を渡すこと、`jumpTo`・`clearFocus`・`selectStage` と `focus` |

## 要点の抜粋

```ts
// api/types.ts
export type PseudoStep = { text: string; sub: string[] };
export type LogicRow = {
  module: string; function: string;           // 05 の (callee, call) と突き合わせる鍵
  signature: string; args: string; returns: string; raises: string; pre: string; post: string;
  pseudo: PseudoStep[];
};
export type LogicModel = { logics: LogicRow[] };   // 0件 = 段階6を飛ばした
export type LogicTarget = { module: string; function: string };
export const MAX_LOGIC_TARGETS = 5;
```

```ts
// detailed-design-store.ts
export type StageFocus = { stage: number; target: string };  // 段階5: 手順ID、段階6: 関数の鍵

jumpTo: (stage, target) => set({ selectedStage: stage, actionError: null, focus: { stage, target } }),
clearFocus: () => set({ focus: null }),
selectStage: (stage) => set({ selectedStage: stage, actionError: null, focus: null }),
```

- `generateDesignStage` は4つ目の引数に `logics` を足した。段階5の呼び出し(`generate(projectId, 5, [id])`)は変えずに済む。
- 移動先(`focus`)をストアに置いたのは、移動元のパネル(段階5)と移動先のパネル(段階6)が別のコンポーネントで、段階を切り替えるとパネルが作り直されるためである。移動先のパネルは開いたときに `focus` を読み、読んだら消す(21-8)。ステッパーで段階を選び直したときは、古い移動先が残らないよう `selectStage` で消す。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/api src/features/detailed-design/__tests__/detailed-design-store.test.ts
# 19 passed
npx tsc --noEmit
```
