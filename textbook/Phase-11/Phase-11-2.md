# Phase-11-2: UML API クライアントと型、`ApiError.code`

## この章の目的

FE から UML API(Phase 8〜11-1)を呼ぶための型と関数を用意する。あわせて、`ApiError` にバックエンドの共通エラー形式の `code` を載せる。409 には「他で更新された(`VERSION_CONFLICT`)」と「生成中(`UML_GENERATION_IN_PROGRESS`)」の2つの意味があり、画面で扱いを変える必要があるためである。

自動実装モード: on([introduction](./Phase-11-introduction.md) 参照)。旧ルールの納期モード(旧 #21)で書いた章。#14 の SUT/ドライバ/スタブの言語化は省略し、テストの一覧だけを載せる。

## この章で作成・更新したファイル

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`src/lib/api/client.ts`](../samples/frontend/src/lib/api/client.ts) | 更新 | 定型 | `ApiError` に `code?: string` を足す。`extractErrorMessage` を `toApiError` に置き換える |
| [`src/features/uml/api/types.ts`](../samples/frontend/src/features/uml/api/types.ts) | 新規 | 定型 | 意味モデル3記法の union、`LayoutModel`、`UmlDiagramRead`、生成・候補・履歴、データ辞書、検証結果の型 |
| [`src/features/uml/api/umlApi.ts`](../samples/frontend/src/features/uml/api/umlApi.ts) | 新規 | 定型 | `listDiagrams`・`getDiagram`・`updateDiagram`・`generateDiagrams`・`getCandidates`・`listGenerationRuns`・`validateDiagram`・`computeLayout`・`listDataItems` |
| ── ここからテスト ── | | | |
| [`src/features/uml/test-utils/umlFixtures.ts`](../samples/frontend/src/features/uml/test-utils/umlFixtures.ts) | 新規 | 定型 | 3記法のサンプルモデル、配置、データ項目、`makeDiagram`/`makeCandidates`/`makeRun`。以降の章のテストでも使う |
| [`src/lib/api/__tests__/client.test.ts`](../samples/frontend/src/lib/api/__tests__/client.test.ts) | 新規 | 定型 | `detail` と `code` を載せること、`code` が無いときは undefined、422 の配列 |
| [`src/features/uml/api/__tests__/umlApi.test.ts`](../samples/frontend/src/features/uml/api/__tests__/umlApi.test.ts) | 新規 | 定型 | 各関数の URL・メソッド・本文 |

## 要点の抜粋

```ts
// src/lib/api/client.ts
export class ApiError extends Error {
  status: number;
  code?: string; // 例: "VERSION_CONFLICT"。同じ status の中で原因を見分ける
  constructor(status: number, message: string, code?: string) { ... }
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = await res.json();
  const code = typeof body?.code === "string" ? body.code : undefined;
  if (typeof body?.detail === "string") return new ApiError(res.status, body.detail, code);
  ...
}
```

```ts
// src/features/uml/api/types.ts(抜粋)
export type SemanticModel = ComponentSemanticModel | ErSemanticModel | DfdSemanticModel; // notation で判別
export type DfdFlow = { id: string; source_id: string; target_id: string; data_item_id: string };
export type LayoutEdgeGeometry = { points: [number, number][] }; // [] は「折れ点なし」(D2)
export type UmlDiagramUpdate = { version: number; semantic_model: SemanticModel; layout_model?: LayoutModel | null };
```

```ts
// src/features/uml/api/umlApi.ts
function umlPath(projectId: string, path: string) { return `/api/v1/projects/${projectId}/uml${path}`; }
export function computeLayout(projectId: string, diagramId: string): Promise<UmlDiagramRead> {
  return apiFetch(umlPath(projectId, `/diagrams/${diagramId}/layout`), { method: "POST" });
}
```

依存の向きは `umlApi.ts` → `types.ts`・`lib/api/client.ts` で、`types.ts` は何も import しない。`features/uml/api/` には `index.ts` を置かず、既存の feature(`documents/api/documentsApi.ts`)と同じく各ファイルを直接 import する。

## 設計判断(要点のみ)

- **型はバックエンドの Pydantic スキーマを snake_case のまま手で写す**。既存の feature と同じ方針である。各型のコメントに、対応するバックエンドの定義を書いた。
- **`code` は `ApiError` の任意項目にする**。`code` を返さないエラー(例: notation 不一致の 400)もあるため、必須にはできない。既存の呼び出し側は `message` しか見ていないので、影響は無い。`devex-ui/CLAUDE.md` の `ApiError` の説明も更新した。
- **フィクスチャをこの章で作る**(#15)。11-3 以降のテストが共有する3記法のサンプルは、ここで一度だけ定義する。

## テスト(旧ルールの納期モードのため一覧のみ)

- `client.test.ts`: `stubFetch` で 409・400・422 の応答を返し、`ApiError` の `status`・`message`・`code` を確かめる。
- `umlApi.test.ts`: `stubFetch` の `requests` で URL・メソッド・本文を確かめる。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/uml/api src/lib/api
# 3 files / 17 passed
npx tsc --noEmit
# エラーなし
```
