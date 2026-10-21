# Phase 98 導入: 確認事項の一覧の画面と、CR の画面の手直し(ステージ12)

## 目的

Phase 94〜96 で、確認事項の一覧・CR の下書きの直しの記録・段階の承認の印・新しい要件の予測の起点の API ができた。だが画面からは、確認事項を見て決める機会・状態を決めることも、CR に起点を選ぶことも、CR で作り直した段階が未承認であることも見えなかった。この Phase で画面に出す。[90-4](../Phase-90/Phase-90-4.md) の Phase 98 にあたる。

- 確認事項の一覧のページ(SCR-011)。決める機会・状態・メモ・推測の採用率。ほかの画面からのリンク ── [98-1](./Phase-98-1.md)
- CR の画面の手直し。予測の起点を選ぶ欄、内容・影響のタブの起点、検証のタブの未承認の段階、たどる記録の直した項目と結んだ印の数 ── [98-2](./Phase-98-2.md)

効果測定・全 E2E・開発環境での画面確認は Phase 99。

## パイプライン上の位置づけ・前提

```
SCR-005・SCR-008・束・CR の一覧の見出し / SCR-005 の推測の要件の枠
   │ 「確認事項」
   ▼ /projects/{id}/confirmations ──[98-1]
ConfirmationsPageContent ── GET /confirmations(Phase 94)
   │ 決める機会・状態・メモ → PATCH /confirmations/{key}
   │   推測の要件・利用者を確認済み → ダイアログ → 採用 + 合意の記録(Phase 94・91)
   ▼ 応答(作り直した一覧)で差し替え。消えた項目は「決めた記録」へ

CR の作成・編集 ──[98-2]── GET /baselines/{n}/origins(Phase 96)→ origins を送る
CR の詳細: 影響(origins・origin_keys)/ 検証(pending_stages)/ たどる記録(edited_fields・mark_count)
```

- **前提として読むもの**: [90-1](../Phase-90/Phase-90-1.md)(決定4・8)・[90-4](../Phase-90/Phase-90-4.md)(Phase 97〜98 の未確定事項)・[94-3](../Phase-94/Phase-94-3.md)(確認事項の API・確認済みで採用)・[95-2](../Phase-95/Phase-95-2.md)(下書きの直しの記録)・[96-1](../Phase-96/Phase-96-1.md)・[96-2](../Phase-96/Phase-96-2.md)(段階の承認の印・起点)・[97-2](../Phase-97/Phase-97-2.md)(ストアを持たない feature の形)・[87-2](../Phase-87/Phase-87-2.md)(CR のフォーム)。
- **今の仕組み**:
  - 確認事項の API は、今の要件定義書と観点の表から毎回組み立てた一覧に、利用者が決めた欄を重ねて返す。PATCH の応答も作り直した一覧。推測の要件・利用者を確認済みにすると採用にして合意を記録する。
  - SCR-005 の推測の要件の枠には「採用にする」があり、押すと確認事項も確認済みになる(Phase 94)。
  - devex-ui の CR の型は `origins`・`origin_keys`・`pending_stages`・`edited_fields` を持たず、フォームの「新しい要件を足す」は「影響の予測には入りません」のままだった。
  - 段階の承認で印を結んだ行の印の数は、イベントの `refs.mark_count` にあったが、たどる記録の応答に出ていなかった。
- **この Phase を始めた時点の状態**: Phase 91〜97 はコミット済み。devex-api は `stage11-15` ブランチの `f2e0f93`、devex-ui は `main` の `c32e712`。alembic の head は `ee299cd210b8`。

## モード宣言(#21)・E2E の宣言(#36)

自動実装モード: **on**(本体 + samples)。

E2E: この Phase では流さない。ステージ12 の E2E は Phase 99 で既存の分も含めて全部流す(#36)。確認事項のページは新しいページで、既存の E2E の流れは通らない。CR のフォームは「新しい要件を足す」に印を付けたときだけ欄が増え、検証のタブは未承認の段階があるときだけ節が増える(既存の E2E の CR の流れは段階を作り直さない)。開発環境での画面確認も Phase 99 にまとめる(#37 の運用注記)。

## 着手時の相談で決めたこと

詳細は [`q_a.md`](../q_a.md) の「Phase 98 開始時」を参照。計画モードで1回(4問)聞いた。置き場は、Phase 88・97 と同じく画面のイメージを並べて聞いた。

| # | 問い | 決定 |
|---|---|---|
| 1 | 自動実装モード | on(推奨どおり) |
| 2 | 確認事項の一覧の置き場(90-4 の未確定事項) | 別のページ `/projects/{id}/confirmations`(SCR-011)。SCR-005・SCR-008・束・CR の一覧の見出しと、SCR-005 の推測の要件の枠からリンク(推奨どおり。SCR-005 のタブの枠・CR の一覧のタブの案と、画面のイメージで比べた) |
| 3 | 推測の要件・利用者を確認済みにするとき | 確認のダイアログを挟む。観点・却下・決める機会・メモはすぐ保存(推奨どおり) |
| 4 | 一覧から消えた項目(`present: false`)の見せ方 | 末尾の「一覧から消えた項目(決めた記録)」に畳む(推奨どおり) |

Claude の判断(計画の承認で確定):

- 確認事項の feature はストアを作らず、ページのローカルの state に持つ。保存の応答(作り直した一覧)で丸ごと差し替える。
- 絞り込みの既定は未確認だけ。決めた記録は読むだけ。
- `DetailedModeOnlyNotice` の主語を `what` で言い換えられるようにした(確認事項の 409 で使う)。
- 起点の欄は「新しい要件を足す」に印を付けたときだけ出す。印を外したら起点は送らない(devex-api が 422 で断るため)。起点の候補は CR のストアに束ごとに1回だけ読む。
- 検証のタブに未承認の段階の節、たどる記録に直した項目と結んだ印の数。印の数を出すため、devex-api のたどる記録の行に `mark_count` を足した(マイグレーションなし)。
- テンプレートから取り込むものは無い。

推奨と違った選択は0件。計画の差し戻しは無し。#39 の材料。

## 章一覧

| 章 | トピック | ファイル作成 | 依存 |
|---|---|---|---|
| [`Phase-98-1.md`](./Phase-98-1.md) | 確認事項の一覧のページ | あり(本体 12 + テスト 10。devex-ui) | Phase 94(確認事項の API) |
| [`Phase-98-2.md`](./Phase-98-2.md) | CR の画面の手直し | あり(本体 13 + テスト 13。devex-api 3・devex-ui 23) | Phase 95(直した項目)・96(印・起点) |

## サンプルコード一覧

- 98-1(`textbook/samples/frontend/`): `src/features/confirmations/` の `api/types.ts`・`api/confirmationsApi.ts`・`confirmationOps.ts`・`components/ConfirmationTable.tsx`・`components/ConfirmationsPageContent.tsx`・`test-utils/confirmationFixtures.ts`・テスト3本、`src/app/projects/[id]/confirmations/page.tsx` とそのテスト(すべて新規)。`DetailedModeOnlyNotice.tsx`・`DocumentsPageContent.tsx`・`RequirementsSummaryPanel.tsx`・`DetailedDesignPageContent.tsx`・`BaselinesPageContent.tsx`・`ChangeRequestsPageContent.tsx` とそのテスト5本(更新)。
- 98-2(`textbook/samples/backend/`): `app/change_requests/trace.py`・`app/schemas/change_request.py`・`tests/unit/test_change_request_trace.py`(更新)。(`textbook/samples/frontend/`): CR の feature の `api/types.ts`・`change-requests-store.ts`・`changeRequestOps.ts`・部品6本・`test-utils` 2本・テスト9本、束の feature の `api/types.ts`・`api/baselinesApi.ts`・そのテスト(すべて更新)。
- ミラーしないもの(#21 の共通): 無し(インフラ・設定ファイルは変えていない)。
- 更新したファイルは `tagmerge.py` で当てた。JSX の子の位置の追記・更新のタグは `{/* … */}` にした。三項演算子・`map` の `( … )` の中は JSX の子でないので、`//` のままにした(道具の「要手当て」の範囲)。

## 実装前チェックリスト(#11、設計レベルの疑問に限定 #20)

| 章 | 作成・更新するファイル | 責務(1行) | テスト観点 |
|---|---|---|---|
| 98-1 | `api/types.ts`・`api/confirmationsApi.ts` | 一覧を読み、1件の欄を変える | URL・キーの符号化・送る欄だけ |
| 98-1 | `confirmationOps.ts` | 絞り込み・分け方・件数と採用率の文・確認のダイアログの要否 | 既定の絞り込み・分母0の採用率・ダイアログは推測の確認済みだけ |
| 98-1 | `ConfirmationTable.tsx`・`ConfirmationsPageContent.tsx`・`page.tsx`・`DetailedModeOnlyNotice.tsx` | 表とページ。保存の応答で差し替え、消えた項目を畳む | ダイアログの有無・すぐ保存・メモ・畳む節・失敗・空・409 |
| 98-1 | 見出しの4ページ・`RequirementsSummaryPanel.tsx` | 確認事項へのリンク(詳細設計モードだけ) | モードによる出し分け |
| 98-2 | devex-api `trace.py`・`schemas/change_request.py` | 段階の承認の行に結んだ印の数 | ほかの行・形の悪い数は null |
| 98-2 | CR・束の型、`baselinesApi.ts`・ストア・`changeRequestOps.ts` | 起点の候補を読み、フォームで起点を持って送る | 束ごとに1回・印を外すと送らない |
| 98-2 | フォーム・作成のページ・内容/影響/検証/たどる記録のタブ | 起点の欄と表示・未承認の段階・直した項目と印の数 | 欄の出し分け・候補の読み込みの時点・リンク・行の文 |

## 写経順序(#23)

章番号順。各章の「作成・更新したファイル」表は依存順に並べた(#30)。98-2 の devex-api の変更は devex-ui から import されないので、写経の順は各リポジトリの中で閉じる。

実 import 監査(#15)として、各ファイルの全 import 文を読んだ。import 先のモジュールとシンボルの誕生章が、そのファイルの章以下であることを確かめた。

- `confirmationsApi.ts`(98-1)→ 既存の `apiFetch`、`types.ts`(98-1)。`confirmationOps.ts`(98-1)→ `types.ts`(98-1)。`ConfirmationTable.tsx`(98-1)→ `types.ts`・`confirmationOps.ts`(98-1)、既存の `tableStyles`。`ConfirmationsPageContent.tsx`(98-1)→ 98-1 の4つ、既存の `ProjectNotFoundNotice`・`ConfirmDialog`・`isDetailedModeOnly`・`DetailedModeOnlyNotice`(`what` は 98-1 で足した)・`isNotFound`・`tableStyles`。`page.tsx`(98-1)→ `ConfirmationsPageContent`(98-1)、既存の `RequireAuth`。`RequirementsSummaryPanel.tsx`(98-1)→ 追加は `next/link` だけ。
- `trace.py`・`schemas/change_request.py`(98-2)→ import の追加なし。
- `baselines/api/baselinesApi.ts`(98-2)→ `BaselineOriginRead`(98-2)。`changeRequestOps.ts`(98-2)→ `ChangeRequestOriginRead`(98-2)・`OriginKind`(98-2)。`change-requests-store.ts`(98-2)→ `listBaselineOrigins`・`BaselineOriginRead`(98-2)。`ChangeRequestForm.tsx`(98-2)→ `BaselineOriginRead`・`ORIGIN_KIND_LABEL`・`addOrigin`・`removeOrigin`(98-2)。`ImpactTab.tsx`(98-2)→ `ChangeRequestOriginRead`・`originLabel`(98-2)。ほかの部品は import の追加なし。
- テスト: 98-1 のテストは 98-1 のファイルと既存の `stubFetch`・tamagui の設定・各ページのストア。98-2 のテストは 98-2 のファイルと既存の fixture・`stubFetch`。

各章のテストは、その章で作成・更新した全ファイルを少なくとも1度 import する(#15)。98-1 の `types.ts` は fixture が、`DetailedModeOnlyNotice.tsx` はページのテストの 409 の経路が通る。98-2 の devex-api の2ファイルは `test_change_request_trace.py` が、devex-ui の型は fixture が、ほかはそれぞれのテストが import する。

## 検証結果

- ユニット: 章ごとに、章のテストと関係する既存のテスト(devex-ui の `confirmations`・`change-requests`・`baselines`・`documents`・`DetailedDesignPageContent`、devex-api の `test_change_request_trace.py`)を流した。Phase の終わりに全体を流した(→ 下の「全体テスト」)。
- devex-api: `ruff check`(app・tests): 通った。`pyright`(触ったファイル): 0 件。
- devex-ui: `tsc --noEmit` 通った。`eslint src`: エラー 0(警告1件は既存の `streamChat.test.ts`。持ち越し)。
- 開発 DB(読み取りだけ): 「トレンド追跡アプリ」で確認事項のサービスを呼び、応答の形が画面の型と合うことを確かめた。20件(推測の要件 12・推測の利用者 2・未決の観点 6)、採用率は `null`(画面では「─」)。要件の行がすべて推測なのは、Phase 90 の計測(「採用にする」の後の再生成で推測に戻った版)のためである。PATCH はしていない。
- samples の構文: 変えた TS/TSX を TypeScript の構文解析で、Python を `ast` で読み、誤り 0。
- `textbook/tools/samples_check.py --api-since stage11-15 --ui-since HEAD`: 不一致 0・本体のみ 0(一致 988 / 並び順のみ差 8 / 例外 5)。
- `textbook/tools/link_check.py`: リンク切れ 0 件。
- 全体テスト: devex-api はユニット 1753 件・統合 39 件(専用のテスト DB)がすべて通った。devex-ui はユニット 1219 件がすべて通った(`--maxWorkers=4`。章ごとの既定の並列数の実行では、既存のテストが2件タイムアウトし、流し直すと通った。持ち越しの「並列のテストのタイムアウト」)。
- E2E: 流していない(Phase 99 で全部流す)。

## 未消化の申し送り(#37)

[Phase 97](../Phase-97/Phase-97-introduction.md#未消化の申し送り37) から引き継いだもの。

**ステージ12 の中で扱うもの**(行き先は [90-4](../Phase-90/Phase-90-4.md)):
- **影響が広がる変更の実 LLM での比較**(P89)→ Phase 99 の効果測定。保護で戻した件数(版の `protection`)、CR を反映した後の CR なしの再生成で CR の変更が残ること、確認事項の件数と採用率も測る。CR の反映の後の要素の履歴に `changed`(CR-n)が並ぶことを確かめる。段階の作り直しを伴う CR で、承認で結んだ印の数(たどる記録の「結んだ印 n件」)と、比較の「実際だけ」に出る数も測る。「合意の状態」で、CR なしの再生成の後に「合意と違う」が0件であることも数える。
- **外部連携の言い換え**(Phase 91 の申し送りの残り)→ Phase 99 の実 LLM で起きるかを見る。
- **画面確認で決める項目** → Phase 99 の開発環境での画面確認。
  - Phase 97 から: 「合意の状態」の枠の長さ、印の色、履歴の行の言い方。
  - **この Phase で生まれたもの**: 確認事項の表の長さ(開発 DB の題材で20件。要件の文が長い)と、行の操作の並べ方(状態のボタンが行ごとに2つ)。決めた記録の畳み方。推測の要件の枠のリンクの言い方。CR の起点の選択の長さ(束の要件・画面・API をすべて1つの選択に並べた。要素が多いと探しにくいか)。検証のタブの未承認の段階の節の位置(印の表の前)。
  - 確認事項の画面と要件定義書のタブの「合意の状態」の枠の並べ方(Phase 97 の申し送り)は、別のページにしたので解消。
- **Phase 99 の未確定事項**: [90-4](../Phase-90/Phase-90-4.md)「未確定事項」。

**ステージ12 の範囲の外**:
- **本番への反映と本番での確認**: ステージ15 の完了時に、[`OPERATIONS.md`](../../devex-api/OPERATIONS.md) 10.8節で行う。Phase 91 の2つのマイグレーション・Phase 92 の `956b403c67fe`・Phase 94 の `382a5efa3508`・Phase 96 の `ee299cd210b8` を、Phase 99 で 10.8節に足す(この Phase はマイグレーションなし)。
- **巡回で消えた版の戻しは履歴に出ない**(Phase 95): Phase 99 の効果測定で、戻しがどれだけ起き、見えないことが困るかを見て決める(ステージ13 以降)。
- **起点に選べる要素の種類**(Phase 96): 要件・画面・API に限った。機能・作業単位などを起点にしたい場面があるかは、使われ方を見て決める(ステージ13 以降)。
- **推測の利用者のキーが名前であること**(Phase 94): 使われ方を見て決める(ステージ13 以降)。
- **要約の生成の回数の上限**・**束の一覧の入れた CR**: 使われ方を見て決める(ステージ13 以降)。
- 規模の集計と選択肢つきの説明(ステージ13)。
- 振り返り 6節の残り5件・生成の質の候補4件(Phase 90 と同じ)。

**持ち越し**(触るときに直す。中身は [振り返り](../retrospectives/project-retrospective.md) 8節):
- `test_chat_service.py` などの pyright の指摘(Phase 40)
- devex-ui の並列のテストのタイムアウト(Phase 44。この Phase の章ごとの実行でも2件出た。全体は `--maxWorkers=4` で通った)
- 偽 LLM の外部設計書の GET に DF が無い(Phase 45)
- `DfdEditorTabs` のテストのまれな失敗(Phase 77)
- Google の公開鍵を毎回取りに行く(Phase 74)
- `ListCard` の入れ物(Phase 79。テンプレートでは直した)
- 英語のままの refresh の失敗の文(Phase 79)
- `streamChat.test.ts` の lint の警告(使っていない変数。既存)
- `appendix/measurements/stage11/measure.py` の `ruff check` の指摘(行の長さ1件。Phase 80 から)
- 反映の後の CR の流れの部品: `tests/fixtures/change_requests.py`。85-2〜85-4 のテストの中の同じ手順は、触るときに寄せる(#17)。
- 束の写しの取り出し: `change_request_service.py` の説明書の組み立て(`_explanation`)に、`baseline_snapshots` と同じ内包表記が1か所残る。触るときに寄せる(#17)。

**ユーザーが決めるもの**:
- **開発環境の後始末**: 確認用の利用者・プロジェクト(開発 DB の束 12・CR 8 など)、DB の事故の後の複製。「トレンド追跡アプリ」は Phase 99 の効果測定の題材の候補なので残しておく(この Phase では読むだけで、変えていない)。
- **この Phase の未コミット**: 外側のリポジトリ(教材・docs・samples)・devex-api・devex-ui。コミットはユーザーが行う(#35)。

**この Phase で解決したもの**:
- **確認事項の一覧の画面**(Phase 94 の申し送り)→ [98-1](./Phase-98-1.md)。置き場・ほかの画面からのリンク・`present: false` の見せ方・決める機会の選び方。
- **下書きの直しのたどる記録の画面**(Phase 95 の申し送り)→ [98-2](./Phase-98-2.md)。
- **起点を選ぶ欄と、作り直した段階の未承認の見せ方**(Phase 96 の申し送り)→ [98-2](./Phase-98-2.md)。検証のタブの未承認の段階・たどる記録の `approve_stage` の行・予測のタブの「届いた起点」。
- Phase 98 の未確定事項(確認事項の一覧の置き場とリンク)→ 「着手時の相談で決めたこと」。

**この Phase で生まれたもの**:
- 上の「画面確認で決める項目」(Phase 99)。
- **セッションの区切りの記録**: Phase 98 は1セッションで行った。流れは次のとおり。
  1. 計画モードで調査(エージェントは使わず直接読んだ)・質問1回(4問。置き場は画面のイメージつき)・計画の承認
  2. 98-2 の devex-api の小さな追加(たどる記録の印の数)
  3. 98-1 の実装(devex-ui)
  4. 98-2 の実装(devex-ui)
  5. 開発 DB での応答の形の確かめ(読み取りだけ)・全体テスト(devex-api のユニット・統合、devex-ui のユニット)
  6. samples(`tagmerge.py`。JSX の中のタグは手で直した)
  7. docs・教材

## 後続 Phase での改訂

(まだ無い)

## Phase 完了チェック(#22)

設問は Phase の要点の要約である(回答は求めない)。

1. 確認事項の一覧を、要件定義書のタブの枠でなく別のページにしたのはなぜか。推測の要件の枠の「採用にする」を残したのはなぜか。
2. 推測の要件・利用者の確認済みだけにダイアログを挟み、観点の確認済みや却下には挟まないのはなぜか(それぞれの操作が文書と合意の記録に何をするか)。
3. 保存の応答で一覧を丸ごと差し替えるのはなぜか。画面の側で行の状態だけを書き換えると、何がずれるか。
4. 「新しい要件を足す」の印を外したときに、選んでいた起点を送らないのはなぜか。フォームの中では覚えたままにするのはなぜか。
5. たどる記録の応答に `mark_count` を足したのはなぜか(Phase 99 の効果測定との関係)。

## 次のフェーズ

**Phase 99**: 効果測定・統合/E2E。[ベースライン](../../appendix/measurements/stage12-baseline.md)と同じ表の埋め直し、影響が広がる CR の実 LLM での反映と CR を渡さない再生成、既存を含めた全 E2E、マイグレーションの往復、開発環境での画面確認(Phase 97・98 の画面確認で決める項目)、`OPERATIONS.md` 10.8節にステージ12 の分。着手時に、[90-4](../Phase-90/Phase-90-4.md) の Phase 99 の未確定事項(実 LLM の範囲と費用の見積もり・題材)を決める。
