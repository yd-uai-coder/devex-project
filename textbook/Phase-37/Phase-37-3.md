# Phase-37-3: プレビューの外部設計書のパネル(FE)

## この章の目的

プレビュー(SCR-005)の外部設計書のタブに、md の上に「画面 n / API n / 外部連携 n」と検証の指摘を出す([37-2](./Phase-37-2.md) の `GeneratedDocumentRead.external_design`)。指摘の一覧は要件定義書のパネルと同じ形なので、共通の部品 `DocumentIssueList` に切り出す(#17)。

自動実装モード: on([introduction](./Phase-37-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`src/features/documents/api/documentsApi.ts`](../samples/frontend/src/features/documents/api/documentsApi.ts) | 更新 | `DocumentIssueRead`(旧 `RequirementIssueRead`)・`ExternalDesignSummaryRead`・`external_design?` |
| [`src/features/documents/components/DocumentIssueList.tsx`](../samples/frontend/src/features/documents/components/DocumentIssueList.tsx) | 新規 | 重要度の見出し付きの指摘の一覧(無ければ何も出さない) |
| [`src/features/documents/components/RequirementsSummaryPanel.tsx`](../samples/frontend/src/features/documents/components/RequirementsSummaryPanel.tsx) | 更新 | 指摘の一覧を `DocumentIssueList` に置き換え(見た目は変えない) |
| [`src/features/documents/components/ExternalDesignSummaryPanel.tsx`](../samples/frontend/src/features/documents/components/ExternalDesignSummaryPanel.tsx) | 新規 | 外部設計書の行数と指摘、以前の版の案内 |
| [`src/features/documents/components/DocumentMarkdownView.tsx`](../samples/frontend/src/features/documents/components/DocumentMarkdownView.tsx) | 更新 | 要件定義書のパネルの下に外部設計書のパネルを置く |
| ── ここからテスト ── | | |
| [`components/__tests__/DocumentIssueList.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentIssueList.test.tsx) | 新規 | 重要度の見出し・空のとき |
| [`components/__tests__/ExternalDesignSummaryPanel.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/ExternalDesignSummaryPanel.test.tsx) | 新規 | 件数と指摘・指摘なし・以前の版・ほかの文書 |

FE のパスは `devex-ui/` 基準。

## 要点の抜粋

```ts
// src/features/documents/api/documentsApi.ts
export type DocumentIssueRead = {
  level: "critical" | "major" | "minor";
  code: string;
  message: string;
  targets: string[];
};

export type ExternalDesignSummaryRead = {
  counts: { screens: number; apis: number; integrations: number };
  issues: DocumentIssueRead[];
};

export type GeneratedDocumentRead = {
  // ...
  requirements?: RequirementsSummaryRead | null;
  external_design?: ExternalDesignSummaryRead | null;
};
```

```tsx
// src/features/documents/components/ExternalDesignSummaryPanel.tsx
export function ExternalDesignSummaryPanel({ document }: { document: GeneratedDocumentRead }) {
  if (document.doc_type !== "external_design") return null;
  const summary = document.external_design;
  if (!summary) return <Paragraph>この版には要件ID との対応がありません(以前の形式)。…</Paragraph>;
  // 「画面 n / API n / 外部連携 n」と <DocumentIssueList issues={summary.issues} label="外部設計書の指摘" />
}
```

依存の向き: `DocumentIssueList.tsx` は tamagui と `documentsApi.ts` の型だけを読む。`RequirementsSummaryPanel.tsx`・`ExternalDesignSummaryPanel.tsx` が `DocumentIssueList.tsx` を読み、`DocumentMarkdownView.tsx` が2つのパネルを読む。

## 設計判断

### パネルは読むだけ

外部設計書には出どころが無く、「採用にする」のような操作も無い。指摘を直すにはチャットで答えて再生成する(要件定義書の推測と同じ)ので、パネルはストアも API も呼ばず、文書の応答だけを読む。指摘が無ければ「指摘はありません(Must の機能要件には、どれも画面か API があります)」と出し、確かめた結果であることが分かるようにした。

### 指摘の一覧を共通の部品に

要件定義書のパネルにあった「【中程度】…」の一覧(重要度のラベルと色)を `DocumentIssueList` に移し、2つのパネルで使う。型も BE の `DocumentIssueRead` に合わせて改名した。要件定義書のパネルの見た目と `aria-label`(「要件定義書の指摘」)は変えていないので、既存の `RequirementsSummaryPanel.test.tsx` がそのまま通る。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
|---|---|---|---|
| `DocumentIssueList` | Vitest + RTL(`DocumentIssueList.test.tsx`) | スタブ不要 ── props だけで描く表示の部品のため | 重要度の見出しと順、`aria-label`、空なら何も出さない |
| `ExternalDesignSummaryPanel` | Vitest + RTL(`ExternalDesignSummaryPanel.test.tsx`) | スタブ不要 ── 文書の応答(props)だけを読み、API もストアも呼ばないため | 件数と指摘、指摘なしの文、model の無い版の案内、ほかの文書には出さない |
| `RequirementsSummaryPanel`(共通化の後)・`DocumentMarkdownView`・`documentsApi.ts` の型 | 既存の `RequirementsSummaryPanel.test.tsx`・`DocumentMarkdownView.test.tsx`・`documentsApi.test.ts` | 既存のとおり(`stubFetch`) | 共通化で表示が変わらないこと。パネルを足しても md の表示・版の履歴が変わらないこと |

```sh
cd devex-ui && npx vitest run src/features/documents
```
