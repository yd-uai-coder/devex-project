# Phase-36-3: プレビューの出どころの表示(FE)

## この章の目的

文書のプレビュー(SCR-005)の要件定義書のタブに、要件の出どころの件数(ユーザー / 採用 / 推測)・検証の指摘・推測の要件の一覧を出し、推測の要件を確かめたら「採用にする」で記録できるようにする。md の表にも出どころの列があるが、推測がいくつあり、どれを確かめればよいかを、表を読まずに分かるようにする。

自動実装モード: on([introduction](./Phase-36-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`src/features/documents/api/documentsApi.ts`](../samples/frontend/src/features/documents/api/documentsApi.ts) | 更新 | 要約の型(`RequirementsSummaryRead` など)・`adoptRequirement` |
| [`src/features/documents/documents-store.ts`](../samples/frontend/src/features/documents/documents-store.ts) | 更新 | `adoptRequirement`(返った要件定義書で一覧の同じ文書を置き換える)・`adoptingId`・`adoptError` |
| [`src/features/documents/components/RequirementsSummaryPanel.tsx`](../samples/frontend/src/features/documents/components/RequirementsSummaryPanel.tsx) | 新規 | 件数・指摘・推測の要件と「採用にする」。model の無い版は再生成の案内 |
| [`src/features/documents/components/DocumentMarkdownView.tsx`](../samples/frontend/src/features/documents/components/DocumentMarkdownView.tsx) | 更新 | 版の履歴の下・md の上にパネルを置く |
| ── ここからテスト ── | | |
| [`src/features/documents/api/__tests__/documentsApi.test.ts`](../samples/frontend/src/features/documents/api/__tests__/documentsApi.test.ts) | 更新 | `adoptRequirement` の URL とメソッド |
| [`src/features/documents/__tests__/documents-store.test.ts`](../samples/frontend/src/features/documents/__tests__/documents-store.test.ts) | 更新 | 置き換え・失敗の扱い |
| [`src/features/documents/components/__tests__/RequirementsSummaryPanel.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/RequirementsSummaryPanel.test.tsx) | 新規 | 表示・「採用にする」・以前の版・ほかの文書 |

FE のパスは `devex-ui/` 基準。

## 要点の抜粋

```ts
// src/features/documents/api/documentsApi.ts
export type RequirementsSummaryRead = {
  counts: Record<RequirementSource, number>;
  assumed: AssumedRequirementRead[];   // { id, kind, text }
  issues: RequirementIssueRead[];      // { level, code, message, targets }
};
export type GeneratedDocumentRead = { /* … */ requirements?: RequirementsSummaryRead | null };

export function adoptRequirement(projectId: string, reqId: string): Promise<GeneratedDocumentRead> {
  return apiFetch(`/api/v1/projects/${projectId}/documents/requirements/rows/${reqId}/adopt`,
                  { method: "POST" });
}
```

```ts
// src/features/documents/documents-store.ts
adoptRequirement: async (projectId, reqId) => {
  set({ adoptingId: reqId, adoptError: null });
  try {
    const updated = await adoptRequirement(projectId, reqId);
    if (get().projectId !== projectId) return;
    set({ documents: get().documents.map((d) => (d.doc_type === updated.doc_type ? updated : d)),
          adoptingId: null });
  } catch (err) { set({ adoptingId: null, adoptError: /* 文言 */ }); }
},
```

```tsx
// src/features/documents/components/DocumentMarkdownView.tsx
<VersionHistoryPanel projectId={projectId} docType={document.doc_type} />
<RequirementsSummaryPanel projectId={projectId} document={document} />  {/* 要件定義書だけ出る */}
```

依存の向き: `RequirementsSummaryPanel.tsx` → `documentsApi.ts` の型・`documents-store.ts`。`documents-store.ts` → `documentsApi.ts`。`DocumentMarkdownView.tsx` → `RequirementsSummaryPanel.tsx`。

## 設計判断

### 置き場は md の上

推測の要件を確かめる操作は、md を読む前に目に入る方がよい。md の表の行の中にボタンを置くと、react-markdown の表を差し替えることになり、コピー・ダウンロードの md と画面がずれる。パネルは md と別に置き、md は今までどおりそのまま描く(「採用にする」の後は、サーバーが組み立て直した md に置き換わる)。

### 一覧の同じ文書を置き換える

「採用にする」は版を増やさないので、一覧を取り直す必要は無い。応答の要件定義書で、一覧の同じ種別の文書を置き換える。押している間はほかの「採用にする」も止める(同じ版を続けて書き換えると、後の応答が前の結果を含むかがサーバーの順に依存するため)。

### 以前の版は案内だけ

model の無い要件定義書(Phase 36 より前に生成した版)には要約が無い。「要件ID・出どころがありません。再生成すると使えます」とだけ出す(決定8の「移行の処理は作らない」)。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `RequirementsSummaryPanel` | Vitest + Testing Library(`RequirementsSummaryPanel.test.tsx`) | `stubFetch`(fetch の差し替え)。ストアは本物 | 第一テスト(統合スモーク): 件数・指摘・推測の要件の表示。「採用にする」で POST、以前の版は案内だけでボタン無し、要件定義書でない文書は何も出さない |
| `useDocumentsStore.adoptRequirement` | Vitest(`documents-store.test.ts`) | `stubFetch` | 同じ種別だけ置き換え、失敗は `adoptError` に残して文書を変えない |
| `adoptRequirement`(API) | Vitest(`documentsApi.test.ts`) | `stubFetch` | URL とメソッド |

`DocumentMarkdownView.tsx` は既存の `DocumentMarkdownView.test.tsx` が読む(要件定義書の見本は要約を持たないので、以前の版の案内が出る)。

```sh
cd devex-ui && npx vitest run src/features/documents
```
