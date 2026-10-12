# Phase-45-5: プレビューの指摘(devex-ui)

## この章の目的

45-3 で文書の応答に付けた内部設計書・実装計画書の行数と検証の指摘を、ドキュメントプレビュー(SCR-005)の md の上に出す。書き落とし(処理の無い API・処理の無い機能のタスク・担うタスクの無い Must の機能要件など)が、段階8を開く前に見えるようになる(着手時の相談 4)。

自動実装モード: on([introduction](./Phase-45-introduction.md) 参照)。

## この章で作成・更新したファイル

`textbook/samples/frontend/src/features/documents/` 配下(表は依存順。#30)。

| ファイル | 新規/更新 | 責務 |
| --- | --- | --- |
| [`api/documentsApi.ts`](../samples/frontend/src/features/documents/api/documentsApi.ts) | 更新 | `InternalDesignSummaryRead`・`ImplementationPlanSummaryRead`、`GeneratedDocumentRead.internal_design?`・`implementation_plan?` |
| [`components/DocumentIssueList.tsx`](../samples/frontend/src/features/documents/components/DocumentIssueList.tsx) | 更新 | コメントだけ(4文書で共通の部品になった) |
| [`components/SimpleDesignSummaryPanel.tsx`](../samples/frontend/src/features/documents/components/SimpleDesignSummaryPanel.tsx) | 新規 | 内部設計書・実装計画書の件数と指摘、以前の版の案内 |
| [`components/DocumentMarkdownView.tsx`](../samples/frontend/src/features/documents/components/DocumentMarkdownView.tsx) | 更新 | 外部設計書のパネルの下に `SimpleDesignSummaryPanel` を置く |
| ── ここからテスト ── | | |
| [`components/__tests__/SimpleDesignSummaryPanel.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/SimpleDesignSummaryPanel.test.tsx) | 新規 | 2文書の件数・指摘・指摘の無いとき・以前の版・ほかの文書 |
| [`components/__tests__/DocumentMarkdownView.test.tsx`](../samples/frontend/src/features/documents/components/__tests__/DocumentMarkdownView.test.tsx) | 更新 | 以前の版の内部設計書に案内が出る |

依存の向き: パネル → `documentsApi`(型)・`DocumentIssueList`。ビュー → パネル。

## 要点の抜粋

```tsx
// src/features/documents/components/SimpleDesignSummaryPanel.tsx
export function SimpleDesignSummaryPanel({ document }: { document: GeneratedDocumentRead }) {
  if (document.doc_type !== "internal_design" && document.doc_type !== "implementation_plan") return null;
  const summary = summaryOf(document);   // 文書の種類ごとの件数の行と、指摘が無いときの文
  if (!summary) return <Paragraph>この版には書き落としの検証がありません(以前の形式)。…</Paragraph>;
  return (/* 件数の行 + DocumentIssueList(label: "内部設計書の指摘" など) */);
}
```

- 件数: 内部設計書は「テーブル n / API n / モジュール n / 処理 n」、実装計画書は「マイルストーン n / タスク n / リスク n」。
- 指摘の並べ方は外部設計書と同じ `DocumentIssueList`(重要度の見出し付き、中程度以上は赤)。

## 設計判断

- **パネルを2つでなく1つにした(計画から変えた点)**: 計画では `InternalDesignSummaryPanel`・`ImplementationPlanSummaryPanel` の2つを挙げたが、形(件数の行 + 指摘 + 以前の版の案内)が同じで、違うのは件数の文と指摘が無いときの文だけだったので、1つの部品の中で文書の種類ごとに引く形にした。要件定義書(採用の操作がある)・外部設計書(Phase 37 から)のパネルは触っていない。

## テスト観点

| テスト対象(SUT) | ドライバ | スタブ | 備考 |
| --- | --- | --- | --- |
| `SimpleDesignSummaryPanel` | vitest(`SimpleDesignSummaryPanel.test.tsx`) | スタブ不要 ── 文書の応答(props)だけを読んで描き、API もストアも呼ばないため | 内部設計書の件数と指摘の一覧、実装計画書の件数と「指摘はありません」、model の無い版の案内、ほかの文書には何も出さない |
| `DocumentMarkdownView`(パネルを置いたこと) | vitest(`DocumentMarkdownView.test.tsx`) | `global.fetch` のスタブ(`stubFetch`。要求が無いことを確かめる) | 以前の版の内部設計書に案内が出る |

```sh
cd devex-ui && npx vitest run src/features/documents
```
