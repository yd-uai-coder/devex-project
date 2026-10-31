# Phase 118 導入: TOP ページと GUIDE(使い方の解説)ページ

## 目的

ステージ14 の後、本番への反映(Phase 119)の前に、TOP と使い方ガイド(GUIDE)のページを作る。今の TOP はステージ1 の説明とメニューのカードだけで、ステージ11〜14 の「合意と変更管理」が伝わらず、メニューの Guide は仮のリンク(`/guide` は 404)だった。偶然来た人が TOP で「何のアプリか・何ができるか」を掴み、使い方は GUIDE で手順どおりに進められるようにする。

- 入力: 2026-10-29 に承認した構成案 [`appendix/top-guide-plan.md`](../../appendix/top-guide-plan.md)([q_a](../q_a.md)「ステージ14完了後 ── TOP・GUIDE の構成案」)。内容の正本は root の [README](../../README.md) と [外部設計書](../../docs/external_design.md)。
- GUIDE は機能ごとの11ページを、利用の流れの順(はじめに → プロジェクト → ヒアリング → 文書 → 詳細設計 → 実装手順 → レビュー・影響 → 合意と変更管理 → 資料)でつなぐ。流れの並びは1か所に定義し、帯・前後・目次・TOP・メニューが同じ定義を使う。

## パイプライン上の位置づけ・前提

```
ステージ14(Phase 111〜117)→ 振り返り(ステージ15 をスコープの外へ)→ TOP・GUIDE の構成案
  118 ── GUIDE の土台(流れの定義・帯・前後・共通の型・流れ図・目次)       ──[118-1]
         TOP の作り直し                                                       ──[118-2]
         撮影用のデータ(実 LLM で一巡)と撮影                                  ──[118-3]
         GUIDE の各ページ(前半5 / 後半6)                                      ──[118-4][118-5]
         公開ページの E2E + 全 E2E・docs・画面確認のリスト                     ──[118-6]
         └ ユーザーの画面確認の指摘 → Phase 完了後の調整
  └→ Phase 119(ステージ11〜14 と Phase 118 の本番への反映と本番での確認。OPERATIONS 10.8節)→ 振り返り
```

- **前提として読むもの**: [構成案](../../appendix/top-guide-plan.md)・devex-ui の [CLAUDE.md](../../devex-ui/CLAUDE.md)(Server Component から Tamagui を import しない・CSS Module の display が本番で負ける)・[`share/[token]/page.tsx`](../samples/frontend/src/app/share/[token]/page.tsx)(ログインの要らないページと metadata の形)。
- **この Phase を始めた時点の状態**: 外側のリポジトリは `ff2b84c`(+ ステージ14 の振り返りと構成案が未コミット)、devex-ui は `main` の `b142507`。devex-api は変えない。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。devex-ui だけを変える。画像(`public/guide/*.webp`)は samples に写さない。

E2E: **この Phase で既存を含めて全部流す**(着手時の相談の決定3)。spec を1本(2件)足した([118-6](./Phase-118-6.md))。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 118 開始時」を参照。計画モードで1回(3問)聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | `tagmerge.py` の手直しを先にするか | 後に回して Phase 118 を始める(推奨どおり) |
| 2 | 撮影のデータ | **すべて撮影用に新しく作る**(推奨は「既存の題材 + 簡易モードだけ新規」。推奨と違う) |
| 3 | E2E | **公開ページの spec を足して全部流す**(推奨は「流さず Phase 119 で全部」。推奨と違う) |

推奨と違った選択は2件 / 3問。#39 の材料。

Claude の判断:
- 帯・前後の「ガイドを読む順」(9段)と、流れ図の「Devex の仕事の流れ」(8段)を分けて定義した([118-1](./Phase-118-1.md))。
- 構成案 1節5 の「自分の API キーが要る・費用は自分持ち」が外部設計書 2.12節と食い違っていたので、TOP・GUIDE は外部設計書に合わせた(キーが無くても既定の Gemini で使える)。
- 開発環境の Claude のキーが無効(401)だったので、キーには触らず、設計レビューの指摘の画像を撮らずに進めた([118-3](./Phase-118-3.md))。
- 画像は WebP(1.6MB)にし、Hero には切り出した画像を使った。

## 章一覧

| 章 | トピック | 依存 | 実装ファイル |
|---|---|---|---|
| [118-1](./Phase-118-1.md) | GUIDE の土台・目次・メニュー・`lang` | 無し | `features/guide/{guide-flow.ts, components/*}`・`app/(pages)/guide/page.tsx`・`lib/menu-tree.ts`・`app/layout.tsx` |
| [118-2](./Phase-118-2.md) | TOP の作り直し | 118-1 | `features/top/*`・`app/(pages)/page.tsx` |
| [118-3](./Phase-118-3.md) | 撮影用のデータと撮影 | 118-1・118-2 | 無し(画像だけ。#13/#15 の対象外) |
| [118-4](./Phase-118-4.md) | GUIDE の各ページ(前半5) | 118-1・118-3 | `features/guide/pages/{screens.ts, 5ページ}`・ルート5本 |
| [118-5](./Phase-118-5.md) | GUIDE の各ページ(後半6) | 118-4 | `features/guide/pages/6ページ`・ルート6本 |
| [118-6](./Phase-118-6.md) | 公開ページの E2E・全 E2E・docs・画面確認のリスト | 118-1〜118-5 | `e2e/guide-pages.spec.ts` |

## サンプルコード一覧

- 118-1: [`features/guide/`](../samples/frontend/src/features/guide/)(`guide-flow.ts`・`components/` の6ファイル・`test-utils/`・テスト6本)・[`app/guide/page.tsx`](../samples/frontend/src/app/guide/page.tsx)・[`lib/menu-tree.ts`](../samples/frontend/src/lib/menu-tree.ts)(更新)・[`app/layout.tsx`](../samples/frontend/src/app/layout.tsx)(更新)
- 118-2: [`features/top/`](../samples/frontend/src/features/top/)・[`app/page.tsx`](../samples/frontend/src/app/page.tsx)(更新)
- 118-4・118-5: [`features/guide/pages/`](../samples/frontend/src/features/guide/pages/)・[`app/guide/`](../samples/frontend/src/app/guide/) の11本
- 118-6: [`e2e/guide-pages.spec.ts`](../samples/frontend/e2e/guide-pages.spec.ts)
- samples に写さないもの: `devex-ui/public/guide/*.webp`(画像)、撮影のスクリプト(ジョブの作業用のディレクトリ)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作るもの | 責務 | テスト観点 |
|---|---|---|---|
| 118-1 | `guide-flow.ts` | ページの定義・流れの並び・分岐・位置・前後・全体の流れ・機能カード | SUT = 定義と `flowPosition`・`prevNext`、ドライバ = テスト関数、スタブ不要(純粋) |
| 118-1 | `GuideFlowBand`・`GuidePager`・`GuidePageLayout`・`GuideFlowDiagram`・`GuideIndexContent` | 帯(今の段・たたむ)・前後・共通の型・流れ図・目次 | SUT = 部品、ドライバ = Testing Library、スタブ不要(API を呼ばない) |
| 118-1 | `app/(pages)/guide/page.tsx`・`menu-tree.ts`・`layout.tsx` | 目次のページ・メニューの Guide・`lang="ja"` | ページは本文を vi.mock。メニューの href が定義にあること |
| 118-2 | `top-content.ts`・`TopPageContent`・`app/(pages)/page.tsx` | TOP の8節・はじめるの行き先・機能カードから GUIDE へ | SUT = `TopPageContent`、スタブ = 認証のストアの状態 |
| 118-3 | 撮影用のデータ・画像 | 実 LLM で一巡させて撮る | ── |
| 118-4・118-5 | 11ページの部品とルート | 共通の型で本文を渡す・metadata | SUT = 部品(`it.each`)とルート、全 slug にルートがある |
| 118-6 | `guide-pages.spec.ts` | 未ログインで全ページをたどる・画像が読める・スマホ幅の帯 | SUT = 画面、ドライバ = Playwright、スタブ不要 |

## 写経順序(#23)

章番号順。依存順(#30)は各章の表のとおり(`guide-flow.ts` → `guide.module.css` → 帯・前後 → 共通の型 → 流れ図 → 目次 → ページ、テストは最後)。

実 import 監査(#15): 各ファイルの import を読んだ。118-1 のファイルは 118-1 の中のファイルと以前の Phase のもの(`StyledCard`・`tamagui`・`next`)だけ。`menu-tree.test.ts`(118-1)は同じ章の `guide-flow.ts` を import する。118-2 の `TopPageContent` は 118-1 の `guide-flow.ts`・`GuideFlowDiagram` と以前の Phase の `Hero`・`auth-store`・`useHasMounted`。118-4・118-5 のページは 118-1 の `GuidePageLayout` と 118-4 の `screens.ts`、`GlossaryGuide`(118-5)は 118-1 の `guide.module.css`。spec(118-6)は 118-1 の `guide-flow.ts`。前方の import は無い。import でない前方の参照が1つある: TOP(118-2)の Hero の画像 `/guide/top-hero.webp` は 118-3 で撮った(118-2 の時点では画像が無く、表示だけが欠ける。テストは src を確かめない)。

## 検証結果

- devex-ui のユニット: 全体 **232ファイル・1470件成功**(`--maxWorkers=4`)。Phase 118 の分は guide・top・menu-tree・Menu・TOP のページで計50件ほど。
- `tsc --noEmit`: 通った。`npm run lint`: エラー0(既存の `streamChat.test.ts` の警告1件だけ)。
- ブラウザ: TOP・目次・11ページを、未ログインの PC 幅(1280)とスマホ幅(390)で開き、200・横のはみ出し0・ページの例外0。
- E2E: **16件成功**(既存14 + 新2)を2回([118-6](./Phase-118-6.md))。
- `npm run build`: TOP と GUIDE は静的に生成された。
- `samples_check.py --ui-since b142507`: 不一致 0・本体のみ 0(一致 1177 / 並び順のみ差 8 / 例外 5)。
- `link_check.py`: リンク切れ 0 件。
- 実 LLM: Gemini だけで約60回・概算 $0.1〜0.3(使用量の記録は無く、回数からの概算)。Claude は 401 で呼べず $0([118-3](./Phase-118-3.md))。

## 未消化の申し送り(#37)

[Phase 117](../Phase-117/Phase-117-introduction.md#未消化の申し送り37) から引き継いだもの。

**Phase 118 の中で扱うもの**:
- **開発環境での画面確認**(ユーザー): リストは [118-6](./Phase-118-6.md) 3節。指摘は「Phase 完了後の調整」で直す。
- **設計レビューの指摘の画像**(この Phase で生まれた)→ **済み**(2026-10-30。下の「完了後の調整」)。

**Phase 118 の範囲の外**:
- **本番への反映と本番での確認**: Phase 119 で、ステージ11〜14 と Phase 118 の分を [`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。Phase 118 は devex-ui だけ(マイグレーションなし)。本番で TOP・GUIDE を未ログインで開き、画像が出ることを確かめる項目を足す。反映の後に、説明済みの CR の要約を確かめ直す(手順8)。
- **本番の暗号の鍵**: 開発環境は `ENCRYPTION_KEY` が無く、マイページで API キーを登録できない(本番は鍵がある前提。GUIDE は登録できる前提で書いた)。
- **違いの種類の揺れ**・**題材の段階2〜8 が古い**・**使われ方を見て決める**もの・**LLM の案の下書きは両端に寄る**・振り返り 6節の残り5件・生成の質の候補4件(Phase 117 のまま)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- Phase 117 の一覧のまま(pyright の指摘・並列のテストのタイムアウト・`DfdEditorTabs` のまれな失敗・Google の公開鍵・`ListCard`・英語の refresh の文・`streamChat.test.ts` の警告・stage11 の `measure.py`・CR の流れの部品の寄せ・`StrayProcedureTable` の重なり・共有リンクの画面の `POST /auth/refresh` の 401)。
- **`tagmerge.py` の手直し**(P104・P109・P113・P115・P116。着手時の相談の決定1で後に回した。完了後の調整で、CSS のコメントを閉じない・更新の旧の行をコメントの中のコメントにする問題も見つかった)。**(この Phase)** 当てた8ファイルで「要手当て」は出なかった。TOP の `page.tsx` は全体の書き換えで、旧の行がすべてコメントアウトの塊になった(正常)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: Phase 117 の分(題材「トレンド追跡アプリ」の B-5〜B-7・CR-5・CR-6 と共有リンク、E2E の捨てのプロジェクト)に、**(この Phase)** 撮影用の利用者 `guide-demo-1793361136740@example.com`(superuser・レビューをオン)と、その「読書メモ」(簡易)・「備品予約」(詳細。B-1・B-2・CR-1・CR-2・共有リンク(期限 2026-11-13)・資料1件)を足した。GUIDE の画像を撮り直すときに使うので、残すことを勧める。E2E が残した利用者(`e2e-…`)は今までどおり。
- **タグ**: Phase 117 までの分に加えて、devex-ui に `phase-118`。
- **未コミット**: この Phase の分(外側・devex-ui)と、ステージ14 の振り返り・構成案(外側)。コミットはユーザーが行う(#35)。

**この Phase で解決したもの**:
- **メニューの Guide の仮のリンク**(ステージ9 から)→ 目次と主要4ページ([118-1](./Phase-118-1.md))。
- **TOP がステージ1 の説明のまま** → 作り直した([118-2](./Phase-118-2.md))。

**この Phase で生まれたもの**:
- 設計レビューの指摘の画像(上)・撮影用のデータ(上)・構成案と外部設計書の食い違い(API キー。直した)。
- **セッションの区切りの記録**: Phase 118 は1セッションで行った(ユーザーの画面確認と調整は、この後)。
  1. 計画モードで調査(調べるエージェントは使わず、直接読んだ)・質問1回(3問)・計画の承認
  2. 118-1・118-2(土台・TOP)
  3. 撮影用のデータ(実 LLM。ヒアリング2本・段階1〜7・CR の一巡・資料)と撮影 → 401 に気づく
  4. 118-4・118-5(11ページ)・ブラウザでの確かめ
  5. E2E の spec・3100 番で全 E2E を2回・環境を戻す
  6. samples(tagmerge)・docs・q_a・教材

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 流れの帯と前へ / 次へ・目次・TOP のカード・メニューが、どれも1つの定義を使うのはなぜか。リンク切れをどこで防いでいるか。
2. 「ガイドを読む順」と「Devex の仕事の流れ」を別の並びにしたのはなぜか。流れの外のページ(クライアントの方へ・用語集)は、帯と前後でどう扱うか。
3. 構成案と外部設計書が食い違っていたとき(API キー)、どちらに合わせたか。それはなぜか。
4. 画面の表記どおりに書くために、何と突き合わせたか。確かめられないことはどう扱ったか。
5. 撮影用のデータを実 LLM で一巡させたことで、GUIDE の何が書けるようになり、何が撮れなかったか。

## 完了後の調整

- **設計レビューの画像を撮り足した**(2026-10-30。ユーザーが開発環境の `devex-api/.env` の `ANTHROPIC_API_KEY` を直した後)。backend を作り直してキーが通ることを確かめ、撮影用の2つのプロジェクトで「文書の生成の後」のレビューを流し直した(どちらも成功。指摘は簡易15件・詳細15件)。簡易の「読書メモ」で最重要の指摘1件を「採用」にして、指摘の一覧を撮った(`review-panel.webp`)。詳細設計の画面(`dd-download.webp`)も、レビューが「レビュー済み」の状態で撮り直した。
  - 本体: [`ReviewGuide.tsx`](../samples/frontend/src/features/guide/pages/ReviewGuide.tsx) の「画面の見方」の先頭にレビューの画像を足し、[`guidePages.test.tsx`](../samples/frontend/src/features/guide/pages/__tests__/guidePages.test.tsx) でその画像を確かめるようにした。samples は tagmerge で `Phase-118(完了後の調整)` のタグを付けた。
  - 確かめ: guide のページのテスト13件・eslint・`samples_check`(不一致 0・本体のみ 0)。
  - 実 LLM: Claude Sonnet(`claude-sonnet-5-5`)のレビュー2回。入力 22,549・出力 15,602 トークン(`review_runs` の記録)。単価を入力 $3・出力 $15 / 100万トークンと置くと 約 $0.30(単価は仮定。記録に単価は無い)。
  - 撮影用の簡易のプロジェクトに、採用した指摘が1件残る(未対応)。

- **2つのモードの比較と分岐**(2026-10-31。ユーザーの依頼。[q_a](../q_a.md)「Phase 118 完了後 ── 2つのモードの比較と分岐」。着手時に3問、推奨と違った選択1件)。
  - GUIDE に「2つのモードと作る文書」(`/guide/modes`)を足し、流れの2段目に入れた(はじめに → モード → プロジェクト。流れは10段)。中身は、分岐図(ヒアリング → 共通: 要件定義書・外部設計書 → 簡易: 内部設計書 / 詳細: 詳細設計書・設計図 → 共通: 実装計画書・テスト仕様書・実装手順書 → 詳細だけ: 変更の説明書)、文書 × モードの一覧表、9文書の説明のカード(何の文書か・主な中身・使い道・形式・使い方のページ)、詳細設計モードだけの機能、選び方の表。
  - 文書の情報は [`documents.ts`](../samples/frontend/src/features/guide/documents.ts) の1か所に置き(中身は devex-api の文書の見出しと外部設計書に合わせた)、分岐図([`GuideModeBranch.tsx`](../samples/frontend/src/features/guide/components/GuideModeBranch.tsx))は文書の置き場(`step`)から作る。
  - TOP は今の比較表を残し、リンクだけ新しいページへ(ユーザーの決定)。プロジェクトのページのモードの選び方からもリンクした。目次の「目的から探す」に「どちらのモードにするか迷う」を足した。
  - アプリの中: [`ModeSelectDialog.tsx`](../samples/frontend/src/features/dashboard/components/ModeSelectDialog.tsx) に「作る文書の違いを見る(使い方ガイド・新しいタブ)」を足した(ダイアログは閉じない)。
  - 流れの段の番号がずれたので、帯・前後・E2E の「段 N / 全 M」のテストを直した。
  - 確かめ: devex-ui のユニット全体 234ファイル・1477件成功・tsc・eslint・`guide-pages.spec.ts`(開発サーバーで2件成功。初回は新しいページの初めてのコンパイルの待ちで時間切れ)・PC / スマホ幅で横のはみ出し0・`samples_check`(不一致 0)。全 E2E は流していない(公開ページとダイアログのリンク1行だけの変更のため。Phase 119 で全部流す)。
  - samples は tagmerge で `Phase-118(完了後の調整2)` のタグを付けた。**tagmerge が CSS(`/*` のコメント)のヘッダーと追記のタグを閉じずに書いた**ので、手で `*/` を足した(`tagmerge.py` の手直しの候補に足す)。
- **画面の見方の並びと、このページの目次**(2026-10-31。ユーザーの依頼。[q_a](../q_a.md)「Phase 118 完了後 ── 画面の見方の並びとページの目次」)。
  - 画面の見方: 「画像 → 説明」を「説明(太字)→ 注記 → 画像」の順にし、画面と画面の間を空けて線で区切った(`.screens` の間隔 48px・2枚目からは上に線と余白)。
  - このページの目次: PC 幅(1100px 以上)は本文の右に、節と手順のまとまりへのリンクのカードを置く([`GuidePageToc.tsx`](../samples/frontend/src/features/guide/components/GuidePageToc.tsx))。項目は本文の見出し(id のある h2)と手順のまとまり(`data-toc-title`)から集めるので、用語集・モードのページのように独自の節を持つページにもそのまま出る。スクロールに付いてきて(`position: sticky`)、ヘッダーの下を越えた最後の見出しを「今の節」として強調する(`aria-current="location"`)。スマホ幅では出さず、今までどおり手順の頭のページ内の目次を出す(PC 幅では、右の目次と重なるので出さない)。見出しへ移ったときに固定のヘッダーに隠れないよう、`scroll-margin-top` を付けた。
  - あわせて、レビューの「失敗」や「レビュー中」が写っていた文書の画面の3枚(`documents`・`versions`・`test-spec`)を撮り直した(LLM は呼ばない)。バージョン履歴は、版が2つある詳細設計モードの「備品予約」で撮り、説明の文を直した。
  - 確かめ: guide のテスト54件・tsc・eslint・`guide-pages.spec.ts`(2件)・ブラウザ(PC で目次が付いてきて今の節が変わる・スマホで目次が出ず横のはみ出し0)・`samples_check`(不一致 0)。samples は `Phase-118(完了後の調整3)` のタグ。**tagmerge が CSS の更新の旧の行をコメントの中のコメントにして崩した**ので、CSS の sample は手で組み立てた(手直しの候補)。

## 後続 Phase での改訂

(まだ無い)

## 次のフェーズ

ユーザーの画面確認([118-6](./Phase-118-6.md) のリスト)と、指摘があれば「Phase 完了後の調整」。Claude のキーが直ったら、設計レビューの画像を撮り足す。その後、**Phase 119**(ステージ11〜14 と Phase 118 の本番への反映と本番での確認。別セッション。#18)→ 振り返り。
