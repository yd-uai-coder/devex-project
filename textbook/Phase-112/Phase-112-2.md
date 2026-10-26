# Phase-112-2: 反映の前 → 後(画面)

## この章の目的

[112-1](./Phase-112-1.md) の前 → 後を、CR の詳細の影響のタブに「反映で変わった所」として出す。確認事項の「CR-n の反映で文が変わりました →」は、CR の詳細へ飛ぶだけだったので、影響のタブを開いてその要素の行を目立たせる(そこへ移る)リンクにする([111-3](../Phase-111/Phase-111-3.md) の指摘 #7・#8)。

自動実装モード: on([introduction](./Phase-112-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`src/features/change-requests/api/types.ts`](../samples/frontend/src/features/change-requests/api/types.ts) | 更新 | `ReflectionChangeRead`・`AppliedReflectionRead` ほか、比較の応答の `reflections` |
| [`src/features/change-requests/changeRequestOps.ts`](../samples/frontend/src/features/change-requests/changeRequestOps.ts) | 更新 | `changeRequestHref` のタブと要素・`DETAIL_TABS`・`detailTabOf`・`reflectionGroups`・`restoreReasonLabel` |
| [`src/features/change-requests/components/ReflectionChanges.tsx`](../samples/frontend/src/features/change-requests/components/ReflectionChanges.tsx) | 新規 | 反映で変わった所(反映ごと・見出しごとの表) |
| [`src/features/change-requests/components/ImpactTab.tsx`](../samples/frontend/src/features/change-requests/components/ImpactTab.tsx) | 更新 | 比較の上に反映で変わった所。`focusKey` |
| [`src/features/change-requests/components/ChangeRequestDetailContent.tsx`](../samples/frontend/src/features/change-requests/components/ChangeRequestDetailContent.tsx) | 更新 | `initialTab`・`focusKey`(`DetailTab` は Ops へ移した) |
| [`src/app/projects/[id]/change-requests/[number]/page.tsx`](../samples/frontend/src/app/projects/[id]/change-requests/[number]/page.tsx) | 更新 | `?tab=`・`?focus=` を読む |
| [`src/features/confirmations/components/ConfirmationTable.tsx`](../samples/frontend/src/features/confirmations/components/ConfirmationTable.tsx) | 更新 | リンクを影響のタブのその要素へ |
| [`src/features/change-requests/test-utils/changeRequestFixtures.ts`](../samples/frontend/src/features/change-requests/test-utils/changeRequestFixtures.ts) | 更新 | `makeComparison` の `reflections`・`makeReflection` |
| [`src/features/change-requests/__tests__/changeRequestOps.test.ts`](../samples/frontend/src/features/change-requests/__tests__/changeRequestOps.test.ts) | 更新 | URL・タブ・見出しの分け方 |
| [`src/features/change-requests/components/__tests__/ReflectionChanges.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ReflectionChanges.test.tsx) | 新規 | 表・記録なし・目立たせる行 |
| [`src/features/change-requests/components/__tests__/ImpactTab.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ImpactTab.test.tsx) | 更新 | 置き場と目立たせる行 |
| [`src/features/change-requests/components/__tests__/ChangeRequestDetailContent.test.tsx`](../samples/frontend/src/features/change-requests/components/__tests__/ChangeRequestDetailContent.test.tsx) | 更新 | URL で開くタブ |
| [`src/app/projects/[id]/change-requests/[number]/__tests__/page.test.tsx`](../samples/frontend/src/app/projects/[id]/change-requests/[number]/__tests__/page.test.tsx) | 更新 | 検索の値の渡し方 |
| [`src/features/confirmations/components/__tests__/ConfirmationsPageContent.test.tsx`](../samples/frontend/src/features/confirmations/components/__tests__/ConfirmationsPageContent.test.tsx) | 更新 | リンクの先 |

## 1. 見た目

```
影響のタブ
  反映 [文書へ反映する]
  反映で変わった所
    反映の直前の版と反映で作った版を、要素ごとにシステムが比べた結果です(…)。
    2026/10/26 23:38:04 の反映(要件定義書 v3・外部設計書 v3)
    CR の対象(1)
      | 要素 | 種類 | 欄 | 前 | 後 |
      | FR-001 … | 変更 | 内容 | [E2E Fake] 備品を予約できる | 備品を予約でき、管理者が承認する |   ← ?focus= の行は黄色
      |          |      | 根拠の観点 | core | scope |
    予測した要素(画面・API)(2) …
    範囲の外(予測に無い所)(n) …
    合意の形に戻した(範囲の外の書き換えを戻した)(n)  | 要素 | キー | 戻した理由 |
  予測と実際の比較 …
```

- 反映ごとに新しい順。前 → 後を残す前の反映は「この反映は、前 → 後を残す前のものです(反映をやり直すと残ります)」の一文、変わらなかった反映は「合意の対象の要素は変わりませんでした」。
- 欄の多い要素は、要素と種類のセルを縦に結合(`rowSpan`)する。欄の無い変更(並びだけの違い)も1行出す。
- 「予測と実際の比較」の上に置いた(反映の後に、まず何が変わったかを見るため)。

## 2. URL でタブと要素を指す

```ts
// src/features/change-requests/changeRequestOps.ts(抜粋)
export function changeRequestHref(projectId: string, number: number,
  open: { tab?: DetailTab; focus?: string } = {}): string        // ?tab=impact&focus=req%3AFR-001
export const DETAIL_TABS = ["content", "impact", "verification", "explanation", "share", "trace"] as const;
export type DetailTab = (typeof DETAIL_TABS)[number];
export function detailTabOf(value: string | undefined): DetailTab    // 知らない値は「内容」
export function reflectionGroups(changes): { key; title; changes }[] // 対象 → 予測 → 範囲の外 → 戻した
```

- ページ(Server Component)が `searchParams` を読み、`ChangeRequestDetailContent` の `initialTab`・`focusKey` に渡す(Next.js の `searchParams` は Promise。`node_modules/next/dist/docs` で確かめた)。タブの切り替えは今までどおり部品の状態で、URL は書き換えない。
- `DetailTab` は部品から Ops へ移した(ページと Ops が型を使うため。部品が Ops を import する向きは今までどおり)。
- 目立たせるのは、その要素が出る最新の反映の行だけ(古い反映にも同じ要素が出るため)。開いたときに `scrollIntoView` で移る。
- 確認事項の表のリンクは `changeRequestHref(projectId, n, { tab: "impact", focus: item.key })`。確認事項のキー(`req:FR-001`)と前 → 後のキーは同じ形。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `changeRequestOps.test.ts` の「詳細のタブと反映の前 → 後」 | `changeRequestHref`・`detailTabOf`・`reflectionGroups`・`restoreReasonLabel` | vitest のテスト関数 | スタブ不要 ── 純粋関数で外部依存を呼ばないため |
| `ReflectionChanges.test.tsx`(新規) | `ReflectionChanges` | Testing Library(描画) | スタブ不要 ── 応答を props で渡して描くだけ(`scrollIntoView` は setup のポリフィルを spy で見る) |
| `ImpactTab.test.tsx` に1本 | `ImpactTab`(反映で変わった所は本物) | Testing Library | ストアの関数(`vi.fn`)── 読み込みを止め、比較の応答をストアに置くため |
| `ChangeRequestDetailContent.test.tsx` に1本 | `ChangeRequestDetailContent` | Testing Library | 各タブ(`vi.mock`)── 開いたタブと渡した `focusKey` だけを見るため |
| `page.test.tsx` に2本 | ページ(`searchParams` の読み方) | テスト関数(async の Server Component を呼ぶ) | `ChangeRequestDetailContent`(`vi.mock`)── 渡す値だけを見るため |
| `ConfirmationsPageContent.test.tsx` の1本を直した | `ConfirmationTable` | Testing Library | `onUpdate`(`vi.fn`) |

- 統合スモーク: 既存の影響のタブ・詳細・ページのテスト(`reflections` が空なら何も出さない)。
- 見出しの分け方(空の見出しは出さない)・記録なしと変わらなかった反映の文・反映が無ければ何も出さない・目立たせるのは最新の反映の1行。
