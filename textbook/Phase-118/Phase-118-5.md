# Phase-118-5: GUIDE の各ページ(後半: 実装手順〜用語集)

## この章の目的

流れの後半4ページ(実装手順書と実装可能性チェック・設計レビュー/テスト設計/変更の影響・合意と変更管理・資料の取り込み)と、流れの外の2ページ(クライアントの方へ・用語集とよくある質問)を書く。合意と変更管理は手順が最も長いので、手順のページ内の目次を出す。

自動実装モード: on([introduction](./Phase-118-introduction.md) 参照)。

## この章で作成・更新したファイル

| ファイル | 新規/更新 | 内容 |
| --- | --- | --- |
| [`pages/ImplementationGuide.tsx`](../samples/frontend/src/features/guide/pages/ImplementationGuide.tsx) | 新規 | 手順書を作る・指摘を読んで設計へ戻す・承認 |
| [`pages/ReviewGuide.tsx`](../samples/frontend/src/features/guide/pages/ReviewGuide.tsx) | 新規 | レビューの採否・差し戻し・テスト仕様書・変更の影響 |
| [`pages/AgreementGuide.tsx`](../samples/frontend/src/features/guide/pages/AgreementGuide.tsx) | 新規 | 版 → CR → 影響 → 案と説明書 → 合意 → 反映 → 検証 → 次の版、行の合意と確認事項(手順8つ) |
| [`pages/MaterialsGuide.tsx`](../samples/frontend/src/features/guide/pages/MaterialsGuide.tsx) | 新規 | 資料を足す・違いを取り出す・CR の下書き |
| [`pages/ForClientsGuide.tsx`](../samples/frontend/src/features/guide/pages/ForClientsGuide.tsx) | 新規 | クライアント向け(読む・質問・合意 / 却下) |
| [`pages/GlossaryGuide.tsx`](../samples/frontend/src/features/guide/pages/GlossaryGuide.tsx) | 新規 | 用語の表(20語)とよくある質問(6問) |
| [`app/guide/implementation/page.tsx`](../samples/frontend/src/app/guide/implementation/page.tsx) ほか5本(`review`・`agreement`・`materials`・`for-clients`・`glossary`) | 新規 | ルート |
| [`pages/__tests__/guidePages.test.tsx`](../samples/frontend/src/features/guide/pages/__tests__/guidePages.test.tsx) | 更新 | 後半のページ・ページ内の目次・分岐の帯・用語集 |
| [`app/guide/__tests__/slug-pages.test.tsx`](../samples/frontend/src/app/guide/__tests__/slug-pages.test.tsx) | 更新 | 6本のルートと、全 slug にルートがあること |

## 1. 書いた内容の要点

- **クライアントの方へ**は、ログインもアカウントも要らないこと、リンクの期限・転送しないこと・判断はやり直せないことを先に書いた。説明書の節の順は devex-api の `app/change_requests/explanation.py` の見出しに合わせた(要約 → 変更の内容と背景 → 対象の要件 → 選択肢 → 影響の一覧 → 変更の規模 → 合意の前に確かめたい点)。合意では理由が任意、却下では必須(`SharedDecisionForm`)。
- **合意と変更管理**は、CR の状態の順(下書き → 説明済み → 合意 → 反映済み → 検証済み。ほかに却下・取り下げ)で手順を並べ、118-3 で一巡させた CR-1 の画像を各タブに載せた。
- **設計レビュー**は、レビューを使える条件(レビューの AI の自分のキー)を前提に書いた。レビューの指摘の画像は、この章の時点では撮れていなかった(118-3)。完了後の調整で足した([introduction](./Phase-118-introduction.md)「完了後の調整」)。
- **用語集**は共通の型の手順・画像を持たないので、空の節を出さず、用語の表とよくある質問を `children` で置いた。用語は利用の流れの順。構成案 1節3 の言い換え(CR → 変更要求、束 → 合意済みの版、トレーサビリティ → つながり)を入れた。

## 2. リンク切れの番人

- `slug-pages.test.tsx` に「ページの定義のすべての slug にルートがある」を足した(ルートの一覧と `GUIDE_PAGES` のキーが一致する)。ページを足して `page.tsx` を作り忘れると落ちる。帯・前後・目次・TOP・メニューのリンクはすべてこの定義から作るので、ここが一致すればリンク切れは起きない。E2E でも全ページをたどる(118-6)。

## テスト観点

| テスト | SUT | ドライバ | スタブ |
|---|---|---|---|
| `guidePages.test.tsx`(追加分) | 後半のページの部品・`GLOSSARY`・`FAQ` | Testing Library | スタブ不要 ── 読み物の部品のため。ページ内の目次のアンカー・分岐の帯の印・スマホ幅の画像の大きさ・用語の行数を確かめる |
| `slug-pages.test.tsx`(追加分) | 6本の `page.tsx` と `metadata`、ルートの網羅 | ページの関数を描く | 本文の部品(vi.mock) |
