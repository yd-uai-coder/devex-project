# Phase-22-6: ダウンロードの口と SCR-008 のバー(FE)

## この章の目的

SCR-008(詳細設計画面)から詳細設計書の zip をダウンロードできるようにする。画面の見出しの下にボタンを置き、隣に段階1〜6のうち未承認の件数を出す(未承認の段階の章は「未承認」と書かれるため)。

自動実装モード: on([introduction](./Phase-22-introduction.md) 参照)。旧ルールの納期モード(旧 #21)で書いた章。SUT/ドライバ/スタブの言語化は省略し、型は `tsc` で確かめる。

## この章で作成・更新したファイル

| ファイル(`devex-ui/src/` 基準) | 新規/更新 | 写経レベル | 責務 |
| --- | --- | --- | --- |
| [`lib/api/download.ts`](../samples/frontend/src/lib/api/download.ts) | 更新 | 定型 | `fetchAttachment(path)` を `umlApi.ts` から移した(ファイルを返すエンドポイントを生の fetch で呼び、失敗は `ApiError`) |
| [`features/uml/api/umlApi.ts`](../samples/frontend/src/features/uml/api/umlApi.ts) | 更新 | 定型 | 中の `fetchAttachment` を削除し、`download.ts` のものを import する |
| [`features/detailed-design/api/designStagesApi.ts`](../samples/frontend/src/features/detailed-design/api/designStagesApi.ts) | 更新 | 定型 | `downloadDetailedDesign(projectId)`(zip を Blob で受け取る) |
| [`features/detailed-design/components/DesignDocumentBar.tsx`](../samples/frontend/src/features/detailed-design/components/DesignDocumentBar.tsx) | 新規 | 定型 | ダウンロードのボタン・未承認の件数・D6 の注意・失敗の理由 |
| [`features/detailed-design/components/DetailedDesignPageContent.tsx`](../samples/frontend/src/features/detailed-design/components/DetailedDesignPageContent.tsx) | 更新 | 定型 | 見出しの下に `DesignDocumentBar` を置く |
| ── ここからテスト ── | | | |
| [`lib/api/__tests__/download.test.ts`](../samples/frontend/src/lib/api/__tests__/download.test.ts) | 更新 | 定型 | `fetchAttachment` の成功と `ApiError` |
| [`features/detailed-design/api/__tests__/designStagesApi.test.ts`](../samples/frontend/src/features/detailed-design/api/__tests__/designStagesApi.test.ts) | 更新 | 定型 | `GET .../design-stages/document`、Blob とファイル名 |
| [`features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx) | 新規 | 定型 | 未承認の件数(段階7は数えない)、保存、失敗の表示 |
| [`features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx`](../samples/frontend/src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx) | 更新 | 定型 | 上部にダウンロードが出る |

## 要点の抜粋

```ts
// lib/api/download.ts(Phase 13-5 では umlApi.ts の中だけの関数だった)
export async function fetchAttachment(path: string): Promise<Response> { ... }

// features/detailed-design/api/designStagesApi.ts
export async function downloadDetailedDesign(projectId: string): Promise<DownloadedDocument> {
  const res = await fetchAttachment(`${base(projectId)}/document`);
  return { filename: parseFilename(res.headers.get("Content-Disposition")) ?? "detailed_design.zip",
           content: await res.blob() };   // zip はバイナリなので blob()
}
```

```tsx
// features/detailed-design/components/DesignDocumentBar.tsx
const DOCUMENT_STAGES = [1, 2, 3, 4, 5, 6];   // 段階7(実装計画)は Phase 23 で決める
const unapproved = stages.filter((s) => DOCUMENT_STAGES.includes(s.stage) && s.state !== "approved").length;
// ボタン「詳細設計書をダウンロード(.zip)」→ downloadDetailedDesign → saveFile(filename, blob, "application/zip")
```

- `fetchAttachment` を `download.ts` へ移したのは、BE の描画の共通化(22-5)と同じ理由(#17)。この Phase の消費者は `designStagesApi.ts`。
- 未承認の件数は、ストアがすでに持つ段階の一覧(`stages`)から数える。新しい API は要らない。
- ダウンロード後に段階の一覧は取り直さない。zip に入れた図は `exported` になるが、段階の状態は変わらないため。

## 動作確認(実施済み)

```bash
cd devex-ui
npx vitest run src/lib/api src/features/detailed-design/api \
  src/features/detailed-design/components/__tests__/DesignDocumentBar.test.tsx \
  src/features/detailed-design/components/__tests__/DetailedDesignPageContent.test.tsx \
  src/features/uml/api src/features/documents/components/__tests__/DiagramSyncBar.test.tsx
# 53 passed
npx tsc --noEmit
```
