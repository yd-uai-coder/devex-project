# Phase-17-5: API・型(FE)

## この章の目的

バックエンドの 17-1〜17-4 に合わせて、フロントエンドの型と API クライアントを足す。段階2の意味モデルの型と、データ辞書の作成・更新・削除の API ができる。

自動実装モード: on([introduction](./Phase-17-introduction.md) 参照)。旧ルールの納期モード(旧 #21)で書いた章。SUT/ドライバ/スタブの言語化は省略し、型は `tsc` で確かめる。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | 定型 | `ProcessSummaryRow`・`DataFlowModel`・`MAX_DFD_GROUPS` |
| [`detailed-design/api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | 定型 | コメントだけ(段階2も生成できる・上限で 409) |
| [`uml/api/types.ts`](../samples/frontend/src/features/uml/api/types.ts) | 更新 | 定型 | `DataItemWrite`(作成・更新の本文) |
| [`uml/api/umlApi.ts`](../samples/frontend/src/features/uml/api/umlApi.ts) | 更新 | 定型 | `createDataItem`・`updateDataItem`・`deleteDataItem` |
| ── ここからテスト ── | | | |
| [`detailed-design/test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | 定型 | `makeDataFlow(dfdGroups?)`(`makeFunctionList` の処理1件に対応する処理概要表) |
| [`detailed-design/api/__tests__/designStagesApi.test.ts`](../samples/frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts) | 更新 | 定型 | 段階2の内容もそのまま保存で送ること |
| [`uml/api/__tests__/umlApi.test.ts`](../samples/frontend/src/features/uml/api/__tests__/umlApi.test.ts) | 更新 | 定型 | データ辞書の3つの API の呼び方 |

## 要点の抜粋

```ts
// detailed-design/api/types.ts
export type DataFlowModel = {
  dfd_groups: string[];             // DFD を描く機能グループ(人が選ぶ。最大 MAX_DFD_GROUPS)
  summaries: ProcessSummaryRow[];   // function_id / input / process / output
};
export const MAX_DFD_GROUPS = 5;    // devex-api の MAX_DFD_GROUPS と同じ
```

```ts
// uml/api/umlApi.ts
export function createDataItem(projectId: string, payload: DataItemWrite): Promise<DataItemRead>  // POST
export function updateDataItem(projectId: string, itemId: string, payload: DataItemWrite)          // PUT(丸ごと置き換え)
export function deleteDataItem(projectId: string, itemId: string): Promise<void>                    // DELETE(204)
```

段階2の保存・承認・生成は、Phase 15・16 の `saveDesignStage`・`approveDesignStage`・`generateDesignStage` をそのまま使う(段階番号が違うだけ)。データ辞書の CRUD のバックエンドは Phase 8 からあったが、画面が無かったのでクライアントも無かった。

## メモ

- `deleteDataItem` のテストは、呼び出し先とメソッドだけを確かめる。テストの fetch のスタブは、本文なしの 204 を作れない(`Response` が本文付きの 204 を拒む)。204 の扱いは `apiFetch` 側の既存のテストの範囲である。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/api src/features/uml/api
# 22 passed
npx tsc --noEmit
```
