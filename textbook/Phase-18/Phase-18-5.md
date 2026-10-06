# Phase-18-5: API・型(FE)

## この章の目的

バックエンドの 18-1〜18-4 に合わせて、フロントエンドの型を足す。段階3の意味モデル(CRUD 図)の型、段階の一覧が返す `dfd_accesses`、ER の列とテーブルの制約・説明の型ができる。

自動実装モード: on([introduction](./Phase-18-introduction.md) 参照)。旧ルールの納期モード(旧 #21)で書いた章。SUT/ドライバ/スタブの言語化は省略し、型は `tsc` で確かめる。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/features/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`detailed-design/api/types.ts`](../samples/frontend/src/features/detailed-design/api/types.ts) | 更新 | 定型 | `DfdAccess`、`DesignStageRead.dfd_accesses`、`CrudCell`・`CrudModel`・`ER_SUBJECT` |
| [`detailed-design/api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | 定型 | コメントだけ(段階3も生成できる) |
| [`uml/api/types.ts`](../samples/frontend/src/features/uml/api/types.ts) | 更新 | 定型 | `ErColumn` に任意の `constraints`・`description`、`ErElement` に任意の `description` |
| ── ここからテスト ── | | | |
| [`detailed-design/test-utils/stageFixtures.ts`](../samples/frontend/src/features/detailed-design/test-utils/stageFixtures.ts) | 更新 | 定型 | `makeStages` の雛形に `dfd_accesses: []`、`makeCrud(ops?, draft?)` |
| [`detailed-design/api/__tests__/designStagesApi.test.ts`](../samples/frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts) | 更新 | 定型 | 段階3の CRUD 図の保存と、`dfd_accesses` の受け取り |
| [`uml/api/__tests__/umlApi.test.ts`](../samples/frontend/src/features/uml/api/__tests__/umlApi.test.ts) | 更新 | 定型 | ER の制約・説明も、図の保存でそのまま送ること |

## 要点の抜粋

```ts
// detailed-design/api/types.ts
export type DfdAccess = { function_id: string; table: string; kind: "read" | "write" };
export type DesignStageRead = { /* … */ issues: StageIssue[]; dfd_accesses: DfdAccess[] };

export type CrudCell = { function_id: string; table: string; ops: string; draft: boolean };
export type CrudModel = { cells: CrudCell[] };
export const ER_SUBJECT = "";       // devex-api の ER_SUBJECT と同じ
```

```ts
// uml/api/types.ts
export type ErColumn = { /* name, type, is_primary_key, is_foreign_key, nullable */
  constraints?: string;             // 古い ER には無いので任意
  description?: string;
};
export type ErElement = { id: string; name: string; kind: "table"; columns: ErColumn[]; description?: string };
```

ER の制約・説明を任意(`?`)にしたのは、バックエンドが DB の JSONB をそのまま返すため。ステージ3や Phase 17 以前に作った ER の行には、これらのキーが無い。段階3の保存・承認・生成は、Phase 15・16 の API をそのまま使う(段階番号が違うだけ)。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/detailed-design/api src/features/uml/api
# 24 passed
npx tsc --noEmit
```
