# Phase-118-2: TOP の作り直し

## この章の目的

TOP(`/`)を、ステージ1 の説明とメニューのカードから、偶然来た人が30秒で「何のアプリか・何ができるか」を掴めるページに作り直す。構成案 2節の8つの節(Hero・こんな悩みに・全体の流れ・できること・2つのモード・はじめるまで4ステップ・大切にしていること・このアプリについて)を置き、手順は書かずに機能カードから GUIDE へ誘導する。

自動実装モード: on([introduction](./Phase-118-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`features/top/top-content.ts`](../samples/frontend/src/features/top/top-content.ts) | 新規 | TOP の文言(キャッチ・悩み・モードの比較・4ステップ・大切にしていること・リポジトリ) |
| [`features/top/components/top.module.css`](../samples/frontend/src/features/top/components/top.module.css) | 新規 | ボタン・カードの並び・比較の表 |
| [`features/top/components/TopPageContent.tsx`](../samples/frontend/src/features/top/components/TopPageContent.tsx) | 新規 | TOP の本文 |
| [`app/page.tsx`](../samples/frontend/src/app/page.tsx) | 更新 | Server の page にして metadata を持ち、本文を描く(メニューのカードとダミー画像を外した) |
| [`features/top/components/__tests__/TopPageContent.test.tsx`](../samples/frontend/src/features/top/components/__tests__/TopPageContent.test.tsx) | 新規 | 8つの節・はじめるの行き先・機能カードのリンク |
| [`app/__tests__/page.test.tsx`](../samples/frontend/src/app/__tests__/page.test.tsx) | 更新 | 本文を描き、題と説明を持つ |

## 1. 文言と部品を分ける

```ts
// src/features/top/top-content.ts(抜粋)
export const TOP_CATCH = "クライアントとの合意を、設計から実装・テストまでつなぐ。";
export const TOP_PROBLEMS: { problem; solution }[];   // README「何を解決するか」の4行
export const TOP_MODES: { label; simple; detailed }[]; // 向いている人・作れるもの・使える機能
export const TOP_STEPS: { title; body }[];
```

- 文言の正本は root の README(概要・課題・機能)と外部設計書。部品(`TopPageContent`)は並べるだけにした。
- 機能カードと流れ図は GUIDE の定義(`GUIDE_FEATURES`・`PRODUCT_FLOW`)を使う(構成案 4節「TOP のカードと GUIDE の目次は同じ機能の定義データを使う」)。
- 「はじめる」の行き先は、ログイン中ならダッシュボード、それ以外(確認中を含む)なら登録。マウント前と確認中を登録にして、SSR とハイドレーションの描き分けをそろえる(`useHasMounted`)。

## 2. 構成案から変えたこと

- **API キーの書き方**(118-3 の撮影中に気づいた): 構成案 1節5の「自分の API キーが要る・費用は自分持ち」は、外部設計書 2.12節と食い違う(キーが無くても既定の Gemini でチャットと生成ができる。自分のキーが要るのは Claude と設計レビュー)。4ステップの2つ目を「AI を選ぶ(任意)」にし、「このアプリについて」も「既定の AI は回数の上限の中で使える・自分のキーの利用料はキーの持ち主の負担」にした([q_a](../q_a.md)「Phase 118 開始時」)。
- **Hero の画像**: 撮影した変更要求の詳細の画面の左上を切り出した WebP(`public/guide/top-hero.webp`)。Hero は画像を `cover` で半分の幅に収めるので、そのままだと中央で切れて読めなかった。
- 今のメニューのカード(「はじめる」)を外した(サイドメニューと重複するため。構成案のとおり)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `TopPageContent.test.tsx` | `TopPageContent`(と、中の `GuideFlowDiagram`) | Testing Library | 認証のストアに状態を置く(`useAuthStore.setState`)── ログインの有無で「はじめる」の行き先が変わることだけを見るため。API は呼ばない |
| `app/__tests__/page.test.tsx` | `page.tsx` と `metadata` | ページの関数を描く | 本文の部品(vi.mock) |
