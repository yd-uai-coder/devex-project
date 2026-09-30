# Phase-13-5: API クライアント・型と、`saveFile` の Blob 対応

## この章の目的

13-2〜13-4 のバックエンドの API を、フロントエンドから呼べるようにする。

- 型: `DocState`・`UmlEmbedRead`・`UmlReflectRead`
- 関数: `listEmbeds`(GET `/uml/embeds`)、`reflectDiagrams`(POST `/uml/reflect`)、`downloadBundle`(GET `/uml/bundle`)
- `saveFile` を、文字列だけでなく Blob(zip のようなバイナリ)も保存できるようにする。

納期モード([introduction](./Phase-13-introduction.md)参照)。

## この章で作成・更新したファイル

| ファイル(`devex-ui/`基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`src/features/uml/api/types.ts`](../samples/frontend/src/features/uml/api/types.ts) | 更新 | 定型 | `DocState`、`UmlReflectRead`、`UmlEmbedRead` |
| [`src/lib/api/download.ts`](../samples/frontend/src/lib/api/download.ts) | 更新 | 定型 | `saveFile(filename, content: string \| Blob, mimeType)` |
| [`src/features/uml/api/umlApi.ts`](../samples/frontend/src/features/uml/api/umlApi.ts) | 更新 | 定型 | `fetchAttachment`(12-5 の `exportDiagram` から切り出し)、`listEmbeds`、`reflectDiagrams`、`downloadBundle` |
| ── ここからテスト ── | | | |
| [`src/lib/api/__tests__/download.test.ts`](../samples/frontend/src/lib/api/__tests__/download.test.ts) | 更新 | 定型 | Blob をそのまま保存させること |
| [`src/features/uml/api/__tests__/umlApi.test.ts`](../samples/frontend/src/features/uml/api/__tests__/umlApi.test.ts) | 更新 | 定型 | 3関数のパス・メソッド、zip を Blob のまま受け取ること |

## 要点の抜粋

```ts
// src/lib/api/download.ts
export function saveFile(filename: string, content: string | Blob, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  ...
}
```

```ts
// src/features/uml/api/umlApi.ts
async function fetchAttachment(path: string): Promise<Response>   // 生の fetch + 認証 + ApiError
export function listEmbeds(projectId: string): Promise<UmlEmbedRead[]>
export function reflectDiagrams(projectId: string): Promise<UmlReflectRead>   // POST、本文なし
export async function downloadBundle(projectId: string): Promise<DownloadedBundle> {
  const res = await fetchAttachment(umlPath(projectId, "/bundle"));
  const content = await res.blob();          // zip はバイナリなので text() ではなく blob()
  ...
}
```

## 設計判断(要点のみ)

- **zip は `blob()` で受け取る**。`text()` で受けると、バイナリが UTF-8 として解釈されて壊れる。
- **`fetchAttachment` を切り出した**(#12 で 12-5 へ遡及)。「ファイルを返すエンドポイントを、認証付きの生の fetch で呼び、失敗は `ApiError` にする」処理が、`exportDiagram` と `downloadBundle` の2か所になったためである(#17)。

## テスト観点(#14)

納期モードのため、SUT・ドライバ・スタブの言語化は省略する(#21)。JSON の API は既存の `stubFetch`、zip は `fetch` を `Response(Uint8Array)` を返すモックに差し替えて確かめる。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/features/uml/api src/lib/api
# 26 passed
npx tsc --noEmit
```
