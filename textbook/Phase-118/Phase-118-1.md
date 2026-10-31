# Phase-118-1: GUIDE の土台(流れの定義・帯・前後・共通の型・流れ図・目次)

## この章の目的

使い方ガイド(GUIDE)のページが共通で使う土台を作る。利用の流れの並びを1か所に定義し、各ページの上の「流れの帯」、下の「前へ / 次へ」、ページの共通の型(できること → 使う場面 → 前提 → 手順 → 画面の見方 → コツ・注意)、全体の流れ図と、目次のページ `/guide` を置く。あわせてメニューの仮の Guide を差し替え、`<html lang>` を `ja` にする。

自動実装モード: on([introduction](./Phase-118-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`features/guide/guide-flow.ts`](../samples/frontend/src/features/guide/guide-flow.ts) | 新規 | ページの定義・流れの並び・分岐・前後・全体の流れ・機能カード |
| [`features/guide/components/guide.module.css`](../samples/frontend/src/features/guide/components/guide.module.css) | 新規 | 帯・流れ図・カード・本文の見た目(表示の切り替えは素の要素で) |
| [`features/guide/components/GuideFlowBand.tsx`](../samples/frontend/src/features/guide/components/GuideFlowBand.tsx) | 新規 | 流れの帯(スマホ幅は1行にたたむ) |
| [`features/guide/components/GuideFlowDiagram.tsx`](../samples/frontend/src/features/guide/components/GuideFlowDiagram.tsx) | 新規 | 全体の流れ図(TOP と目次で共有) |
| [`features/guide/components/GuidePager.tsx`](../samples/frontend/src/features/guide/components/GuidePager.tsx) | 新規 | 次に読む(前へ / 次へ・あわせて読む・目次へ) |
| [`features/guide/components/GuidePageLayout.tsx`](../samples/frontend/src/features/guide/components/GuidePageLayout.tsx) | 新規 | ページの共通の型 |
| [`features/guide/components/GuideIndexContent.tsx`](../samples/frontend/src/features/guide/components/GuideIndexContent.tsx) | 新規 | 目次(目的から探す・全体の流れ・ページの一覧) |
| [`app/guide/page.tsx`](../samples/frontend/src/app/guide/page.tsx) | 新規 | 目次のページ(metadata つき) |
| [`lib/menu-tree.ts`](../samples/frontend/src/lib/menu-tree.ts) | 更新 | Guide を目次と主要4ページへのリンクに |
| [`app/layout.tsx`](../samples/frontend/src/app/layout.tsx) | 更新 | `lang="ja"`・説明の文 |
| [`features/guide/test-utils/renderGuide.tsx`](../samples/frontend/src/features/guide/test-utils/renderGuide.tsx) | 新規 | 部品のテストの準備(Tamagui で包む) |
| [`features/guide/__tests__/guide-flow.test.ts`](../samples/frontend/src/features/guide/__tests__/guide-flow.test.ts) | 新規 | 定義の整合・位置・前後 |
| [`components/__tests__/GuideFlowBand.test.tsx`](../samples/frontend/src/features/guide/components/__tests__/GuideFlowBand.test.tsx)・[`GuideFlowDiagram.test.tsx`](../samples/frontend/src/features/guide/components/__tests__/GuideFlowDiagram.test.tsx)・[`GuidePager.test.tsx`](../samples/frontend/src/features/guide/components/__tests__/GuidePager.test.tsx)・[`GuidePageLayout.test.tsx`](../samples/frontend/src/features/guide/components/__tests__/GuidePageLayout.test.tsx)・[`GuideIndexContent.test.tsx`](../samples/frontend/src/features/guide/components/__tests__/GuideIndexContent.test.tsx) | 新規 | 部品ごと |
| [`app/guide/__tests__/page.test.tsx`](../samples/frontend/src/app/guide/__tests__/page.test.tsx) | 新規 | 目次のページと metadata |
| [`lib/__tests__/menu-tree.test.ts`](../samples/frontend/src/lib/__tests__/menu-tree.test.ts)・[`components/layout/__tests__/Menu.test.tsx`](../samples/frontend/src/components/layout/__tests__/Menu.test.tsx) | 更新 | Guide のリンク |

## 1. 流れの定義を1か所に(構成案 4節)

```ts
// src/features/guide/guide-flow.ts(抜粋)
export type GuideSlug = "getting-started" | "projects" | "hearing" | … | "for-clients" | "glossary";
export type GuidePage = { slug; title; short; summary; related: GuideSlug[] };
export const GUIDE_PAGES: Record<GuideSlug, GuidePage>;
export const GUIDE_FLOW: GuideSlug[];                 // はじめに → … → 資料(9段)
export const GUIDE_BRANCH_FROM = { "for-clients": "agreement" };
export function flowPosition(slug): { index; total } | null;
export function prevNext(slug): { prev: GuidePage | null; next: GuidePage | null };
export const PRODUCT_FLOW: ProductStep[];            // ヒアリング → … → 反映・再検証(8段)
export const GUIDE_FEATURES: GuideFeature[];         // TOP の機能カード(8枚)
```

- **2つの流れを分けた**(Claude の判断): 帯と前後は「ガイドを読む順」(`GUIDE_FLOW`。はじめに・プロジェクトを含む9段)、流れ図は「Devex の仕事の流れ」(`PRODUCT_FLOW`。構成案 1節6 の8段)。流れ図の段は使い方のページへリンクし、同じページへ複数の段が向くことがある(合意済みの版・変更要求・反映はどれも「合意と変更管理」)。
- 流れの外のページ: 「クライアントの方へ」は合意と変更管理からの分岐(帯は分岐元の段を印にし、前へは分岐元、次へは無し)。「用語集」はどこにも属さない(帯の印も前後も無し)。
- メニュー(`lib/`)は `features/` を import しない層なので、Guide の href は文字で書き、テストで定義と突き合わせる。

## 2. 帯・前後・共通の型

- **帯**(`GuideFlowBand`): `<nav aria-label="使い方の流れ">` の `<ol>`。今のページは `aria-current="page"`、分岐元は `data-branch`。スマホ幅は「段 N / 全 M: 名前」のボタンにたたみ、押すと開く(`data-open`)。表示の切り替えは CSS Module で、入れ物は素の要素(本番ビルドで Tamagui の `.is_View` に負けないように。devex-ui の CLAUDE.md)。
- **前後**(`GuidePager`): `rel="prev"`/`"next"` のリンクと、`related` の「あわせて読む」・目次へ。
- **共通の型**(`GuidePageLayout`): 構成案 4節の型 0〜7 を props で受け、空の節は出さない。手順のまとまりが3つ以上ならページ内の目次を出す(合意と変更管理のため)。画像は `next/image`(幅・高さを渡し、遅延読み込み)。共通の型に収まらない中身(用語の表)は `children` でコツの後に置く。
- Tamagui 2 では要素名の指定が `tag` でなく **`render`**(`<YStack render="section">`)。`tag` は型で通るが効かず、`<section>` にならなかった(テストの `closest("section")` で気づいた)。

## 3. 目次と全体の流れ図

- 目次(`/guide`): 読み方・目的から探す(5つの入口)・全体の流れ図・ページの一覧(流れの順 + そのほか)。
- 流れ図(`GuideFlowDiagram`): 番号つきの箱を、PC 幅は4列の格子に → で、スマホ幅は縦に ↓ で並べる。行の終わりの段には矢印を出さない(次の行の頭へつながり、番号で順が分かる)。
- ページは `share/[token]/page.tsx` と同じ形: Server の `page.tsx` が `metadata` を持ち、本文は `features/` の Client Component。

## テスト観点

用語: SUT = テストする対象、ドライバ = SUT を呼ぶもの、スタブ = SUT が呼ぶ相手の代わり。

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `guide-flow.test.ts` | 定義データと `flowPosition`・`prevNext`・`guideHref` | vitest のテスト関数 | スタブ不要 ── 純粋で外部依存を呼ばないため |
| 部品の5本 | `GuideFlowBand`・`GuideFlowDiagram`・`GuidePager`・`GuidePageLayout`・`GuideIndexContent` | Testing Library(描画・クリック) | スタブ不要 ── API もストアも使わない読み物の部品のため |
| `app/guide/__tests__/page.test.tsx` | `page.tsx` と `metadata` | ページの関数を描く | 中身の部品(vi.mock)── ページが本文を渡すことと題・説明だけを見るため |
| `menu-tree.test.ts`・`Menu.test.tsx` | `MENU_TREE`・`Menu` | テスト関数・Testing Library | 既存のまま。Guide の href がページの定義にあることを確かめる |
