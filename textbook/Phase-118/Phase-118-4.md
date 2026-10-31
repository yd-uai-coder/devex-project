# Phase-118-4: GUIDE の各ページ(前半: はじめに〜詳細設計モード)

## この章の目的

利用の流れの前半5ページ(はじめに・プロジェクト・ヒアリング・4文書の生成・詳細設計モード)を、118-1 の共通の型で書く。ボタン・タブ・見出しは画面の表記どおりにし(構成案 1節4)、118-3 の画像を「画面の見方」に載せる。

自動実装モード: on([introduction](./Phase-118-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`features/guide/pages/screens.ts`](../samples/frontend/src/features/guide/pages/screens.ts) | 新規 | 画像の名前から `/guide/<name>.webp` を指す |
| [`pages/GettingStartedGuide.tsx`](../samples/frontend/src/features/guide/pages/GettingStartedGuide.tsx) | 新規 | はじめに(登録・モデル・API キー・費用とキーの扱い) |
| [`pages/ProjectsGuide.tsx`](../samples/frontend/src/features/guide/pages/ProjectsGuide.tsx) | 新規 | プロジェクト(作る・探す・消す・モードの選び方) |
| [`pages/HearingGuide.tsx`](../samples/frontend/src/features/guide/pages/HearingGuide.tsx) | 新規 | ヒアリング(答える・観点の表・完了と生成) |
| [`pages/DocumentsGuide.tsx`](../samples/frontend/src/features/guide/pages/DocumentsGuide.tsx) | 新規 | 4文書の生成(読む・前の版に戻す・作り直す) |
| [`pages/DetailedDesignGuide.tsx`](../samples/frontend/src/features/guide/pages/DetailedDesignGuide.tsx) | 新規 | 詳細設計モード(段階・図・zip) |
| [`app/guide/getting-started/page.tsx`](../samples/frontend/src/app/guide/getting-started/page.tsx) ほか4本(`projects`・`hearing`・`documents`・`detailed-design`) | 新規 | ルート。metadata はページの定義から |
| [`pages/__tests__/guidePages.test.tsx`](../samples/frontend/src/features/guide/pages/__tests__/guidePages.test.tsx) | 新規 | 5ページの型・帯・画像 |
| [`app/guide/__tests__/slug-pages.test.tsx`](../samples/frontend/src/app/guide/__tests__/slug-pages.test.tsx) | 新規 | 5本のルートの本文と metadata |

## 1. 本文の書き方

- 本文は、ページごとの Client Component が `GuidePageLayout` に props で渡す(文言を JSON にせず、TSX に置いた。ページごとに補足の部品を足せるように)。
- 表記の確かめ: 書くときに各画面の部品(`src/features/<機能>/components/`)のボタン・ラベル・見出しを grep し、外部設計書 2.x と突き合わせた。例: 「新規プロジェクトを作成」「このモードで作成する」「ヒアリングを始める」「この内容で設計書を生成する」「任意項目についてヒアリングを続ける」「この内容で復元する」「下書きを生成する」「承認する」「次の段階へ進む」「詳細設計書・実装計画をダウンロード(.zip)」。
- 推測で書かない: 確かめられなかったこと(一覧の並び順など)は書かなかった。前提(モード・必要な状態・キー)は各ページの「前提」に書いた。

## 2. ルートのページ

```tsx
// src/app/(pages)/guide/hearing/page.tsx
export const metadata: Metadata = {
  title: `${GUIDE_PAGES["hearing"].title} | 使い方ガイド | Devex`,
  description: GUIDE_PAGES["hearing"].summary,
};
export default function HearingGuidePage() { return <HearingGuide />; }
```

- Server の page は `guide-flow.ts`(Tamagui を import しない純粋な TS)から題と説明を取る。本文は Client Component。どのページもログインは要らない(`(protected)` の外)。ビルドでは静的に生成される(`○`)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `guidePages.test.tsx` | 5つのページの部品と `guideScreen` | Testing Library(`it.each`) | スタブ不要 ── 読み物の部品で API を呼ばないため。見出し・手順の見出し・画像の src・帯の今の段を確かめる |
| `slug-pages.test.tsx` | 5本の `page.tsx` と `metadata` | ページの関数を描く | 本文の部品(vi.mock)── 題・説明がページの定義から来ることだけを見るため |
